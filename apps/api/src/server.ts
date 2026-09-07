import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import type { BootstrapResponse, CanonicalCommand, HealthResponse, ProjectSaveRequest } from "@molecular/contracts";
import { IngestionError, StructureIngestionService } from "./structures/ingestion.js";
import { parseMultipartFile } from "./structures/multipart.js";
import { ProjectStore } from "./projects/projectStore.js";
import { SourceArtifactStore } from "./lifecycle/sourceArtifactStore.js";
import { CommandDispatcher } from "./command/dispatcher.js";

const port = Number(process.env.API_PORT ?? 8100);

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" });
  response.end(JSON.stringify(body));
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

const readJson = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
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

const route = async (request: IncomingMessage, response: ServerResponse) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type,x-parent-export-artifact-id,x-idempotency-key,x-correlation-id");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
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
    sendJson(response, 404, { error: "NOT_FOUND" });
  } catch (error) {
    errorResponse(response, error);
  }
};

createServer(route).listen(port, () => {
  console.log(`Molecular API listening on http://localhost:${port}`);
});
