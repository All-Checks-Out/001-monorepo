import { expect, test } from "@playwright/test";
import {
  expectAccessDenied,
  navigateToAssociationDDQPacks,
  navigateToProviderDDQPacks,
  openAsAssociation,
  openAsProvider,
} from "./helpers/navigation";

test("association and provider navigation respects permissions", async ({ page }) => {
  await openAsAssociation(page, "/core/association/ddq-packs");
  await navigateToAssociationDDQPacks(page);
  await expect(page.getByRole("button", { name: "Add Pack" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forms", exact: true })).toBeVisible();

  await page.goto("/core/provider/ddq-packs");
  await expectAccessDenied(page);

  await openAsProvider(page, "/core/provider/ddq-packs");
  await navigateToProviderDDQPacks(page);
  await expect(page.getByRole("button", { name: "Add DDQ Pack" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Forms", exact: true })).toBeHidden();

  await page.goto("/core/association/ddq-packs");
  await expectAccessDenied(page);
});
