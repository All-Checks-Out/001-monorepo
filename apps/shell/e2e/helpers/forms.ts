import { expect, type Page } from "@playwright/test";
import { navigateToForms } from "./navigation";

type FieldOptions = {
  type: "Text" | "Long text" | "Dropdown" | "Yes/No";
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 7)}`;
}

export async function addFormField(page: Page, field: FieldOptions) {
  await page.getByRole("button", { name: /Add item/ }).click();
  await page.getByRole("menuitem", { name: field.type, exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Add field" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Label").fill(field.label);

  if (field.required) {
    await dialog.getByRole("checkbox", { name: "Required" }).check();
  }

  if (field.placeholder) {
    await dialog.getByLabel("Placeholder").fill(field.placeholder);
  }

  if (field.options?.length) {
    await dialog.locator('input[aria-label="Option 1"]').fill(field.options[0]);
    for (const [index, option] of field.options.slice(1).entries()) {
      await dialog.getByRole("button", { name: "Add option" }).click();
      await dialog.locator(`input[aria-label="Option ${index + 2}"]`).fill(option);
    }
  }

  await expect(dialog.getByRole("button", { name: "Save field" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Save field" }).click();
  await expect(dialog).toBeHidden();
}

export async function createCustomForm(page: Page, formName = uniqueName("E2E form")) {
  await navigateToForms(page);
  await page.getByRole("link", { name: "Add Form" }).click();
  await expect(page.getByText("New form template")).toBeVisible();

  await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
  await page.getByLabel("Short name").fill(formName);
  await page.getByLabel("Description").fill("Created by Playwright e2e.");

  await addFormField(page, {
    type: "Text",
    label: "Registered company name",
    required: true,
    placeholder: "Example Ltd",
  });
  await addFormField(page, {
    type: "Dropdown",
    label: "Operating region",
    required: true,
    options: ["United Kingdom", "European Union"],
  });
  await addFormField(page, {
    type: "Yes/No",
    label: "Has cyber insurance",
  });

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByText("Registered company name").first()).toBeVisible();

  return formName;
}

export async function reopenForm(page: Page, formName: string) {
  await navigateToForms(page);
  await page.getByRole("link", { name: `Edit ${formName}` }).click();
  await expect(page.getByText(formName).first()).toBeVisible();
}
