import { describe, expect, it } from "vitest";
import {
  getEffectivePermissions,
  getPermissionsForCorporationType,
  hasPermission,
  PERMISSIONS_BY_CORPORATION_TYPE,
  type CorporationType,
  type Permission,
} from "./index";

const corporationTypes = Object.keys(
  PERMISSIONS_BY_CORPORATION_TYPE,
) as CorporationType[];
const allPermissions = [
  ...new Set(corporationTypes.flatMap((type) => PERMISSIONS_BY_CORPORATION_TYPE[type])),
] as Permission[];

describe("permission matrix", () => {
  it.each(allPermissions)("evaluates %s for all corporation user types", (permission) => {
    for (const corporationType of corporationTypes) {
      const allowedPermissions = getPermissionsForCorporationType(corporationType);
      const permissionBelongsToCorporation =
        allowedPermissions.includes(permission);
      const allowedUser = { permissions: allowedPermissions };
      const disallowedUser = { permissions: [] };

      expect(
        hasPermission({ user: allowedUser, corporationType }, permission),
      ).toBe(permissionBelongsToCorporation);
      expect(
        getEffectivePermissions({ user: allowedUser, corporationType }),
      ).toEqual([...allowedPermissions]);

      expect(
        hasPermission({ user: disallowedUser, corporationType }, permission),
      ).toBe(false);
      expect(
        getEffectivePermissions({ user: disallowedUser, corporationType }),
      ).toEqual([]);
    }
  });
});
