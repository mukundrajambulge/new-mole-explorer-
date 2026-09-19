import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import type { BootstrapResponse, HealthResponse, ProjectSaveRequest } from "@molecular/contracts";
import { IngestionError, StructureIngestionService } from "./structures/ingestion.js";
import { parseMultipartFile } from "./structures/multipart.js";
import { ProjectStore } from "./projects/projectStore.js";
import { readJsonBody } from "./http/body.js";

const port = Number(process.env.API_PORT ?? 8100);
const defaultHost = process.env.API_HOST ?? "127.0.0.1";
const defaultCorsOrigins = ["http://localhost:3100", "http://127.0.0.1:3100", "http://localhost:3101", "http://127.0.0.1:3101"];
const parseCorsOrigins = (value = process.env.API_CORS_ORIGINS): ReadonlySet<string> => new Set((value ? value.split(",") : defaultCorsOrigins).map((origin) => origin.trim()).filter(Boolean));

const sendJson = (response: ServerResponse, status: number, body: unknown, origin?: string) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "vary": "Origin", ...(origin ? { "access-control-allow-origin": origin } : {}) });
  response.end(JSON.stringify(body));
};

const health: HealthResponse = { service: "molecular-api", status: "ok", gate: "G1C", timestamp: new Date().toISOString() };
const bootstrap: BootstrapResponse = {
  product: "Molecular Workstation", gate: "G1C", renderer: { mode: "3dmol", authoritative: true },
  capabilities: {
    "PROJECT.CREATE": { state: "SUPPORTED", label: "Supported", description: "Create an empty persisted project manifest." },
    "PROJECT.OPEN": { state: "SUPPORTED", label: "Supported", description: "Open a previously saved project manifest and restore its canonical structure and presentation." },
    "PROJECT.SAVE": { state: "SUPPORTED", label: "Supported", description: "Persist the current canonical structure, provenance and presentation snapshot." },
    "STRUCTURE.IMPORT": { state: "SUPPORTED", label: "Supported", description: "Import PDB or mmCIF through the authoritative backend ingestion service." },
    "STRUCTURE.FETCH_RCSB": { state: "SUPPORTED", label: "Supported", description: "Fetch official RCSB mmCIF by PDB ID and retain source provenance." },
    "STRUCTURE.EXPORT": { state: "COMING_SOON", label: "Coming Soon", description: "Export writers and loss manifests are not implemented in G1C; no fake download is provided." },
    "FILE.OPEN": { state: "SUPPORTED", label: "Supported", description: "Choose a PDB or mmCIF structure file; this converges with Import and Drop." },
    "FILE.IMPORT": { state: "SUPPORTED", label: "Supported", description: "Choose a PDB or mmCIF structure file." },
    "FILE.EXPORT": { state: "COMING_SOON", label: "Coming Soon", description: "Export is not implemented in G1C." },
    "SELECTION.EVALUATE": { state: "COMING_SOON", label: "Coming Soon", description: "Authoritative selection evaluation is reserved for a later gate." },
    "DOCKING.RUN": { state: "UNAVAILABLE", label: "Unavailable", description: "No docking engine or scores are available in this foundation." },
  },
};

const errorResponse = (response: ServerResponse, error: unknown, origin?: string) => {
  if (error instanceof IngestionError) {
    sendJson(response, error.status, { error: { code: error.code, message: error.message } }, origin);
    return;
  }
  console.error(error);
  sendJson(response, 500, { error: { code: "INTERNAL_ERROR", message: "The request could not be completed." } }, origin);
};

export type ApiServerOptions = { dataRoot?: string; host?: string; allowedOrigins?: readonly string[] };

export const createApiServer = (options: ApiServerOptions = {}): Server => {
  const allowedOrigins = new Set(options.allowedOrigins ?? parseCorsOrigins());
  const ingestionService = new StructureIngestionService();
  const projectStore = new ProjectStore(options.dataRoot);
  const route = async (request: IncomingMessage, response: ServerResponse) => {
    const requestOrigin = typeof request.headers.origin === "string" ? request.headers.origin : undefined;
    if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
      sendJson(response, 403, { error: { code: "CORS_ORIGIN_REJECTED", message: "The request origin is not allowed." } });
      return;
    }
    if (requestOrigin) response.setHeader("access-control-allow-origin", requestOrigin);
    response.setHeader("vary", "Origin");
    response.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type");
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/api/health") { sendJson(response, 200, { ...health, timestamp: new Date().toISOString() }, requestOrigin); return; }
      if (request.method === "GET" && url.pathname === "/api/bootstrap") { sendJson(response, 200, bootstrap, requestOrigin); return; }
      if (request.method === "POST" && url.pathname === "/api/structures/upload") {
        const file = await parseMultipartFile(request); sendJson(response, 200, await ingestionService.ingestLocal(file.filename, file.data), requestOrigin); return;
      }
      if (request.method === "POST" && url.pathname === "/api/structures/rcsb") {
        const body = await readJsonBody(request); if (typeof body.pdbId !== "string") throw new IngestionError("INVALID_INPUT", "A PDB ID is required.");
        sendJson(response, 200, await ingestionService.ingestRcsb(body.pdbId), requestOrigin); return;
      }
      if (request.method === "POST" && url.pathname === "/api/projects") {
        const body = await readJsonBody(request); sendJson(response, 201, await projectStore.create(typeof body.name === "string" ? body.name : undefined), requestOrigin); return;
      }
      const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
      if (projectMatch && request.method === "GET") { sendJson(response, 200, await projectStore.open(projectMatch[1]!), requestOrigin); return; }
      if (projectMatch && request.method === "PUT") {
        const body = await readJsonBody(request); sendJson(response, 200, await projectStore.save(projectMatch[1]!, body as unknown as ProjectSaveRequest), requestOrigin); return;
      }
      sendJson(response, 404, { error: "NOT_FOUND" }, requestOrigin);
    } catch (error) {
      errorResponse(response, error, requestOrigin);
    }
  };
  return createServer(route);
};

export const startApiServer = (options: ApiServerOptions = {}): Server => {
  const server = createApiServer(options);
  const bindHost = options.host ?? defaultHost;
  server.listen(port, bindHost, () => console.log(`Molecular API listening on http://${bindHost}:${port}`));
  return server;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === fileURLToPath(`file://${process.argv[1].replace(/\\/g, "/")}`)) startApiServer();
