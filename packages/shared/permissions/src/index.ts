export type CorporationType = "ASSOCIATION" | "PROVIDER" | "AGENT" | "STAKEHOLDER";

export const PERMISSIONS_BY_CORPORATION_TYPE = {
  ASSOCIATION: [
    "provider-requests:read",
    "provider-requests:approve",
    "system-data:read",
    "users:read",
    "users:invite",
    "user-permissions:change",
    "ddq-packs:read",
    "ddq-packs:edit",
    "forms:read",
    "forms:edit",
  ],
  PROVIDER: [
    "agent-requests:read",
    "agent-requests:approve",
    "stakeholder-requests:read",
    "stakeholder-requests:approve",
    "users:read",
    "users:invite",
    "user-permissions:change",
    "ddq-packs:add-new",
    "ddq-packs:perform-checks",
    "ddq-packs:review-checks",
    "ddq-packs:approve-checks",
  ],
  AGENT: ["users:read", "users:invite", "user-permissions:change"],
  STAKEHOLDER: ["users:read", "users:invite", "user-permissions:change"],
} as const satisfies Record<CorporationType, readonly string[]>;

export type PermissionByCorporationType = typeof PERMISSIONS_BY_CORPORATION_TYPE;
export type AssociationPermission = PermissionByCorporationType["ASSOCIATION"][number];
export type ProviderPermission = PermissionByCorporationType["PROVIDER"][number];
export type AgentPermission = PermissionByCorporationType["AGENT"][number];
export type StakeholderPermission = PermissionByCorporationType["STAKEHOLDER"][number];
export type Permission =
  | AssociationPermission
  | ProviderPermission
  | AgentPermission
  | StakeholderPermission;

export function getPermissionsForCorporationType(type: CorporationType): readonly Permission[] {
  return PERMISSIONS_BY_CORPORATION_TYPE[type];
}

export function isPermissionForCorporationType(
  type: CorporationType,
  value: string,
): value is Permission {
  return getPermissionsForCorporationType(type).includes(value as Permission);
}

export function validatePermissionsForCorporationType(
  type: CorporationType,
  values: string[],
): Permission[] {
  const invalidPermission = values.find((value) => !isPermissionForCorporationType(type, value));

  if (invalidPermission) {
    throw new Error(`Invalid permission for ${type}: ${invalidPermission}`);
  }

  return [...new Set(values)] as Permission[];
}

export function getEffectivePermissions(
  user: { permissions: readonly Permission[] },
  corporation: { type: CorporationType },
): Permission[] {
  const allowedPermissions = getPermissionsForCorporationType(corporation.type);
  return user.permissions.filter((permission) => allowedPermissions.includes(permission));
}

export function hasPermission(
  context: {
    user: { permissions: readonly Permission[] };
    corporation: { type: CorporationType };
  },
  permission: Permission,
) {
  if (!isPermissionForCorporationType(context.corporation.type, permission)) {
    return false;
  }

  return context.user.permissions.includes(permission);
}
