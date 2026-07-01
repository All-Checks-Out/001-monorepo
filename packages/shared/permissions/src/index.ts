export type CorporationType = "ASSOCIATION" | "PROVIDER" | "AGENT" | "STAKEHOLDER";

export const PERMISSIONS_BY_CORPORATION_TYPE = {
  ASSOCIATION: [
    "association-provider-requests:read",
    "association-provider-requests:approve",
    "all-corporations:read",
    "all-users:read",
    "own-users:read",
    "own-users:invite",
    "own-user-permissions:change",
    "association-ddq-packs:read",
    "association-ddq-packs:edit",
    "association-forms:read",
    "association-forms:edit",
  ],
  PROVIDER: [
    "provider-agent-requests:read",
    "provider-agent-requests:approve",
    "provider-stakeholder-requests:read",
    "provider-stakeholder-requests:approve",
    "own-users:read",
    "own-users:invite",
    "own-user-permissions:change",
    "provider-ddq-packs:add-new",
    "provider-ddq-packs:perform-checks",
    "provider-ddq-packs:review-checks",
    "provider-ddq-packs:approve-checks",
  ],
  AGENT: ["own-users:read", "own-users:invite", "own-user-permissions:change"],
  STAKEHOLDER: ["own-users:read", "own-users:invite", "own-user-permissions:change"],
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

export type PermissionUser = {
  permissions: readonly Permission[];
};

export type PermissionContext = {
  user: PermissionUser | null;
  corporationType: CorporationType | null;
};

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
  context: PermissionContext,
): Permission[] {
  if (!context.user || !context.corporationType) return [];

  const allowedPermissions = getPermissionsForCorporationType(context.corporationType);
  return context.user.permissions.filter((permission) =>
    allowedPermissions.includes(permission),
  );
}

export function hasPermission(
  context: PermissionContext,
  permission: Permission,
) {
  return getEffectivePermissions(context).includes(permission);
}
