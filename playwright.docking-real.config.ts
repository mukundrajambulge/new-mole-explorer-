import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Docking wizard against the REAL API with the Vina comparator preview on (task 5.7c). Gated: MOLE_DOCK_E2E=1 and
// WSL Ubuntu-24.04 with ~/mole-prep and ~/mole-tools/vina. Its own stack (API :8110, web :3112, data under
// test-results/) so it never touches a developer's :8100/:3101 servers or data.
//   MOLE_DOCK_E2E=1 npx playwright test -c playwright.docking-real.config.ts
const enabled = process.env.MOLE_DOCK_E2E === "1";
const dataDir = resolve("test-results", "docking-real-data");
const tokenDir = resolve(dataDir, ".mole");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["docking-wizard-real.spec.ts"],
  workers: 1,
  reporter: "list",
  outputDir: "test-results/playwright-docking-real",
  use: { baseURL: "http://localhost:3112", trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: enabled
    ? [
        { command: "npm run dev --workspace @molecular/api", url: "http://localhost:8110/api/health", reuseExistingServer: false, timeout: 120_000, env: { FEATURE_DOCKING_RUN: "1", API_PORT: "8110", ALLOWED_ORIGINS: "http://localhost:3112",MOLECULAR_DATA_DIR: dataDir, MOLE_TOKEN_DIR: tokenDir } },
        { command: "npm run dev --workspace @molecular/web -- --port 3112", url: "http://localhost:3112", reuseExistingServer: false, timeout: 120_000, env: { MOLE_API_PROXY_TARGET: "http://localhost:8110", MOLE_TOKEN_DIR: tokenDir } },
      ]
    : [],
});
