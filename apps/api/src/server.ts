import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { f64Value, type BootstrapResponse, type CanonicalCommand, type D2SearchRegionV1, type HealthResponse, type ProjectSaveRequest } from "@molecular/contracts";
import { IngestionError, StructureIngestionService } from "./structures/ingestion.js";
import { parseMultipartFile } from "./structures/multipart.js";
import { ProjectStore } from "./projects/projectStore.js";
import { SourceArtifactStore } from "./lifecycle/sourceArtifactStore.js";
import { CommandDispatcher } from "./command/dispatcher.js";
import { profileMark, profileTransport } from "./structures/ingestionProfiler.js";
import { D2PreparationService } from "./docking/d2PreparationService.js";
import type { D2SearchRegionInput } from "./docking/d2Preparation.js";

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
    "DOCKING.RUN": { state: "UNAVAILABLE", label: "Unavailable", description: "No docking engine or scores are available in this foundation." },
    "COMMAND.CANONICAL": { state: "SUPPORTED", label: "Supported", description: "GUI, safe console, REST, SDK and bounded macro requests converge through the versioned command registry." },
    "COMMAND.PYMOL_COMPAT": { state: "SUPPORTED_WITH_LIMITATIONS", label: "Supported with limitations", description: "The SAFE_PYMOL_COMPAT profile accepts bounded scientific syntax and rejects code/process execution." },
  },
};

const dataRoot = process.env.MOLECULAR_DATA_DIR ?? join(process.cwd(), ".molecular-data");
const ingestionService = new StructureIngestionService(new SourceArtifactStore(dataRoot));
const projectStore = new ProjectStore(dataRoot);
const commandDispatcher = new CommandDispatcher({ dataRoot });
const d2PreparationService = new D2PreparationService();

const readJson = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const tooLarge = () => new IngestionError("PAYLOAD_TOO_LARGE", "The request body exceeds the size limit.");
  if (Number(request.headers["content-length"] ?? 0) > config.maxJsonBytes) throw tooLarge();
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > config.maxJsonBytes) throw tooLarge();
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new IngestionError("INVALID_INPUT", "The request body was not valid JSON.");
  }
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
let localToken: Buffer | undefined;
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
  if (config.mode === "local" && !(request.method === "GET" && request.url?.split("?")[0] === "/api/health") && !tokenValid(request)) {
    sendJson(response, 401, { error: { code: "TOKEN_REQUIRED", message: "A valid local API token is required." } });
    return;
  }

  try {
    const url = new URL(request.url ?? "/", "http://localhost");
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
      const body = await readJson(request);
      if (!body.structure || typeof body.structure !== "object") throw new IngestionError("INVALID_INPUT", "D2 adaptation requires a canonical structure.");
      const result = d2PreparationService.adaptStructure(body.structure as never, body.sourceArtifact && typeof body.sourceArtifact === "object" ? body.sourceArtifact as never : undefined);
      sendJson(response, 200, result);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/docking/d2/search-region") {
      const body = await readJson(request);
      if (!body.input || typeof body.input !== "object") throw new IngestionError("INVALID_INPUT", "D2 SearchRegion commit requires an explicit preparation input.");
      const result = d2PreparationService.sealSearchRegion(body.input as unknown as D2SearchRegionInput);
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
      const body = await readJson(request);
      if (typeof body.rawCommand !== "string") throw new IngestionError("INVALID_INPUT", "A bounded batch requires rawCommand text.");
      const result = commandDispatcher.dispatchBatch({ rawCommand: body.rawCommand, surface: "BATCH", requestedMode: body.requestedMode === "ASYNC" || body.requestedMode === "AUTO" ? body.requestedMode : "SYNC", correlationId: typeof body.correlationId === "string" ? body.correlationId : request.headers["x-correlation-id"]?.toString(), idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : request.headers["x-idempotency-key"]?.toString() });
      sendJson(response, result.status === "FAILED" ? 422 : 200, result);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/commands") {
      const body = await readJson(request);
      const rawCommand = typeof body.rawCommand === "string" ? body.rawCommand : undefined;
      const canonicalCommand = body.command && typeof body.command === "object" ? body.command as unknown as CanonicalCommand : undefined;
      const requestedMode = body.requestedMode === "ASYNC" || body.requestedMode === "AUTO" ? body.requestedMode : body.requestedMode === "SYNC" ? "SYNC" : undefined;
      const result = commandDispatcher.dispatch({ rawCommand, command: canonicalCommand, surface: body.surface === "GUI" || body.surface === "SDK" || body.surface === "MACRO" || body.surface === "BATCH" ? body.surface : "REST", requestedMode, correlationId: typeof body.correlationId === "string" ? body.correlationId : request.headers["x-correlation-id"]?.toString(), idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : request.headers["x-idempotency-key"]?.toString() });
      sendJson(response, result.status === "FAILED" ? 422 : 200, result);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/v1/commands/execute") {
      const body = await readJson(request);
      const canonicalCommand = body.command && typeof body.command === "object" ? body.command as unknown as CanonicalCommand : body.commandType ? body as unknown as CanonicalCommand : undefined;
      const result = commandDispatcher.dispatch({ command: canonicalCommand, surface: "REST", requestedMode: body.requestedMode === "ASYNC" || body.requestedMode === "AUTO" ? body.requestedMode : "SYNC", correlationId: typeof body.correlationId === "string" ? body.correlationId : request.headers["x-correlation-id"]?.toString(), idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : request.headers["x-idempotency-key"]?.toString() });
      sendJson(response, result.status === "FAILED" ? 422 : 200, result);
      return;
    }
    const commandReplayMatch = url.pathname.match(/^\/api\/commands\/history\/([^/]+)\/replay$/);
    if (commandReplayMatch && request.method === "POST") {
      const body = await readJson(request);
      const mode = body.mode === "REVIEW" || body.mode === "REPRODUCTION_ATTEMPT" ? body.mode : "COMMAND_REPLAY";
      sendJson(response, 200, commandDispatcher.replay(decodeURIComponent(commandReplayMatch[1]!), mode));
      return;
    }
    const commandJobMatch = url.pathname.match(/^\/api\/commands\/jobs\/([^/]+)$/);
    if (commandJobMatch && request.method === "GET") {
      const job = commandDispatcher.getJob(decodeURIComponent(commandJobMatch[1]!));
      if (!job) { sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Command job was not found." } }); return; }
      sendJson(response, 200, job);
      return;
    }
    const commandCancelMatch = url.pathname.match(/^\/api\/commands\/jobs\/([^/]+)\/cancel$/);
    if (commandCancelMatch && request.method === "POST") {
      const job = commandDispatcher.cancel(decodeURIComponent(commandCancelMatch[1]!));
      if (!job) { sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Command job was not found." } }); return; }
      sendJson(response, 200, job);
      return;
    }
    const commandRetryMatch = url.pathname.match(/^\/api\/commands\/jobs\/([^/]+)\/retry$/);
    if (commandRetryMatch && request.method === "POST") {
      const job = commandDispatcher.retry(decodeURIComponent(commandRetryMatch[1]!));
      if (!job) { sendJson(response, 409, { error: { code: "RETRY_UNAVAILABLE", message: "Only a failed command job with retained canonical input can be retried." } }); return; }
      sendJson(response, 200, job);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/structures/upload") {
      const file = await parseMultipartFile(request);
      const parentExportArtifactId = typeof request.headers["x-parent-export-artifact-id"] === "string" ? request.headers["x-parent-export-artifact-id"] : undefined;
      sendJson(response, 200, await ingestionService.ingestLocal(file.filename, file.data, parentExportArtifactId ? { parentExportArtifactId } : {}));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/structures/rcsb") {
      const body = await readJson(request);
      if (typeof body.pdbId !== "string") throw new IngestionError("INVALID_INPUT", "A PDB ID is required.");
      sendJson(response, 200, await ingestionService.ingestRcsb(body.pdbId));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/projects") {
      const body = await readJson(request);
      sendJson(response, 201, await projectStore.create(typeof body.name === "string" ? body.name : undefined));
      return;
    }
    const revisionsMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/revisions$/);
    if (revisionsMatch && request.method === "GET") {
      sendJson(response, 200, { revisions: await projectStore.listRevisions(revisionsMatch[1]!) });
      return;
    }
    const revisionMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/revisions\/([^/]+)$/);
    if (revisionMatch && request.method === "GET") {
      sendJson(response, 200, await projectStore.open(revisionMatch[1]!, revisionMatch[2]!));
      return;
    }
    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && request.method === "GET") {
      sendJson(response, 200, await projectStore.open(projectMatch[1], url.searchParams.get("revision") ?? undefined));
      return;
    }
    if (projectMatch && request.method === "PUT") {
      const body = await readJson(request);
      sendJson(response, 200, await projectStore.save(projectMatch[1], body as unknown as ProjectSaveRequest));
      return;
    }
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
  new Promise<void>((resolve) => {
    if (config.mode === "local") issueLocalToken();
    server.listen(port, host, () => {
      console.log(`Molecular API (${config.mode}) listening on http://${host}:${port}`);
      resolve();
    });
  });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void startServer();
