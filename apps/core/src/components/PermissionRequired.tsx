import type { Permission } from "@shared/permissions";
import type { ReactNode } from "react";
import Page from "./Page";
import Status from "./Status";
import { useCurrentUser } from "../context/CurrentUserContext";

interface PermissionRequiredProps {
  permission: Permission;
  children: ReactNode;
  title?: string | null;
}

const PermissionRequired = ({
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

export default PermissionRequired;
