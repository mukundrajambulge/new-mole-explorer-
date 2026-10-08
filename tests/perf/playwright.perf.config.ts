import { defineConfig, devices } from "@playwright/test";

// PERF_WEB_PORT gives a run its own dev server: another worktree may already hold :3101 and
// reuseExistingServer would then silently measure that worktree's code.
const webPort = Number(process.env.PERF_WEB_PORT ?? 3101);

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.perf\.ts/,
  workers: 1,
  reporter: "list",
  timeout: 600_000,
  use: { baseURL: `http://localhost:${webPort}` },
  webServer: [
    { command: "npm run dev:api", url: "http://localhost:8100/api/health", reuseExistingServer: true, timeout: 120_000 },
    { command: `npm run dev --workspace @molecular/web -- --port ${webPort}`, url: `http://localhost:${webPort}`, reuseExistingServer: webPort === 3101, timeout: 120_000 },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--enable-precise-memory-info"] } } }],
});
