import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const IMG = path.resolve(__dirname, "../../../backend/tests/fixtures/eval/headphones.jpg");
const IMG2 = path.resolve(__dirname, "../../../backend/tests/fixtures/eval/dumbbell.jpg");
const PASSWORD = "Sup3r-Secret-pass";

async function signUp(page: Page) {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  await page.goto("/register");
  await page.getByLabel("Full name").fill("E2E Seller");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/settings/);
  await page.getByLabel("Organization name").fill("E2E Traders");
  await page.getByRole("button", { name: "Create organization" }).click();
  await expect(page.getByText("Organization created")).toBeVisible();
  return email;
}

test("unauthenticated users are redirected to login and see validation errors", async ({ page }) => {
  await page.goto("/listings");
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
});

test("weak password is rejected by the form", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("X");
  await page.getByLabel("Email").fill("x@example.com");
  await page.getByLabel("Password").fill("weak");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("At least 12 characters")).toBeVisible();
});

test("upload → AI draft → edit → regenerate → approve → appears in catalog", async ({ page }) => {
  await signUp(page);
  await page.getByRole("link", { name: "AI Product Upload" }).click();
  await page.getByTestId("file-input").setInputFiles(IMG);
  await expect(page.getByRole("img", { name: "headphones.jpg" })).toBeVisible();
  await page.getByRole("button", { name: "Generate listing" }).click();

  // editor loads and polls until the job reaches review
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]+/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("ACME X200", { timeout: 30_000 });
  await expect(page.getByText("Needs review").first()).toBeVisible();

  // confidence + evidence are visible; sensitive visual guess asks for confirmation
  await expect(page.getByText("Pre-filled · review").first()).toBeVisible();
  await expect(page.getByText("Please confirm").first()).toBeVisible();
  await expect(page.getByText("fake evidence for brand")).toBeVisible();

  // unsupported claim from the (fake) generator is flagged
  await expect(page.getByText(/Unverified claim/)).toBeVisible();

  // compare view shows the original AI output next to the edit
  const title = page.getByLabel("Product title", { exact: true });
  await title.fill("Seller Edited Title");
  await page.getByRole("button", { name: "Compare" }).first().click();
  await expect(page.getByTestId("compare-title")).toContainText("Original AI output");
  await expect(page.getByTestId("compare-title")).toContainText("ACME X200 Wireless Headphones v1");

  // field-level regeneration replaces that field with a new AI version
  await page.getByRole("button", { name: "Regenerate Short title" }).click();
  await expect(page.getByText("Field regenerated")).toBeVisible();

  // fix a value and approve explicitly
  await page.getByLabel("Color", { exact: true }).fill("navy");
  await page.getByRole("button", { name: /Approve listing/ }).click();
  await expect(page.getByText("Listing approved")).toBeVisible();
  await expect(page.getByText("approved and read-only")).toBeVisible();
  await expect(page.getByLabel("Product title", { exact: true })).toHaveValue("Seller Edited Title");

  // translation keeps the original
  await page.getByLabel("Target language").selectOption("ar");
  await page.getByRole("button", { name: "Translate" }).click();
  await expect(page.getByText("[Arabic]").first()).toBeVisible();

  // catalog lists the approved listing
  await page.getByRole("link", { name: "Listings & Jobs" }).click();
  await page.getByRole("tab", { name: "Approved (catalog)" }).click();
  await expect(page.getByText("Seller Edited Title")).toBeVisible();
});

test("bulk upload → progress → approve ready items → CSV export", async ({ page }) => {
  await signUp(page);
  await page.getByRole("link", { name: "Bulk Upload" }).click();
  await page.getByTestId("bulk-input").setInputFiles([IMG, IMG2]);
  await expect(page.getByText(/Batch · 2 item/)).toBeVisible();
  await expect(page.getByText("completed")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Approve all ready" }).click();
  await expect(page.getByText(/2 approved, 0 skipped/)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^bulk-.*\.csv$/);
});

test("tenant isolation in the UI: another user cannot open a listing by URL", async ({ page, browser }) => {
  await signUp(page);
  await page.getByRole("link", { name: "AI Product Upload" }).click();
  await page.getByTestId("file-input").setInputFiles(IMG);
  await page.getByRole("button", { name: "Generate listing" }).click();
  await expect(page).toHaveURL(/\/listings\/[0-9a-f-]+/);
  const url = page.url();

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await signUp(p2);
  await p2.goto(url);
  await expect(p2.getByText("Listing job not found")).toBeVisible();
  await other.close();
});
