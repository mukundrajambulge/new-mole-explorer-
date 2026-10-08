// 3.8: one persistent viewer. 30 Molecular/Docking switches on 4V6F: same canvas element, no reload, context alive.
import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const fixture = [process.env.PERF_4V6F, "tests/fixtures/rcsb/4V6F.cif"].filter(Boolean).map((p) => resolve(p as string)).find((p) => existsSync(p));

test("4V6F survives 30 tab switches", async ({ page }) => {
  if (!fixture) throw new Error("4V6F fixture missing: set PERF_4V6F");
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/");
  const viewer = page.getByTestId("molecular-viewer");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded", { timeout: 300_000 });
  await page.evaluate(() => {
    const w = window as unknown as { __canvas: Element | null; __origin: number };
    w.__canvas = document.querySelector(".viewer-host canvas");
    w.__origin = performance.timeOrigin;
  });
  for (let i = 0; i < 30; i += 1) {
    await page.getByRole("button", { name: i % 2 === 0 ? "Docking" : "Molecular", exact: true }).first().click();
    await page.waitForTimeout(150);
  }
  await page.getByRole("button", { name: "Molecular", exact: true }).first().click();
  const state = await page.evaluate(() => {
    const w = window as unknown as { __canvas: Element | null; __origin: number };
    const c = document.querySelector(".viewer-host canvas") as HTMLCanvasElement;
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext;
    return { same: c === w.__canvas, noReload: w.__origin === performance.timeOrigin, lost: gl.isContextLost(), area: c.clientWidth * c.clientHeight };
  });
  expect(state.same).toBe(true);
  expect(state.noReload).toBe(true);
  expect(state.lost).toBe(false);
  expect(state.area).toBeGreaterThan(0);
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
});
