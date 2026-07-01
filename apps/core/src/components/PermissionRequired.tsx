import type { Permission } from "@shared/permissions";
import type { ReactNode } from "react";
import Page from "./Page";
import Status from "./Status";
import { useCurrentUser } from "../context/CurrentUserContext";

interface PermissionRequiredProps {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  children: ReactNode;
  title?: string | null;
}

const PermissionRequired = ({
  permission,
  permissions,
  requireAll = false,
  children,
  title = null,
}: PermissionRequiredProps) => {
  const { loading, hasPermission } = useCurrentUser();
  const requiredPermissions = permissions ?? (permission ? [permission] : []);

  if (loading) {
    return <Page title={title}>Loading...</Page>;
  }

  const hasRequiredPermissions = requireAll
    ? requiredPermissions.every((requiredPermission) => hasPermission(requiredPermission))
    : requiredPermissions.some((requiredPermission) => hasPermission(requiredPermission));

  if (!hasRequiredPermissions) {
    return (
      <Page title={title}>
        <Status error="You do not have permission to access this page." />
      </Page>
    );
  }

  return <>{children}</>;
};

export default PermissionRequired;
