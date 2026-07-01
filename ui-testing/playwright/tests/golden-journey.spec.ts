import { expect, test } from "@playwright/test";
import {
  addFormCompletionTask,
  addDocumentUploadTask,
  addPublishedPackToProvider,
  completeChecklist,
  completeProviderEvidenceTask,
  completeProviderFormTask,
  createDraftPack,
  openPackEditor,
  openProviderChecklist,
  publishPack,
  savePackDraft,
} from "../helpers/ddq-packs";
import { createCustomForm, reopenForm, uniqueName } from "../helpers/forms";
import { openAsAssociation, openAsProvider } from "../helpers/navigation";

test("Prudence publishes a form-backed DDQ pack and Arthur completes it", async ({ page }) => {
  const formName = uniqueName("E2E golden form");
  const packName = uniqueName("E2E golden pack");
  const taskTitle = "Supplier questionnaire";

  await test.step("Prudence creates a reusable form", async () => {
    await openAsAssociation(page);
    await createCustomForm(page, formName);
    await reopenForm(page, formName);
    await expect(page.getByText("Registered company name").first()).toBeVisible();
    await expect(page.getByText("Operating region").first()).toBeVisible();
  });

  await test.step("Prudence builds and publishes a DDQ pack", async () => {
    await createDraftPack(page, packName);
    await openPackEditor(page, packName);
    await addFormCompletionTask(page, formName, taskTitle);
    await savePackDraft(page);
    await publishPack(page, packName);
    await openPackEditor(page, packName);
    await expect(page.getByRole("button", { name: /Add item/ })).toBeVisible();
  });

  await test.step("Arthur adds the published pack and completes the required form", async () => {
    await openAsProvider(page, "/core/provider/ddq-packs");
    await addPublishedPackToProvider(page, packName);
    await openProviderChecklist(page, packName);
    await completeProviderFormTask(page, taskTitle);
    await completeChecklist(page, packName);
  });

  await test.step("Prudence can review the published pack in read-only mode", async () => {
    await openAsAssociation(page, "/core/association/ddq-packs");
    await page.getByLabel("Search DDQ Pack name").fill(packName);
    await page.getByRole("link", { name: `View ${packName}` }).click();
    await expect(page.getByText(taskTitle)).toBeVisible();
    await expect(page.getByRole("button", { name: /Add item/ })).toBeHidden();
    await expect(page.getByRole("link", { name: "Close" })).toBeVisible();
  });
});

test("provider evidence upload can be completed locally", async ({ page }) => {
  const packName = uniqueName("E2E evidence pack");
  const taskTitle = "Upload insurance certificate";

  await test.step("Prudence creates and publishes a document-upload DDQ pack", async () => {
    await openAsAssociation(page);
    await createDraftPack(page, packName);
    await openPackEditor(page, packName);
    await addDocumentUploadTask(page, taskTitle);
    await savePackDraft(page);
    await publishPack(page, packName);
  });

  await test.step("Arthur uploads evidence and completes the checklist", async () => {
    await openAsProvider(page, "/core/provider/ddq-packs");
    await addPublishedPackToProvider(page, packName);
    await openProviderChecklist(page, packName);
    await completeProviderEvidenceTask(page, taskTitle);
    await completeChecklist(page, packName);
  });
});
