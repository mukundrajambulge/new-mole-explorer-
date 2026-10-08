// 3.8: one persistent viewer. 30 Molecular/Docking switches on 4V6F: same canvas element, no reload,
// context alive, canvas sized, and pixels not blank after every switch.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// tests/fixtures/rcsb/4V6F.* is gitignored (38 MB); fresh worktrees fall back to the tracked copy.
const fixture = [process.env.PERF_4V6F ?? "", "tests/fixtures/rcsb/4V6F.cif", "verification/large-molecule-4v6f/01-source/4v6f.cif"].filter(Boolean).map((p) => resolve(p)).find((p) => existsSync(p)) ?? resolve("tests/fixtures/rcsb/4V6F.cif");

// Screenshot the viewer (composited output, independent of preserveDrawingBuffer) and count lit pixels.
const litPixels = async (page: Page, viewer: Locator): Promise<number> => {
  const png = (await viewer.screenshot()).toString("base64");
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = Math.min(img.width, 400); c.height = Math.min(img.height, 300);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit += 1;
    return lit;
  }, png);
};

test("4V6F survives 30 tab switches", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  page.on("console", (m) => { if (m.type() === "error") console.log("PAGE_ERROR", m.text().slice(0, 400)); });
  page.on("pageerror", (e) => console.log("PAGE_EXC", String(e).slice(0, 400)));
  // The API only allows the :3101 origin; when PERF_WEB_PORT gives this run its own dev server, present :3101.
  if (process.env.PERF_WEB_PORT && process.env.PERF_WEB_PORT !== "3101") {
    await page.route("**/api/**", (route) => route.continue({ headers: { ...route.request().headers(), origin: "http://localhost:3101" } }));
    // Large multipart bodies through this dev server's proxy get reset by the API; send the upload straight to the API.
    const tokenDir = process.env.MOLE_TOKEN_DIR ?? ".mole";
    await page.route("**/api/structures/upload", async (route) => {
      const token = readFileSync(resolve(tokenDir, "token"), "utf8").trim();
      const response = await route.fetch({ url: "http://localhost:8100/api/structures/upload", headers: { ...route.request().headers(), origin: "http://localhost:3101", host: "localhost:8100", "x-mole-token": token }, postData: route.request().postDataBuffer() ?? undefined, timeout: 300_000 });
      await route.fulfill({ response });
    });
  }
  await page.goto("/");
  const viewer = page.getByTestId("molecular-viewer");
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded", { timeout: 300_000 });
  await page.waitForTimeout(2000);
  expect(await litPixels(page, viewer)).toBeGreaterThan(200);
  await page.evaluate(() => {
    const w = window as unknown as { __canvas: Element | null; __origin: number };
    w.__canvas = document.querySelector(".viewer-host canvas");
    w.__origin = performance.timeOrigin;
  });
  for (let i = 0; i < 30; i += 1) {
    await page.getByRole("button", { name: i % 2 === 0 ? "Docking" : "Molecular", exact: true }).first().click();
    await page.waitForTimeout(250);
    const info = await page.evaluate(() => {
      const w = window as unknown as { __canvas: Element | null };
      const c = document.querySelector(".viewer-host canvas") as HTMLCanvasElement;
      return { same: c === w.__canvas, w: c.clientWidth, h: c.clientHeight, bw: c.width, bh: c.height };
    });
    expect(info.same).toBe(true);
    expect(info.w).toBeGreaterThan(0);
    expect(info.h).toBeGreaterThan(0);
    expect(info.bw).toBeGreaterThan(0);
    expect(info.bh).toBeGreaterThan(0);
    expect(await litPixels(page, viewer), `non-black canvas after switch ${i + 1}`).toBeGreaterThan(200);
  }
  await page.getByRole("button", { name: "Molecular", exact: true }).first().click();
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => {
    const w = window as unknown as { __canvas: Element | null; __origin: number };
    const c = document.querySelector(".viewer-host canvas") as HTMLCanvasElement;
    const gl = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext;
    return { same: c === w.__canvas, noReload: w.__origin === performance.timeOrigin, lost: gl.isContextLost() };
  });
  expect(state.same).toBe(true);
  expect(state.noReload).toBe(true);
  expect(state.lost).toBe(false);
  expect(await litPixels(page, viewer)).toBeGreaterThan(200);
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
});
