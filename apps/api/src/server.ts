import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { BootstrapResponse, HealthResponse, ProjectSaveRequest } from "@molecular/contracts";
import { IngestionError, StructureIngestionService } from "./structures/ingestion.js";
import { parseMultipartFile } from "./structures/multipart.js";
import { ProjectStore } from "./projects/projectStore.js";

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
    "PROJECT.OPEN": { state: "SUPPORTED", label: "Supported", description: "Open a previously saved project manifest and restore its canonical structure and presentation." },
    "PROJECT.SAVE": { state: "SUPPORTED", label: "Supported", description: "Persist the current canonical structure, provenance and presentation snapshot." },
    "STRUCTURE.IMPORT": { state: "SUPPORTED", label: "Supported", description: "Import PDB or mmCIF through the authoritative backend ingestion service." },
    "STRUCTURE.FETCH_RCSB": { state: "SUPPORTED", label: "Supported", description: "Fetch official RCSB mmCIF by PDB ID and retain source provenance." },
    "STRUCTURE.EXPORT": { state: "COMING_SOON", label: "Coming Soon", description: "Export writers and loss manifests are not implemented in G1B; no fake download is provided." },
    "FILE.OPEN": { state: "SUPPORTED", label: "Supported", description: "Choose a PDB or mmCIF structure file; this converges with Import and Drop." },
    "FILE.IMPORT": { state: "SUPPORTED", label: "Supported", description: "Choose a PDB or mmCIF structure file." },
    "FILE.EXPORT": { state: "COMING_SOON", label: "Coming Soon", description: "Export is not implemented in G1B." },
    "SELECTION.EVALUATE": { state: "SUPPORTED", label: "Supported", description: "The web client evaluates the typed canonical selection language against the loaded molecular revision." },
    "SELECTION.CREATE_NAMED": { state: "SUPPORTED", label: "Supported", description: "The web client can create immutable named selection snapshots for the active molecular revision." },
    "DOCKING.RUN": { state: "UNAVAILABLE", label: "Unavailable", description: "No docking engine or scores are available in this foundation." },
  },
};

const ingestionService = new StructureIngestionService();
const projectStore = new ProjectStore();

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
  response.setHeader("access-control-allow-headers", "content-type");
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
    if (request.method === "POST" && url.pathname === "/api/structures/upload") {
      const file = await parseMultipartFile(request);
      sendJson(response, 200, await ingestionService.ingestLocal(file.filename, file.data));
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
    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && request.method === "GET") {
      sendJson(response, 200, await projectStore.open(projectMatch[1]));
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
