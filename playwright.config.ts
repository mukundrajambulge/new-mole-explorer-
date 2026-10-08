import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Real 3Dmol surface generation is GPU/memory intensive. A single browser
  // worker keeps the complete visual suite deterministic on the supported
  // local runner; focused suites can still override this when appropriate.
  workers: 1,
  reporter: "list",
  // Playwright wipes outputDir on start; keep it off test-results/ so sprint-logs and evidence survive.
  outputDir: "test-results/playwright",
  use: { baseURL: "http://localhost:3101", trace: "on-first-retry" },
  webServer: [
    { command: "npm run dev:api", url: "http://localhost:8100/api/health", reuseExistingServer: true, timeout: 120_000 },
    { command: "npm run dev:web", url: "http://localhost:3101", reuseExistingServer: true, timeout: 120_000 },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Fast offline subset used by `node scripts/sprint/check.mjs --smoke`.
    {
      name: "smoke",
      testMatch: ["p0-boot-runtime.spec.ts", "g0.spec.ts", "real-structure-workspace.spec.ts"],
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
