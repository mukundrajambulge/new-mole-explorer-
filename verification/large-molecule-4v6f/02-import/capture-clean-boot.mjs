import { chromium } from "@playwright/test";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto("http://localhost:3101/molstudio", { waitUntil: "networkidle" });
await page.getByText("No structure loaded", { exact: true }).waitFor({ state: "visible", timeout: 20000 });
await page.screenshot({ path: "verification/large-molecule-4v6f/evidence/00-baseline/LM-BOOT-001__clean-boot__PASS.png" });
console.log(JSON.stringify({
  url: page.url(),
  title: await page.title(),
  viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
  errors: await page.locator('[role="alert"]').allTextContents(),
}));
await browser.close();
