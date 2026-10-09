import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Docking wizard against the 5.0 MOCK job server (task 5.7c). Its own stack (API :8111, web :3111 built with
// VITE_DOCKING_MOCK=1 so the mock client and its MOCK banner are used); the spec forwards /api/docking/** to an
// in-process mock. Never touches a developer's :8100/:3101 servers or data.
//   npx playwright test -c playwright.docking-mock.config.ts
const dataDir = resolve("test-results", "docking-mock-data");
const tokenDir = resolve(dataDir, ".mole");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["docking-wizard-mock.spec.ts"],
  workers: 1,
  reporter: "list",
  outputDir: "test-results/playwright-docking-mock",
  use: { baseURL: "http://localhost:3111", trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: [
    { command: "npm run dev --workspace @molecular/api", url: "http://localhost:8111/api/health", reuseExistingServer: false, timeout: 120_000, env: { API_PORT: "8111", ALLOWED_ORIGINS: "http://localhost:3111", MOLECULAR_DATA_DIR: dataDir, MOLE_TOKEN_DIR: tokenDir } },
    { command: "npm run dev --workspace @molecular/web -- --port 3111", url: "http://localhost:3111", reuseExistingServer: false, timeout: 120_000, env: { VITE_DOCKING_MOCK: "1", MOLE_API_PROXY_TARGET: "http://localhost:8111", MOLE_TOKEN_DIR: tokenDir } },
  ],
});
