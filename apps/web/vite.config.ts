import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Local mode: the API writes a random token to <repo>/.mole/token at start-up.
// Read it per request so the start order of web and API does not matter.
const tokenFile = process.env.MOLE_TOKEN_DIR ? `${process.env.MOLE_TOKEN_DIR}/token` : fileURLToPath(new URL("../../.mole/token", import.meta.url));
const readToken = (): string | undefined => {
  if (process.env.MOLE_TOKEN) return process.env.MOLE_TOKEN;
  try {
    return readFileSync(tokenFile, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3101,
    strictPort: true,
    proxy: {
      "/api": {
        // MOLE_API_PROXY_TARGET: a second local API (e.g. the FEATURE_DOCKING_RUN=1 e2e stack on :8110).
        target: process.env.MOLE_API_PROXY_TARGET || "http://localhost:8100",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            const token = readToken();
            if (token) proxyReq.setHeader("x-mole-token", token);
          });
        },
      },
    },
  },
});
