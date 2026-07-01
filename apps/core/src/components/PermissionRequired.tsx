import type { CorporationType, Permission } from "@shared/permissions";
import type { ReactNode } from "react";
import Page from "./Page";
import Status from "./Status";
import { useCurrentUser } from "../context/CurrentUserContext";

type PermissionRequirement =
  | Permission
  | { anyOf: Permission[] }
  | { allOf: Permission[] };

interface PermissionRequiredProps {
  corporationTypes?: CorporationType[];
  permissions?: PermissionRequirement;
  children: ReactNode;
  title?: string | null;
}

const PermissionRequired = ({
  corporationTypes,
  permissions,
  children,
  title = null,
}: PermissionRequiredProps) => {
  const { corporationType, loading, hasPermission } = useCurrentUser();

  if (loading) {
    return <Page title={title}>Loading...</Page>;
  }

  if (
    !canAccess(
      { corporationType, hasPermission },
      { corporationTypes, permissions },
    )
  ) {
    return (
      <Page title={title}>
        <Status error="You do not have permission to access this page." />
      </Page>
    );
  }

  return <>{children}</>;
};

export default PermissionRequired;

type AccessContext = {
  corporationType: CorporationType | null;
  hasPermission: (permission: Permission) => boolean;
};

type AccessRequirement = {
  corporationTypes?: CorporationType[];
  permissions?: PermissionRequirement;
};

function canAccess(
  context: AccessContext,
  requirement: AccessRequirement,
) {
  return (
    hasRequiredCorporationType(context, requirement.corporationTypes) &&
    hasRequiredPermissions(context, requirement.permissions)
  );
}

function hasRequiredCorporationType(
  context: AccessContext,
  corporationTypes?: CorporationType[],
) {
  return (
    !corporationTypes ||
    (context.corporationType !== null &&
      corporationTypes.includes(context.corporationType))
  );
}

function hasRequiredPermissions(
  context: AccessContext,
  permissions?: PermissionRequirement,
) {
  if (!permissions) return true;
  if (typeof permissions === "string") return context.hasPermission(permissions);
  if ("allOf" in permissions) {
    return permissions.allOf.every((permission) =>
      context.hasPermission(permission),
    );
  }

  return permissions.anyOf.some((permission) =>
    context.hasPermission(permission),
  );
}
