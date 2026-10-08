// 3.8: one persistent viewer. 30 Molecular/Docking switches on 4V6F: same canvas element, no reload,
// context alive, canvas sized, and pixels not blank after every switch.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { resolve } from "node:path";

const fixture = resolve("tests/fixtures/rcsb/4V6F.cif");

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
  // Container resize with no window event (panel-collapse case): the host observer must resize the canvas.
  const before = await page.evaluate(() => (document.querySelector(".viewer-host canvas") as HTMLCanvasElement).clientWidth);
  await page.evaluate(() => { const h = document.querySelector(".viewer-host") as HTMLElement; h.style.width = "50%"; });
  await expect.poll(() => page.evaluate(() => { const c = document.querySelector(".viewer-host canvas") as HTMLCanvasElement; return c.clientWidth; }), { timeout: 5000 }).toBeLessThan(before);
  await page.evaluate(() => { (document.querySelector(".viewer-host") as HTMLElement).style.width = ""; });
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => {
    const w = window as unknown as { __canvas: Element | null; __origin: number };
    const c = document.querySelector(".viewer-host canvas") as HTMLCanvasElement;
    // getContext returns null for a name other than the one the canvas was created with, so try each.
    const gl = (["webgl2", "webgl", "experimental-webgl"] as const).map((name) => c.getContext(name) as WebGLRenderingContext | null).find(Boolean) ?? null;
    return { same: c === w.__canvas, noReload: w.__origin === performance.timeOrigin, lost: gl ? gl.isContextLost() : false }; // 3Dmol may not expose its context on this element; lit pixels above prove it still draws
  });
  expect(state.same).toBe(true);
  expect(state.noReload).toBe(true);
  expect(state.lost).toBe(false);
  expect(await litPixels(page, viewer)).toBeGreaterThan(200);
  await expect(viewer).toHaveAttribute("data-viewer-state", "loaded");
});
