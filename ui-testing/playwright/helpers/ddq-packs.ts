import { expect, type Page } from "@playwright/test";
import {
  navigateToAssociationDDQPacks,
  navigateToProviderDDQPacks,
} from "./navigation";
import { uniqueName } from "./forms";

export async function createDraftPack(page: Page, packName = uniqueName("E2E DDQ pack")) {
  await navigateToAssociationDDQPacks(page);
  await page.getByRole("button", { name: "Add Pack" }).click();
  await expect(page.getByRole("button", { name: "Create Pack" })).toBeDisabled();
  await page.getByLabel("Pack name", { exact: true }).fill(packName);
  await page.getByLabel("Valid from", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Valid to", { exact: true }).fill("2026-12-31");
  await expect(page.getByRole("button", { name: "Create Pack" })).toBeEnabled();
  await page.getByRole("button", { name: "Create Pack" }).click();
  await expect(page.getByText("DDQ Pack created.")).toBeVisible();
  await expect(page.getByText(packName)).toBeVisible();
  return packName;
}

export async function openPackEditor(page: Page, packName: string) {
  await navigateToAssociationDDQPacks(page);
  await page.getByLabel("Search DDQ Pack name").fill(packName);
  await page.getByRole("link", { name: `Edit ${packName}` }).click();
  await expect(page.getByText(packName).first()).toBeVisible();
}

export async function addFormCompletionTask(
  page: Page,
  formName: string,
  title = "Supplier questionnaire",
) {
  await page.getByRole("button", { name: /Add item/ }).click();
  await page.getByRole("menuitem", { name: "Form completion task" }).click();
  await expect(page.getByRole("heading", { name: "Add Item" })).toBeVisible();

  await page.getByLabel("Form template").selectOption({ label: formName });
  await page.getByPlaceholder("Title").fill(title);
  const submitItemButton = page.locator("button").filter({ hasText: /^Add Item$/ });
  await expect(submitItemButton).toBeEnabled();
  await submitItemButton.click();
  await expect(page.getByText(title)).toBeVisible();
}

export async function savePackDraft(page: Page) {
  await expect(page.getByRole("button", { name: "Save Pack" })).toBeEnabled();
  await page.getByRole("button", { name: "Save Pack" }).click();
  await expect(page.getByText("DDQ Pack saved.")).toBeVisible();
}

export async function publishPack(page: Page, packName: string) {
  await navigateToAssociationDDQPacks(page);
  await page.getByLabel("Search DDQ Pack name").fill(packName);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: `Publish Pack for ${packName}` }).click();
  await expect(page.getByText("DDQ Pack published.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Published" })).toBeVisible();
}

export async function addPublishedPackToProvider(page: Page, packName: string) {
  await navigateToProviderDDQPacks(page);
  await page.getByRole("button", { name: "Add DDQ Pack" }).click();
  await expect(page.getByText("Add DDQ Pack")).toBeVisible();
  await page.getByLabel("Search DDQ Pack name").fill(packName);
  await page.getByRole("radio", { name: `Select ${packName}` }).check();
  await expect(page.getByRole("button", { name: "Add selected DDQ Pack" })).toBeEnabled();
  await page.getByRole("button", { name: "Add selected DDQ Pack" }).click();
  await expect(page.getByText("DDQ Pack added.")).toBeVisible();
  await expect(page.getByText(packName)).toBeVisible();
}

export async function openProviderChecklist(page: Page, packName: string) {
  await navigateToProviderDDQPacks(page);
  await page.getByRole("button", { name: `Create or edit checklist for ${packName}` }).click();
  await expect(page.getByText(packName).first()).toBeVisible();
}

export async function completeProviderFormTask(page: Page, taskTitle: string) {
  await expect(page.getByText(taskTitle)).toBeVisible();
  await page.getByRole("link", { name: "Complete form" }).click();
  await expect(page.getByText(taskTitle).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark complete" })).toBeDisabled();

  await page.getByLabel("Registered company name").fill("Uptick IT Platform Ltd");
  await page.getByLabel("Operating region").selectOption("United Kingdom");
  await expect(page.getByRole("button", { name: "Mark complete" })).toBeEnabled();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByText("Form completed.")).toBeVisible();
}

export async function completeChecklist(page: Page, packName: string) {
  await page.getByRole("link", { name: packName }).click();
  const completeButton = page.getByRole("button", { name: "Complete checklist" });

  if (await completeButton.isVisible()) {
    await expect(completeButton).toBeEnabled();
    page.once("dialog", (dialog) => dialog.accept());
    await completeButton.click();
    await expect(page.getByText("DDQ Checklist completed.")).toBeVisible();
  }

  await expect(page.getByText("Completed").first()).toBeVisible();
}
