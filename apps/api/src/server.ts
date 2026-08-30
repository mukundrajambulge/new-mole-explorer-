import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { BootstrapResponse, HealthResponse } from "@molecular/contracts";
import { IngestionError, StructureIngestionService } from "./structures/ingestion.js";
import { parseMultipartFile } from "./structures/multipart.js";

const port = Number(process.env.API_PORT ?? 4310);

const sendJson = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  response.end(JSON.stringify(body));
};

const health: HealthResponse = {
  service: "molecular-api",
  status: "ok",
  gate: "G0",
  timestamp: new Date().toISOString(),
};

const bootstrap: BootstrapResponse = {
  product: "Molecular Workstation",
  gate: "G0",
  renderer: { mode: "3dmol", authoritative: true },
  capabilities: {
    "FILE.OPEN": {
      state: "COMING_SOON",
      label: "Coming Soon",
      description: "Project and structure loading will arrive in a future gate.",
    },
    "SELECTION.EVALUATE": {
      state: "COMING_SOON",
      label: "Coming Soon",
      description: "Authoritative selection evaluation is not wired in G0.",
    },
    "DOCKING.RUN": {
      state: "UNAVAILABLE",
      label: "Unavailable",
      description: "No docking engine or scores are available in this foundation.",
    },
  },
};

const ingestionService = new StructureIngestionService();

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
  sendJson(response, 500, { error: { code: "INTERNAL_ERROR", message: "The structure could not be loaded." } });
};

const route = async (request: IncomingMessage, response: ServerResponse) => {
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (request.method === "GET" && request.url === "/api/health") {
      sendJson(response, 200, { ...health, timestamp: new Date().toISOString() });
      return;
    }
    if (request.method === "GET" && request.url === "/api/bootstrap") {
      sendJson(response, 200, bootstrap);
      return;
    }
    if (request.method === "POST" && request.url === "/api/structures/upload") {
      const file = await parseMultipartFile(request);
      sendJson(response, 200, await ingestionService.ingestLocal(file.filename, file.data));
      return;
    }
    if (request.method === "POST" && request.url === "/api/structures/rcsb") {
      const body = await readJson(request);
      if (typeof body.pdbId !== "string") throw new IngestionError("INVALID_INPUT", "A PDB ID is required.");
      sendJson(response, 200, await ingestionService.ingestRcsb(body.pdbId));
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
