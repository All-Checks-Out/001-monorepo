import { expect, test, type Page } from "@playwright/test";
import { associationUserEmail, providerUserEmail, selectLocalUser } from "./users";

export async function openApp(page: Page) {
  await test.step("Open the application in local preview mode", async () => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();
  });
}

export async function openAsAssociation(page: Page, path = "/core") {
  await test.step("Open the application as association user Prudence", async () => {
    await selectLocalUser(page, associationUserEmail, path);
    await expect(page.getByRole("button", { name: "DDQ", exact: true })).toBeVisible();
  });
}

export async function openAsProvider(page: Page, path = "/core") {
  await test.step("Open the application as provider user Arthur", async () => {
    await selectLocalUser(page, providerUserEmail, path);
    await expect(page.getByRole("button", { name: "DDQ", exact: true })).toBeVisible();
  });
}

export async function navigateToForms(page: Page) {
  await test.step("Open Form Designer", async () => {
    await page.goto("/form-design");
    await expect(page.getByRole("heading", { name: "Forms" })).toBeVisible();
  });
}

export async function navigateToAssociationDDQPacks(page: Page) {
  await test.step("Open association DDQ packs", async () => {
    await page.goto("/core/association/ddq-packs");
    await expect(page.getByText("DDQ Packs").first()).toBeVisible();
  });
}

export async function navigateToProviderDDQPacks(page: Page) {
  await test.step("Open provider DDQ packs", async () => {
    await page.goto("/core/provider/ddq-packs");
    await expect(page.getByText("DDQ Packs").first()).toBeVisible();
  });
}

export async function expectAccessDenied(page: Page) {
  await test.step("Verify access is denied", async () => {
    await expect(
      page.getByText("You do not have permission to access this page."),
    ).toBeVisible();
  });
}
