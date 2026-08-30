import { expect, test } from "@playwright/test";

test("G0 workstation shell renders and console collapses", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Structure" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Selection Inspector" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Command and selection console" })).toBeVisible();
  await page.getByRole("button", { name: "Collapse console" }).click();
  await expect(page.getByRole("button", { name: "Expand console" })).toBeVisible();
});

test("unsupported actions report their G0 capability state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Surface", exact: true }).first().click();
  await expect(page.getByRole("status")).toContainText("Coming Soon");
  await expect(page.getByRole("status")).toContainText("Surface calculation is not implemented in G0");
});
