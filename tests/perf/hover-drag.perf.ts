// 3.4 regression: rotating 4V6F after the pointer rested on the molecule froze the page.
// Root cause: once 3Dmol has an active hover (current_hover != null), its mousemove handler raycasts
// every hoverable atom (handleHoverContinue, ~180 ms on 307k atoms) before its drag check, on every
// move while dragging; a hover timer then raycasts again (handleHoverSelection).
// This test dwells until a hover is active, then drags with the button held. It is CPU-bound, so it
// runs under headless software GL: per-move cost is measured as mousemove handling time minus the
// time spent in 3Dmol's show() (the GPU draw), which is reported separately.
// Fixture: PERF_4V6F=<path> or tests/fixtures/rcsb/4V6F.cif (node scripts/fetch-fixtures.mjs).
// Run with tests/perf/playwright.perf.config.ts. Results: test-results/perf/hover-drag-<label>.json
import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const candidates = [process.env.PERF_4V6F, "tests/fixtures/rcsb/4V6F.cif"].filter(Boolean) as string[];
const fixture = candidates.map((p) => resolve(p)).find((p) => existsSync(p));
const label = process.env.PERF_LABEL ?? "after";

const stats = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
  return { n: s.length, min: s[0] ?? 0, median: q(0.5), p95: q(0.95), max: s[s.length - 1] ?? 0 };
};

type Probe = { hoverContinue: number; hoverSelection: number; raycastMs: number; showMs: number; moveStart: number; moves: Array<{ totalMs: number; showMs: number }> };

test("4V6F drag after hover dwell does no hover raycasts", async ({ page }) => {
  if (!fixture) throw new Error("4V6F fixture missing: run node scripts/fetch-fixtures.mjs or set PERF_4V6F");
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  const viewer = page.getByTestId("molecular-viewer");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded", { timeout: 300_000 });
  const atoms = Number(await viewer.getAttribute("data-canonical-atom-count"));

  // Wrap the 3Dmol prototype (looked up dynamically by the viewer, so wrapping after creation works).
  // mousemove handling time = window capture listener (first) to window bubble listener (last).
  await page.evaluate(() => {
    type Proto = Record<string, (...args: unknown[]) => unknown>;
    const w = window as unknown as { $3Dmol: { GLViewer: { prototype: Proto } }; __probe: Probe };
    const probe: Probe = { hoverContinue: 0, hoverSelection: 0, raycastMs: 0, showMs: 0, moveStart: -1, moves: [] };
    w.__probe = probe;
    const proto = w.$3Dmol.GLViewer.prototype;
    // Draw time (render/show, outermost call only) is excluded from the hover pick timings.
    let drawDepth = 0;
    let drawTotal = 0;
    const wrapDraw = (name: string) => {
      const original = proto[name]!;
      proto[name] = function (this: unknown, ...args: unknown[]) {
        const t0 = performance.now();
        drawDepth += 1;
        try { return original.apply(this, args); } finally {
          drawDepth -= 1;
          if (drawDepth === 0) { const ms = performance.now() - t0; drawTotal += ms; probe.showMs += ms; }
        }
      };
    };
    const wrapPick = (name: string, onCall: (ms: number) => void) => {
      const original = proto[name]!;
      proto[name] = function (this: unknown, ...args: unknown[]) {
        const t0 = performance.now();
        const draw0 = drawTotal;
        try { return original.apply(this, args); } finally { onCall(performance.now() - t0 - (drawTotal - draw0)); }
      };
    };
    wrapPick("handleHoverContinue", (ms) => { probe.hoverContinue += 1; probe.raycastMs += ms; });
    wrapPick("handleHoverSelection", (ms) => { probe.hoverSelection += 1; probe.raycastMs += ms; });
    wrapDraw("render");
    wrapDraw("show");
    window.addEventListener("mousemove", () => { probe.moveStart = performance.now(); probe.showMs = 0; }, true);
    window.addEventListener("mousemove", () => {
      if (probe.moveStart >= 0) probe.moves.push({ totalMs: performance.now() - probe.moveStart, showMs: probe.showMs });
      probe.moveStart = -1;
    });
  });
  const probe = () => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as { __probe: Probe }).__probe)) as Probe);

  // Dwell: rest the pointer on the molecule past 3Dmol's 500 ms hover delay until a hover is active.
  const box = (await viewer.boundingBox())!;
  let hovered = "";
  let dwellPoint = { x: 0, y: 0 };
  const dwellHoverSelectionMs: number[] = [];
  for (let i = 0; i < 12 && !hovered; i++) {
    dwellPoint = { x: box.x + box.width * (0.42 + 0.02 * (i % 6)), y: box.y + box.height * (0.42 + 0.03 * Math.floor(i / 6)) };
    const before = await probe();
    await page.mouse.move(dwellPoint.x, dwellPoint.y);
    await page.waitForTimeout(1200);
    const after = await probe();
    if (after.hoverSelection > before.hoverSelection) dwellHoverSelectionMs.push((after.raycastMs - before.raycastMs) / (after.hoverSelection - before.hoverSelection));
    hovered = (await viewer.getAttribute("data-hovered-atom")) ?? "";
  }
  expect(hovered, "a hover must be active before the drag").not.toBe("");

  // Drag 12 moves with the button held, starting on the hovered atom.
  await page.evaluate(() => { const p = (window as unknown as { __probe: Probe }).__probe; p.hoverContinue = 0; p.hoverSelection = 0; p.raycastMs = 0; p.moves = []; });
  await page.mouse.down();
  const hoverAfterDown = (await viewer.getAttribute("data-hovered-atom")) ?? "";
  const stepWallMs: number[] = [];
  for (let step = 1; step <= 12; step++) {
    const t0 = Date.now();
    await page.mouse.move(dwellPoint.x + step * 12, dwellPoint.y + step * 6);
    stepWallMs.push(Date.now() - t0);
  }
  // Rest with the button still held past the hover delay: no hover timer may fire.
  await page.waitForTimeout(1200);
  const drag = await probe();
  await page.mouse.up();

  const inputMs = drag.moves.map((m) => m.totalMs - m.showMs);
  const results = {
    schemaVersion: 1, label, date: new Date().toISOString(), fixture: "4V6F", atoms,
    pickGridCells: Number((await viewer.getAttribute("data-pick-grid-cells")) ?? 0),
    dwellHoverSelectionMs: stats(dwellHoverSelectionMs),
    hoverClearedOnPointerDown: hoverAfterDown === "",
    drag: {
      moves: drag.moves.length,
      hoverContinueCalls: drag.hoverContinue,
      hoverSelectionCalls: drag.hoverSelection,
      hoverRaycastMs: drag.raycastMs,
      inputCpuMsPerMove: stats(inputMs),
      showMsPerMove: stats(drag.moves.map((m) => m.showMs)),
      stepWallMs: stats(stepWallMs),
    },
  };
  const dir = resolve("test-results/perf");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, `hover-drag-${label}.json`), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results));

  expect(drag.moves.length, "mousemoves observed during drag").toBeGreaterThanOrEqual(10);
  expect(drag.hoverContinue, "handleHoverContinue calls while button held").toBe(0);
  expect(drag.hoverSelection, "handleHoverSelection calls while button held").toBe(0);
  expect(results.hoverClearedOnPointerDown, "hover cleared on pointerdown").toBe(true);
  // CPU cost per drag frame excluding the GPU draw (software GL here). Before the fix: ~180+ ms of raycast per move.
  expect(stats(inputMs).max, "per-move input handling (excl. draw)").toBeLessThan(50);
  // Still-mouse hover pick on 4V6F (one handleHoverSelection) must be cheap too: ~185 ms before the pick grid.
  expect(stats(dwellHoverSelectionMs).max, "hover pick on dwell").toBeLessThan(50);
  // GPU-only: a whole drag frame (input + draw) under 200 ms needs real GPU rendering.
  if (process.env.PERF_GPU === "1") expect(stats(stepWallMs).p95, "drag step wall time").toBeLessThan(200);
});
