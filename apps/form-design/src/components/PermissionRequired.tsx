import type { Permission } from "@shared/permissions";
import type { ReactNode } from "react";
import { useCurrentUser } from "../context/CurrentUserContext";
import { Page } from "./Page";
import { Status } from "./Status";

interface PermissionRequiredProps {
  permission: Permission;
  children: ReactNode;
  title?: ReactNode;
}

export const PermissionRequired = ({
  permission,
  children,
  title = null,
}: PermissionRequiredProps) => {
  const { loading, hasPermission } = useCurrentUser();

  if (loading) {
    return <Page title={title}>Loading...</Page>;
  }

  if (!hasPermission(permission)) {
    return (
      <Page title={title}>
        <Status error="You do not have permission to access this page." />
      </Page>
    );
  }

  return <>{children}</>;
};
