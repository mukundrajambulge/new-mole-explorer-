import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.perf\.ts/,
  workers: 1,
  reporter: "list",
  timeout: 600_000,
  use: { baseURL: "http://localhost:3101" },
  webServer: [
    { command: "npm run dev:api", url: "http://localhost:8100/api/health", reuseExistingServer: true, timeout: 120_000 },
    { command: "npm run dev:web", url: "http://localhost:3101", reuseExistingServer: true, timeout: 120_000 },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--enable-precise-memory-info"] } } }],
});
