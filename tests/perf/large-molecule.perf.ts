// Baseline performance of the web app on 4V6F (~300k atoms).
// 4V6F is not in Git. Provide it with PERF_4V6F=<path>, or place it at tests/fixtures/rcsb/4V6F.cif
// (written by the fixture fetch script). Results: test-results/perf/large-molecule-<label>.json
// Run with playwright config tests/perf/playwright.perf.config.ts; PERF_LABEL names the run (baseline, after).
import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const candidates = [process.env.PERF_4V6F, "tests/fixtures/rcsb/4V6F.cif"].filter(Boolean) as string[];
const fixture = candidates.map((p) => resolve(p)).find((p) => existsSync(p));
const label = process.env.PERF_LABEL ?? "baseline";

const stats = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
  return { n: s.length, min: s[0] ?? 0, median: q(0.5), p95: q(0.95), max: s[s.length - 1] ?? 0, mean: s.reduce((a, b) => a + b, 0) / (s.length || 1) };
};
const heapMb = (page: Page) => page.evaluate(() => {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return m ? Math.round((m.usedJSHeapSize / 1048576) * 10) / 10 : null;
});
const now = (page: Page) => page.evaluate(() => performance.now());
const twoFrames = (page: Page) => page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
// Wall time of an action including the next two frames, so rendering cost is counted.
const timed = async (page: Page, fn: () => Promise<unknown>) => {
  const t0 = await now(page);
  await fn();
  await twoFrames(page);
  return (await now(page)) - t0;
};

test("4V6F performance baseline", async ({ page }) => {
  if (!fixture) throw new Error("4V6F fixture missing: set PERF_4V6F or place it at tests/fixtures/rcsb/4V6F.cif");
  const results: Record<string, unknown> = { schemaVersion: 1, label, date: new Date().toISOString(), fixture: "4V6F" };
  // Profiler for 3.2: count JSON.stringify calls (and output size) in the page during the hover phase.
  await page.addInitScript(() => {
    const w = window as unknown as { __jsonStats: { calls: number; chars: number; large: number } };
    w.__jsonStats = { calls: 0, chars: 0, large: 0 };
    const original = JSON.stringify;
    JSON.stringify = function (this: unknown, ...args: Parameters<typeof JSON.stringify>) {
      const out = original.apply(this, args);
      w.__jsonStats.calls += 1;
      const n = typeof out === "string" ? out.length : 0;
      w.__jsonStats.chars += n;
      if (n > 100_000) w.__jsonStats.large += 1;
      return out;
    } as typeof JSON.stringify;
  });
  const jsonStats = () => page.evaluate(() => ({ ...(window as unknown as { __jsonStats: { calls: number; chars: number; large: number } }).__jsonStats }));
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  const viewer = page.getByTestId("molecular-viewer");
  results.loadMs = await timed(page, async () => {
    await page.locator('input[type="file"]').setInputFiles(fixture!);
    await expect(viewer).toHaveAttribute("data-viewer-state", "loaded", { timeout: 300_000 });
  });
  results.atoms = Number(await viewer.getAttribute("data-canonical-atom-count"));
  results.heapAfterLoadMb = await heapMb(page);

  await page.getByRole("button", { name: "Expand console", exact: true }).click();
  const command = page.getByRole("textbox", { name: "Command or selection query" });
  const consoleRegion = page.getByRole("region", { name: "Command console" });
  const runTimed = async (text: string, expected: string) => {
    const t0 = await now(page);
    await command.fill(text);
    await page.getByRole("button", { name: /Run/ }).click();
    await expect(consoleRegion).toContainText(expected, { timeout: 120_000 });
    await twoFrames(page);
    return (await now(page)) - t0;
  };
  results.selectChainAMs = await runTimed("select chain A", "Selected");
  results.colorRedChainAMs = await runTimed("color red, chain A", "Applied");

  // 50 hovers over the canvas with chain A selected.
  const box = (await viewer.boundingBox())!;
  const hover: number[] = [];
  const jsonBeforeHover = await jsonStats();
  for (let i = 0; i < 50; i++) {
    const x = box.x + box.width * (0.3 + (0.4 * ((i * 37) % 50)) / 50);
    const y = box.y + box.height * (0.3 + (0.4 * ((i * 53) % 50)) / 50);
    hover.push(await timed(page, () => page.mouse.move(x, y)));
  }
  results.hoverMs = stats(hover);
  // hoverMs above measures mouse-move cost only: 3Dmol fires hover callbacks after the pointer rests
  // ~500 ms (default hover duration), so those moves never change hover state. Dwell phase: rest
  // 800 ms on 20 points so hover state really changes, and count serialization while it does.
  const dwell: number[] = [];
  for (let i = 0; i < 20; i++) {
    const x = box.x + box.width * (0.35 + (0.3 * ((i * 7) % 20)) / 20);
    const y = box.y + box.height * (0.35 + (0.3 * ((i * 11) % 20)) / 20);
    dwell.push(await timed(page, async () => { await page.mouse.move(x, y); await page.waitForTimeout(800); }));
  }
  results.hoverDwellMs = stats(dwell);
  const jsonAfterHover = await jsonStats();
  results.hoverJsonStringify = { calls: jsonAfterHover.calls - jsonBeforeHover.calls, chars: jsonAfterHover.chars - jsonBeforeHover.chars, largeCalls: jsonAfterHover.large - jsonBeforeHover.large };

  // 10 tab switches between rail panels.
  const names = ["Display panel", "Analyze panel"];
  const tabs: number[] = [];
  for (let i = 0; i < 10; i++) {
    const btn = page.getByRole("button", { name: names[i % 2], exact: true });
    await expect(btn).toBeVisible();
    tabs.push(await timed(page, () => btn.click()));
  }
  expect(tabs).toHaveLength(10);
  results.tabSwitchMs = stats(tabs);
  results.viewerStateAfterTabs = await viewer.getAttribute("data-viewer-state");
  results.heapEndMb = await heapMb(page);

  const dir = resolve("test-results/perf");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `large-molecule-${label}.json`), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results));
});
