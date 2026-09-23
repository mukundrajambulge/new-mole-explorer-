import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: 1,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:3108", trace: "on-first-retry" },
  webServer: [
    { command: "npm run dev:api", url: "http://127.0.0.1:18114/api/health", reuseExistingServer: true, timeout: 120_000, env: { API_PORT: "18114" } },
    { command: "npm run dev --workspace @molecular/web -- --host 127.0.0.1 --port 3108", url: "http://127.0.0.1:3108", reuseExistingServer: true, timeout: 120_000, env: { VITE_API_BASE_URL: "http://127.0.0.1:18114/api" } },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
