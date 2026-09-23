import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const baseUrl = process.env.P0_PERF_BASE_URL ?? "http://127.0.0.1:3106";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const viewer = page.getByTestId("molecular-viewer");

const readRenderer = async () => viewer.evaluate((element) => {
  const names = [
    "rendererViewerCreations", "rendererModelLoads", "rendererSceneRebuilds", "rendererProjectionRebuilds",
    "rendererRenderCalls", "rendererSurfaceCacheHits", "rendererSurfaceCacheMisses", "rendererSurfaceGenerations",
    "rendererMeshGenerations", "rendererDotGenerations", "rendererStaleSurfaceResults", "rendererWorkspaceDiagnosticsRecomputations",
    "rendererWorkspaceStyleRebuilds", "rendererCompactInteractionScans", "rendererCompactStableIdMapBuilds", "surfaceState",
    "surfaceReady", "rendererSurfaceObjectCount", "rendererSurfacePointCount", "cameraAction", "projection",
    "canonicalAtomCount", "canonicalBondCount", "progressiveRenderStage", "labelCount",
  ];
  return Object.fromEntries(names.map((name) => [name, element.getAttribute(`data-${name.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`)]));
});

const waitLoaded = async () => {
  await page.waitForFunction(() => document.querySelector('[data-testid="molecular-viewer"]')?.getAttribute("data-viewer-state") === "loaded", null, { timeout: 60_000 });
  await page.waitForTimeout(250);
};

await page.goto(`${baseUrl}/`);
const navigation = await page.evaluate(() => {
  const entry = performance.getEntriesByType("navigation")[0];
  return entry ? { domContentLoadedMs: entry.domContentLoadedEventEnd, loadEventMs: entry.loadEventEnd } : null;
});
await page.locator('input[type="file"]').setInputFiles(resolve("tests/fixtures/mini-protein.pdb"));
await page.getByTitle("mini-protein.pdb").first().waitFor({ state: "visible", timeout: 60_000 });
await waitLoaded();
const loaded = await readRenderer();

const beforeCamera = await readRenderer();
await page.getByRole("button", { name: "View", exact: true }).click();
await page.getByRole("button", { name: "Rotate", exact: true }).click();
const canvas = viewer.locator("canvas");
const box = await canvas.boundingBox();
if (!box) throw new Error("Viewer canvas did not have a bounding box.");
await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.6, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(250);
const afterCamera = await readRenderer();

await page.getByRole("button", { name: "Display panel", exact: true }).click();
const style = page.getByRole("combobox", { name: "Style" });
await style.selectOption("sticks");
await page.waitForTimeout(250);
const afterRepresentation = await readRenderer();

await style.selectOption("van-der-waals-surface");
await page.waitForFunction(() => document.querySelector('[data-testid="molecular-viewer"]')?.getAttribute("data-surface-ready") === "true", null, { timeout: 90_000 });
const afterSurface = await readRenderer();

await browser.close();
console.log(JSON.stringify({ baseUrl, navigation, loaded, beforeCamera, afterCamera, afterRepresentation, afterSurface }, null, 2));
