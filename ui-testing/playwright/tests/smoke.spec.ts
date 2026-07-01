import { expect, test } from "@playwright/test";
import { openApp, openAsAssociation, navigateToForms } from "../helpers/navigation";
import { clearLocalUser } from "../helpers/users";

test("local startup loads shell navigation and remotes", async ({ page }) => {
  await clearLocalUser(page);
  await openApp(page);

  await page.getByRole("button", { name: "User menu" }).click();
  await page.getByRole("menuitem", { name: "Login" }).click();
  const dialog = page.getByRole("dialog", { name: "Select a seeded user" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Seeded user" })).toBeVisible();

  await openAsAssociation(page);
  await expect(page.getByRole("button", { name: "DDQ", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("button", { name: "Forms", exact: true })).toBeVisible();

  await navigateToForms(page);
  await expect(page.getByRole("button", { name: "Forms", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
