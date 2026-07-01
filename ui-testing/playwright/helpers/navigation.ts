import { expect, type Page } from "@playwright/test";
import { associationUserEmail, providerUserEmail, selectLocalUser } from "./users";

export async function openApp(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "User menu" })).toBeVisible();
}

export async function openAsAssociation(page: Page, path = "/core") {
  await selectLocalUser(page, associationUserEmail, path);
  await expect(page.getByRole("button", { name: "DDQ", exact: true })).toBeVisible();
}

export async function openAsProvider(page: Page, path = "/core") {
  await selectLocalUser(page, providerUserEmail, path);
  await expect(page.getByRole("button", { name: "DDQ", exact: true })).toBeVisible();
}

export async function navigateToForms(page: Page) {
  await page.goto("/form-design");
  await expect(page.getByRole("heading", { name: "Forms" })).toBeVisible();
}

export async function navigateToAssociationDDQPacks(page: Page) {
  await page.goto("/core/association/ddq-packs");
  await expect(page.getByText("DDQ Packs").first()).toBeVisible();
}

export async function navigateToProviderDDQPacks(page: Page) {
  await page.goto("/core/provider/ddq-packs");
  await expect(page.getByText("DDQ Packs").first()).toBeVisible();
}

export async function expectAccessDenied(page: Page) {
  await expect(
    page.getByText("You do not have permission to access this page."),
  ).toBeVisible();
}
