import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const port = Number(process.env.LANDING_PORT ?? 3100);
const root = path.dirname(fileURLToPath(import.meta.url));
const index = await readFile(path.join(root, "index.html"), "utf8");

createServer((request, response) => {
  if (request.method !== "GET") {
    response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(index);
}).listen(port, "127.0.0.1", () => {
  console.log(`Molecular landing app listening on http://localhost:${port}`);
});
