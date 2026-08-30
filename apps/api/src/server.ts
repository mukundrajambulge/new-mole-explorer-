import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { BootstrapResponse, HealthResponse } from "@molecular/contracts";

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
  renderer: { mode: "projection-preview", authoritative: false },
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

const route = (request: IncomingMessage, response: ServerResponse) => {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "METHOD_NOT_ALLOWED" });
    return;
  }

  switch (request.url) {
    case "/api/health":
      sendJson(response, 200, { ...health, timestamp: new Date().toISOString() });
      return;
    case "/api/bootstrap":
      sendJson(response, 200, bootstrap);
      return;
    default:
      sendJson(response, 404, { error: "NOT_FOUND" });
  }
};

createServer(route).listen(port, () => {
  console.log(`Molecular API listening on http://localhost:${port}`);
});
