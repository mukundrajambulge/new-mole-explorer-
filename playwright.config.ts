import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Real 3Dmol surface generation is GPU/memory intensive; two contexts keep
  // the visual suite deterministic on the supported local runner.
  workers: 2,
  reporter: "list",
  use: { baseURL: "http://localhost:3101", trace: "on-first-retry" },
  webServer: [
    { command: "npm run dev:api", url: "http://localhost:8100/api/health", reuseExistingServer: true, timeout: 120_000 },
    { command: "npm run dev:web", url: "http://localhost:3101", reuseExistingServer: true, timeout: 120_000 },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
