import {
  getEffectivePermissions as getSharedEffectivePermissions,
  hasPermission as sharedHasPermission,
  type CorporationType,
  type Permission,
} from "@shared/permissions";
import type { AppUser } from "@frontend/api/onboarding/types";

type PermissionContext = {
  user: AppUser | null;
  corporationType: CorporationType | null;
};

export function getEffectivePermissions({
  user,
  corporationType,
}: PermissionContext): Permission[] {
  if (!user || !corporationType) return [];

  return getSharedEffectivePermissions(user, { type: corporationType });
}

export function hasPermission(
  context: PermissionContext,
  permission: Permission,
): boolean {
  if (!context.user || !context.corporationType) return false;

  return sharedHasPermission(
    { user: context.user, corporation: { type: context.corporationType } },
    permission,
  );
}
