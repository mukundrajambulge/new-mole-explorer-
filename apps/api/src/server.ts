import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { f64Value, type BootstrapResponse, type CanonicalCommand, type D2SearchRegionV1, type HealthResponse, type ProjectSaveRequest } from "@molecular/contracts";
import { assertLocalFilenameAdmitted, IngestionError, LARGE_STRUCTURE_WARNING_BYTES, readTextFile, StructureIngestionService } from "./structures/ingestion.js";
import { assertDeclaredLength, consumeRequest, receiveMultipartFile } from "./structures/multipart.js";
import { ProjectStore } from "./projects/projectStore.js";
import { SourceArtifactStore } from "./lifecycle/sourceArtifactStore.js";
import { CommandDispatcher } from "./command/dispatcher.js";
import { profileMark, profileTransport } from "./structures/ingestionProfiler.js";
import { D2PreparationService } from "./docking/d2PreparationService.js";
import type { D2SearchRegionInput } from "./docking/d2Preparation.js";
import { createPrepService } from "./jobs/prepService.js";
import { createDockJobRoutes, createDockJobService, dockingRunEnabled, type DockJobService } from "./docking/routes.js";
import { vinaComparatorCapability } from "@molecular/contracts";
import { parseOr400, decodeSegment } from "./projects/parseOr400.js";
import { bodyObjectSchema, commandBatchBodySchema, commandBodySchema, commandExecuteBodySchema, commandReplayBodySchema, d2AdaptBodySchema, d2SearchRegionBodySchema, pathIdSchema, projectCreateBodySchema, projectIdSchema, projectOpenQuerySchema, projectSaveBodySchema, rcsbBodySchema, revisionIdSchema, uploadHeadersSchema } from "../../../packages/contracts/src/api/index.js";

const config = loadConfig();

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  profileMark("SERIALIZATION", "START", { status });
  const serialized = JSON.stringify(body);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  profileTransport("START", { status });
  profileMark("SERIALIZATION", "END", { status, serializedBytes: Buffer.byteLength(serialized, "utf8") });
  profileTransport("END", { status, serializedBytes: Buffer.byteLength(serialized, "utf8") });
  response.end(serialized);
};

const health: HealthResponse = { service: "molecular-api", status: "ok", gate: "G1C", timestamp: new Date().toISOString() };

// Task 5.5/5.6: the Vina comparator preview (owner decision 2026-10-09) exists only with FEATURE_DOCKING_RUN=1.
const dockingRun = dockingRunEnabled();
const vinaPreview = vinaComparatorCapability(dockingRun);

const bootstrap: BootstrapResponse = {
  product: "Molecular Workstation",
  gate: "G1C",
  renderer: { mode: "3dmol", authoritative: true },
  capabilities: {
    "PROJECT.CREATE": { state: "SUPPORTED", label: "Supported", description: "Create an empty persisted project manifest." },
    "PROJECT.OPEN": { state: "SUPPORTED", label: "Supported", description: "Open a native immutable session revision and restore its validated workspace." },
    "PROJECT.SAVE": { state: "SUPPORTED", label: "Supported", description: "Create an immutable native SessionRevision checkpoint with integrity metadata." },
    "STRUCTURE.IMPORT": { state: "SUPPORTED", label: "Supported", description: "Import PDB or mmCIF through the authoritative backend ingestion service." },
    "STRUCTURE.FETCH_RCSB": { state: "SUPPORTED", label: "Supported", description: "Fetch official RCSB mmCIF by PDB ID and retain source provenance." },
    "STRUCTURE.EXPORT": { state: "SUPPORTED_WITH_LIMITATIONS", label: "Supported with limitations", description: "The web client provides typed PDB/mmCIF writers with exact-byte hashes and explicit loss manifests." },
    "FILE.OPEN": { state: "SUPPORTED", label: "Supported", description: "Choose a PDB or mmCIF structure file; this converges with Import and Drop." },
    "FILE.IMPORT": { state: "SUPPORTED", label: "Supported", description: "Choose a PDB or mmCIF structure file." },
    "FILE.EXPORT": { state: "SUPPORTED_WITH_LIMITATIONS", label: "Supported with limitations", description: "The web client provides typed PDB/mmCIF writers with exact-byte hashes and explicit loss manifests." },
    "SELECTION.EVALUATE": { state: "SUPPORTED", label: "Supported", description: "The web client evaluates the typed canonical selection language against the loaded molecular revision." },
    "SELECTION.CREATE_NAMED": { state: "SUPPORTED", label: "Supported", description: "The web client can create immutable named selection snapshots for the active molecular revision." },
    "DOCKING.RUN": { state: "UNAVAILABLE", label: "Unavailable", description: "The Mole docking engine is not released (gate D8). No Mole docking scores are available." },
    VINA_COMPARATOR_PREVIEW: dockingRun
      ? { state: "EXPERIMENTAL", label: "Experimental preview", description: `${vinaPreview.notice} AutoDock Vina ${vinaPreview.engine.version} comparator: implementation ${vinaPreview.implementation}, validation ${vinaPreview.validation}; results are ${vinaPreview.resultLabel}.` }
      : { state: "UNAVAILABLE", label: "Unavailable", description: vinaPreview.unavailableReason ?? "Unavailable." },
    "COMMAND.CANONICAL": { state: "SUPPORTED", label: "Supported", description: "GUI, safe console, REST, SDK and bounded macro requests converge through the versioned command registry." },
    "COMMAND.PYMOL_COMPAT": { state: "SUPPORTED_WITH_LIMITATIONS", label: "Supported with limitations", description: "The SAFE_PYMOL_COMPAT profile accepts bounded scientific syntax and rejects code/process execution." },
  },
};

const dataRoot = process.env.MOLECULAR_DATA_DIR ?? join(process.cwd(), ".molecular-data");
const uploadTempDir = join(dataRoot, "tmp", "uploads");
const remoteTempDir = join(dataRoot, "tmp", "remote");

// Uploads stream to disk in parallel, but decoding and parsing a large file holds its text and
// parse state in memory, so large files take turns: peak memory is one large parse, not two.
let largeParseQueue: Promise<unknown> = Promise.resolve();
const withParseSlot = <T>(bytes: number, run: () => Promise<T>): Promise<T> => {
  if (bytes < LARGE_STRUCTURE_WARNING_BYTES) return run();
  const turn = largeParseQueue.then(run);
  largeParseQueue = turn.catch(() => undefined);
  return turn;
};

const ingestionService = new StructureIngestionService(new SourceArtifactStore(dataRoot), { maxBytes: config.maxUploadBytes, tempDir: remoteTempDir, parseGate: withParseSlot });
const projectStore = new ProjectStore(dataRoot);
const commandDispatcher = new CommandDispatcher({ dataRoot });
const d2PreparationService = new D2PreparationService();
// Task 5.2b: preparation jobs. The TOOLS.md pin check runs here, at start-up; a mismatch fails every prep route closed.
export const prepService = createPrepService({ dataRoot });
// Task 5.5: docking jobs. With the flag off the store is never created or opened and the job routes fall through to 404.
export const dockService: DockJobService | undefined = dockingRun ? createDockJobService({ root: join(dataRoot, "dock-jobs"), prep: prepService.store }) : undefined;
let dockServiceReady: Promise<DockJobService> | undefined;
const openDockService = (): Promise<DockJobService> => {
  const service = dockService;
  if (!service) return Promise.reject(new Error("docking jobs are disabled"));
  dockServiceReady ??= service.init().then(
    () => service,
    (error: unknown) => {
      dockServiceReady = undefined; // a later request may retry (for example once a stale lock is released)
      throw error;
    },
  );
  return dockServiceReady;
};
export const dockRoutes = createDockJobRoutes({ enabled: dockingRun, service: openDockService });

// Structure transfers (uploads and RCSB fetches) share one small pool of slots; more answer 429.
let activeTransfers = 0;
const withTransferSlot = async <T>(response: ServerResponse, run: () => Promise<T>): Promise<T> => {
  if (activeTransfers >= config.maxConcurrentUploads) {
    response.setHeader("retry-after", "5");
    throw new IngestionError("SERVER_BUSY", "Too many structure transfers are in progress; try again shortly.");
  }
  activeTransfers += 1;
  try {
    return await run();
  } finally {
    activeTransfers -= 1;
  }
};

// JSON bodies share one byte budget, held until the response closes (the parsed body lives that long).
// A body reserves its declared length up front, or its bytes as they arrive; over budget answers 429.
let jsonBytesInFlight = 0;
const readJson = async (request: IncomingMessage, response: ServerResponse, maxBytes = config.maxJsonBytes): Promise<Record<string, unknown>> => {
  const tooLarge = () => new IngestionError("PAYLOAD_TOO_LARGE", "The request body exceeds the size limit.");
  assertDeclaredLength(request, maxBytes, tooLarge);
  let reserved = 0;
  let released = false;
  const reserve = (bytes: number) => {
    if (bytes <= reserved) return;
    if (jsonBytesInFlight + bytes - reserved > config.maxJsonBytesInFlight) {
      response.setHeader("retry-after", "5");
      throw new IngestionError("SERVER_BUSY", "The server is busy with other large requests; try again shortly.");
    }
    jsonBytesInFlight += bytes - reserved;
    reserved = bytes;
  };
  const release = () => {
    if (released) return;
    released = true;
    jsonBytesInFlight -= reserved;
    reserved = 0;
  };
  response.once("close", release);
  try {
    const declared = Number(request.headers["content-length"] ?? Number.NaN);
    if (Number.isInteger(declared) && declared > 0) reserve(declared);
    // Decode chunk by chunk so the raw bytes are never also held as one concatenated Buffer.
    const decoder = new StringDecoder("utf8");
    const parts: string[] = [];
    let size = 0;
    await consumeRequest(request, (chunk) => {
      size += chunk.length;
      if (size > maxBytes) throw tooLarge();
      reserve(size);
      parts.push(decoder.write(chunk));
    });
    parts.push(decoder.end());
    const text = parts.join("");
    parts.length = 0;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new IngestionError("INVALID_INPUT", "The request body was not valid JSON."); }
    return parseOr400(bodyObjectSchema, parsed, "request body");
  } catch (error) {
    release();
    throw error;
  }
};

/** Run a service call on client-supplied structures; a non-domain exception means the input shape was wrong, so answer 400. */
const malformedAs400 = <T>(message: string, run: () => T): T => {
  try {
    return run();
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw new IngestionError("INVALID_INPUT", message);
  }
};

const headerValue = (request: IncomingMessage, name: string): string | undefined => {
  const value = request.headers[name];
  return typeof value === "string" ? value : undefined;
};

const errorResponse = (response: ServerResponse, error: unknown) => {
  if (error instanceof IngestionError) {
    sendJson(response, error.status, { error: { code: error.code, message: error.message } });
    return;
  }
  console.error(error);
  sendJson(response, 500, { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } });
};

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);
const hostAllowed = (request: IncomingMessage): boolean => {
  const match = /^(\[::1\]|[a-z0-9.-]+)(?::(\d{1,5}))?$/i.exec(request.headers.host ?? "");
  if (!match || !LOCAL_HOSTNAMES.has(match[1].toLowerCase())) return false;
  return match[2] === undefined || Number(match[2]) === request.socket.localPort;
};

// Local-mode token: random per start-up, written to <tokenDir>/token (owner-only). Health stays open for liveness probes.
let localToken: Buffer | undefined = config.token ? Buffer.from(config.token, "utf8") : undefined;
const tokenValid = (request: IncomingMessage): boolean => {
  const supplied = request.headers["x-mole-token"];
  if (!localToken || typeof supplied !== "string") return false;
  const given = Buffer.from(supplied, "utf8");
  return given.length === localToken.length && timingSafeEqual(given, localToken);
};
const issueLocalToken = () => {
  const token = randomBytes(32).toString("hex");
  mkdirSync(config.tokenDir, { recursive: true });
  writeFileSync(join(config.tokenDir, "token"), token, { mode: 0o600 });
  localToken = Buffer.from(token, "utf8");
};

const route = async (request: IncomingMessage, response: ServerResponse) => {
  if (config.mode === "local" && !hostAllowed(request)) {
    sendJson(response, 403, { error: { code: "HOST_NOT_ALLOWED", message: "This host is not allowed." } });
    return;
  }
  response.setHeader("vary", "origin");
  const origin = request.headers.origin;
  if (origin !== undefined) {
    if (!config.allowedOrigins.includes(origin)) {
      sendJson(response, 403, { error: { code: "ORIGIN_NOT_ALLOWED", message: "This origin is not allowed." } });
      return;
    }
    response.setHeader("access-control-allow-origin", origin);
  }
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type,x-mole-token,x-parent-export-artifact-id,x-idempotency-key,x-correlation-id");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (!(request.method === "GET" && request.url?.split("?")[0] === "/api/health") && !tokenValid(request)) {
    sendJson(response, 401, { error: { code: "TOKEN_REQUIRED", message: "A valid API token is required." } });
    return;
  }

  try {
    let url: URL;
    try { url = new URL(request.url ?? "/", "http://localhost"); } catch { throw new IngestionError("INVALID_INPUT", "The request URL is malformed."); }
    if (request.method === "GET" && url.pathname === "/api/health") {
      sendJson(response, 200, { ...health, timestamp: new Date().toISOString() });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/bootstrap") {
      sendJson(response, 200, bootstrap);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/commands/registry") {
      sendJson(response, 200, commandDispatcher.registry());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/commands/registry") {
      sendJson(response, 200, commandDispatcher.registry());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/commands/history") {
      sendJson(response, 200, { records: commandDispatcher.history.list() });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/docking/d2/adapt") {
      const body = await readJson(request, response);
      const parsed = parseOr400(d2AdaptBodySchema, body, "D2 adaptation request");
      const result = malformedAs400("The D2 structure is malformed.", () => d2PreparationService.adaptStructure(parsed.structure as never, parsed.sourceArtifact as never));
      sendJson(response, 200, result);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/docking/d2/search-region") {
      const body = await readJson(request, response);
      const parsed = parseOr400(d2SearchRegionBodySchema, body, "D2 SearchRegion request");
      const result = malformedAs400("The D2 SearchRegion input is malformed.", () => d2PreparationService.sealSearchRegion(parsed.input as unknown as D2SearchRegionInput));
      const value = result.value as D2SearchRegionV1 | undefined;
      sendJson(response, 200, {
        status: result.status,
        diagnostics: result.diagnostics,
        ...(result.provenance ? { provenance: result.provenance } : {}),
        ...(value ? {
          value,
          presentation: {
            center: value.center.map(f64Value),
            size: value.fullExtents.map(f64Value),
            min: value.min.map(f64Value),
            max: value.max.map(f64Value),
            units: value.units,
            coordinateFrame: value.coordinateFrame,
            digest: value.digest,
          },
        } : {}),
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/commands/batch") {
      const body = await readJson(request, response);
      const parsed = parseOr400(commandBatchBodySchema, body, "batch request");
      const result = commandDispatcher.dispatchBatch({ rawCommand: parsed.rawCommand, surface: "BATCH", requestedMode: parsed.requestedMode ?? "SYNC", correlationId: parsed.correlationId ?? headerValue(request, "x-correlation-id"), idempotencyKey: parsed.idempotencyKey ?? headerValue(request, "x-idempotency-key") });
      sendJson(response, result.status === "FAILED" ? 422 : 200, result);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/commands") {
      const body = await readJson(request, response);
      const parsed = parseOr400(commandBodySchema, body, "command request");
      const result = commandDispatcher.dispatch({ rawCommand: parsed.rawCommand, command: parsed.command as unknown as CanonicalCommand | undefined, surface: parsed.surface === "CONSOLE" || parsed.surface === undefined ? "REST" : parsed.surface, requestedMode: parsed.requestedMode, correlationId: parsed.correlationId ?? headerValue(request, "x-correlation-id"), idempotencyKey: parsed.idempotencyKey ?? headerValue(request, "x-idempotency-key") });
      sendJson(response, result.status === "FAILED" ? 422 : 200, result);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/v1/commands/execute") {
      const body = await readJson(request, response);
      const parsed = parseOr400(commandExecuteBodySchema, body, "command");
      const canonicalCommand = ("command" in parsed ? parsed.command : parsed) as unknown as CanonicalCommand;
      const meta = parsed as { requestedMode?: "SYNC" | "ASYNC" | "AUTO"; correlationId?: string; idempotencyKey?: string };
      const result = commandDispatcher.dispatch({ command: canonicalCommand, surface: "REST", requestedMode: meta.requestedMode === "ASYNC" || meta.requestedMode === "AUTO" ? meta.requestedMode : "SYNC", correlationId: meta.correlationId ?? headerValue(request, "x-correlation-id"), idempotencyKey: meta.idempotencyKey ?? headerValue(request, "x-idempotency-key") });
      sendJson(response, result.status === "FAILED" ? 422 : 200, result);
      return;
    }
    const commandReplayMatch = url.pathname.match(/^\/api\/commands\/history\/([^/]+)\/replay$/);
    if (commandReplayMatch && request.method === "POST") {
      const body = await readJson(request, response);
      const id = parseOr400(pathIdSchema, decodeSegment(commandReplayMatch[1]!), "action record ID");
      const mode = parseOr400(commandReplayBodySchema, body, "replay request").mode ?? "COMMAND_REPLAY";
      sendJson(response, 200, commandDispatcher.replay(id, mode));
      return;
    }
    const commandJobMatch = url.pathname.match(/^\/api\/commands\/jobs\/([^/]+)$/);
    if (commandJobMatch && request.method === "GET") {
      const job = commandDispatcher.getJob(parseOr400(pathIdSchema, decodeSegment(commandJobMatch[1]!), "job ID"));
      if (!job) { sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Command job was not found." } }); return; }
      sendJson(response, 200, job);
      return;
    }
    const commandCancelMatch = url.pathname.match(/^\/api\/commands\/jobs\/([^/]+)\/cancel$/);
    if (commandCancelMatch && request.method === "POST") {
      const job = commandDispatcher.cancel(parseOr400(pathIdSchema, decodeSegment(commandCancelMatch[1]!), "job ID"));
      if (!job) { sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Command job was not found." } }); return; }
      sendJson(response, 200, job);
      return;
    }
    const commandRetryMatch = url.pathname.match(/^\/api\/commands\/jobs\/([^/]+)\/retry$/);
    if (commandRetryMatch && request.method === "POST") {
      const job = commandDispatcher.retry(parseOr400(pathIdSchema, decodeSegment(commandRetryMatch[1]!), "job ID"));
      if (!job) { sendJson(response, 409, { error: { code: "RETRY_UNAVAILABLE", message: "Only a failed command job with retained canonical input can be retried." } }); return; }
      sendJson(response, 200, job);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/structures/upload") {
      await withTransferSlot(response, async () => {
        const file = await receiveMultipartFile(request, { maxFileBytes: config.maxUploadBytes, tempDir: uploadTempDir });
        try {
          // Refuse by filename, then binaries (text structure formats never contain NUL), before reading anything back.
          assertLocalFilenameAdmitted(file.filename);
          if (file.binary) throw new IngestionError("UNSUPPORTED_FORMAT", "Binary files are not an admitted coordinate format.");
          const parentExportArtifactId = parseOr400(uploadHeadersSchema, { parentExportArtifactId: headerValue(request, "x-parent-export-artifact-id") }, "upload headers").parentExportArtifactId;
          const result = await withParseSlot(file.size, async () => {
            // Streaming decode + hash of the server's own temp file; the whole file is never a Buffer.
            const text = await readTextFile(file.path);
            return ingestionService.ingestLocalText(file.filename, file.path, text, parentExportArtifactId ? { parentExportArtifactId } : {});
          });
          sendJson(response, 200, result);
        } finally {
          await file.dispose();
        }
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/structures/rcsb") {
      const body = await readJson(request, response);
      const { pdbId } = parseOr400(rcsbBodySchema, body, "RCSB request");
      // The remote body streams to disk under a transfer slot and decodes under the parse slot.
      sendJson(response, 200, await withTransferSlot(response, () => ingestionService.ingestRcsb(pdbId)));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/projects") {
      const body = await readJson(request, response);
      sendJson(response, 201, await projectStore.create(parseOr400(projectCreateBodySchema, body, "project").name));
      return;
    }
    const revisionsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/revisions$/);
    if (revisionsMatch && request.method === "GET") {
      sendJson(response, 200, { revisions: await projectStore.listRevisions(parseOr400(projectIdSchema, decodeSegment(revisionsMatch[1]!), "project ID")) });
      return;
    }
    const revisionMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/revisions\/([^/]+)$/);
    if (revisionMatch && request.method === "GET") {
      sendJson(response, 200, await projectStore.open(parseOr400(projectIdSchema, decodeSegment(revisionMatch[1]!), "project ID"), parseOr400(revisionIdSchema, decodeSegment(revisionMatch[2]!), "revision ID")));
      return;
    }
    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && request.method === "GET") {
      sendJson(response, 200, await projectStore.open(parseOr400(projectIdSchema, decodeSegment(projectMatch[1]!), "project ID"), parseOr400(projectOpenQuerySchema, { revision: url.searchParams.get("revision") ?? undefined }, "query").revision));
      return;
    }
    if (projectMatch && request.method === "PUT") {
      const body = await readJson(request, response, config.maxProjectJsonBytes);
      const id = parseOr400(projectIdSchema, decodeSegment(projectMatch[1]!), "project ID");
      const save = parseOr400(projectSaveBodySchema, body, "project save request");
      sendJson(response, 200, await projectStore.save(id, save as unknown as ProjectSaveRequest));
      return;
    }
    if (await prepService.handle(request, response, url.pathname)) return;
    if (await dockRoutes(request, response, url.pathname)) return;
    sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Route was not found." } });
  } catch (error) {
    if (response.headersSent) throw error;
    errorResponse(response, error);
  }
};

// Last-resort handler: answer 500 if nothing was sent yet, otherwise drop the connection. Never rethrows.
const fail = (response: ServerResponse, error: unknown) => {
  try {
    console.error(error);
    if (!response.headersSent && !response.writableEnded) {
      sendJson(response, 500, { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } });
    } else {
      response.destroy();
    }
  } catch {
    response.destroy();
  }
};

process.on("unhandledRejection", (reason) => console.error("unhandledRejection", reason));

export const server = createServer((request, response) => {
  route(request, response).catch((error) => fail(response, error));
});

export const startServer = (port = config.port, host = config.host) =>
  new Promise<void>((resolve, reject) => {
    // Partial uploads from a previous crash are never resumed.
    rmSync(uploadTempDir, { recursive: true, force: true });
    rmSync(remoteTempDir, { recursive: true, force: true });
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, host, () => {
      server.off("error", onError);
      try {
        if (config.mode === "local") issueLocalToken();
        // Crash recovery runs at start-up (not on the first request) when the flag is on.
        if (dockService) openDockService().catch((error: unknown) => console.error("docking job store unavailable:", error instanceof Error ? error.message : "unknown"));
      } catch (error) {
        server.close();
        reject(error);
        return;
      }
      console.log(`Molecular API (${config.mode}) listening on http://${host}:${port}`);
      resolve();
    });
  });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((error: unknown) => {
    console.error("Molecular API failed to start:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
