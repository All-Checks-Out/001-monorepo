import { expect, type Page } from "@playwright/test";
import type { APIResponse } from "@playwright/test";
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

export async function addDocumentUploadTask(
  page: Page,
  title = "Evidence document",
) {
  await page.getByRole("button", { name: /Add item/ }).click();
  await page.getByRole("menuitem", { name: "Document upload task" }).click();
  await expect(page.getByRole("heading", { name: "Add Item" })).toBeVisible();

  await page.getByLabel("Document type").selectOption({ label: "Other" });
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

export async function completeProviderEvidenceTask(page: Page, taskTitle: string) {
  await expect(page.getByText(taskTitle)).toBeVisible();
  await page.getByRole("link", { name: "Execute task" }).click();
  await expect(page.getByText(taskTitle).first()).toBeVisible();

  await page.getByLabel("File").setInputFiles({
    name: "evidence.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% E2E evidence fixture\n"),
  });

  const uploadUrlResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/evidence/upload-url") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Upload evidence" }).click();
  const uploadUrlResponse = await uploadUrlResponsePromise;
  expect(uploadUrlResponse.ok()).toBeTruthy();
  const objectKey = await evidenceObjectKey(uploadUrlResponse);

  await expect(
    page.getByText("Evidence uploaded. The task will update after S3 confirms the upload."),
  ).toBeVisible();
  await completeLocalEvidenceUpload(page, objectKey);

  await page.reload();
  await expect(page.getByText("Uploaded").first()).toBeVisible();
  await expect(page.getByText("Completed").first()).toBeVisible();
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

async function evidenceObjectKey(response: APIResponse) {
  const body = (await response.json()) as {
    evidence?: {
      object_key?: string;
    };
  };
  expect(body.evidence?.object_key, "created evidence object key").toBeTruthy();
  return body.evidence!.object_key!;
}

async function completeLocalEvidenceUpload(page: Page, objectKey: string) {
  const apiBaseURL = process.env.ACO_E2E_API_BASE_URL ?? "http://127.0.0.1:3001";
  const response = await page.request.post(
    `${apiBaseURL}/local-dev/evidence-uploads/complete`,
    {
      data: { object_key: objectKey },
    },
  );
  expect(response.ok()).toBeTruthy();
}
