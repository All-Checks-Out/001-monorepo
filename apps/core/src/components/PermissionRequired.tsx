import type { Permission } from "@shared/permissions";
import type { ReactNode } from "react";
import Page from "./Page";
import Status from "./Status";
import { useCurrentUser } from "../context/CurrentUserContext";

interface PermissionRequiredProps {
  permission?: Permission;
  permissions?: Permission[];
  children: ReactNode;
  title?: string | null;
}

const PermissionRequired = ({
  permission,
  permissions,
  children,
  title = null,
}: PermissionRequiredProps) => {
  const { loading, hasPermission } = useCurrentUser();
  const requiredPermissions = permissions ?? (permission ? [permission] : []);

  if (loading) {
    return <Page title={title}>Loading...</Page>;
  }

  if (!requiredPermissions.some((requiredPermission) => hasPermission(requiredPermission))) {
    return (
      <Page title={title}>
        <Status error="You do not have permission to access this page." />
      </Page>
    );
  }

  return <>{children}</>;
};

export default PermissionRequired;
