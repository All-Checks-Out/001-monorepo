import { useTheme } from "@frontend/auth/session/ThemeProvider";
import type { Permission } from "@shared/permissions";
import { useEffect, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import PermissionRequired from "./components/PermissionRequired";
import type { RemoteAppProps } from "./hostContext";
import AssociationAccessRequests from "./pages/AssociationAccessRequests";
import AssociationDDQPackContent from "./pages/AssociationDDQPackContent";
import AssociationDDQPacks from "./pages/AssociationDDQPacks";
import AssociationProviders from "./pages/AssociationProviders";
import AssociationSystemData from "./pages/AssociationSystemData";
import Callback from "./pages/Callback";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import OwnRequests from "./pages/OwnRequests";
import Profile from "./pages/Profile";
import ProviderAccessRequests from "./pages/ProviderAccessRequests";
import ProviderDDQChecklist from "./pages/ProviderDDQChecklist";
import { ProviderDDQChecklistTaskPage } from "./pages/ProviderDDQChecklistTaskPage";
import ProviderDDQPacks from "./pages/ProviderDDQPacks";
import ProviderDirectory from "./pages/ProviderDirectory";
import ProviderSetupRequests from "./pages/ProviderSetupRequests";
import UsersPage from "./pages/UsersPage";

type GuardOptions = {
  title?: string;
};

const guard = (
  permission: Permission,
  element: ReactNode,
  { title }: GuardOptions = {},
) => (
  <PermissionRequired permission={permission} title={title}>
    {element}
  </PermissionRequired>
);

const guardAny = (
  permissions: Permission[],
  element: ReactNode,
  { title }: GuardOptions = {},
) => (
  <PermissionRequired permissions={permissions} title={title}>
    {element}
  </PermissionRequired>
);

const useDocumentTheme = (hostContext?: RemoteAppProps["hostContext"]) => {
  const { dark } = useTheme();
  const documentDark = hostContext?.theme.dark ?? dark;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", documentDark);
  }, [documentDark]);
};

export const CoreRouteContent = ({ hostContext }: RemoteAppProps) => {
  useDocumentTheme(hostContext);

  return (
    <Routes>
      <Route index element={<Home hostAuth={hostContext?.auth} />} />
      <Route path="callback" element={<Callback />} />
      <Route path="profile" element={<Profile />} />
      <Route
        path="association/providers"
        element={guard("provider-requests:read", <AssociationProviders />)}
      />
      <Route
        path="association/system-data"
        element={guard("system-data:read", <AssociationSystemData />)}
      />
      <Route
        path="association/users"
        element={guard("users:read", <UsersPage />, { title: "Users" })}
      />
      <Route
        path="association/access-requests"
        element={guard("provider-requests:read", <AssociationAccessRequests />, {
          title: "Access requests",
        })}
      />
      <Route
        path="association/ddq-packs"
        element={guard("ddq-packs:read", <AssociationDDQPacks />)}
      />
      <Route
        path="association/ddq-packs/:packId"
        element={guard("ddq-packs:read", <AssociationDDQPackContent />)}
      />
      <Route path="provider/ddq-packs" element={<ProviderDDQPacks />} />
      <Route
        path="provider/ddq-packs/:packId/checklist"
        element={<ProviderDDQChecklist />}
      />
      <Route
        path="provider/ddq-packs/:packId/checklist/tasks/:taskId"
        element={<ProviderDDQChecklistTaskPage />}
      />
      <Route
        path="provider/users"
        element={guard("users:read", <UsersPage />, { title: "Users" })}
      />
      <Route
        path="provider/setup-requests"
        element={guardAny(
          ["agent-requests:read", "stakeholder-requests:read"],
          <ProviderSetupRequests />,
          { title: "Setup requests" },
        )}
      />
      <Route
        path="provider/access-requests"
        element={guardAny(
          ["agent-requests:read", "stakeholder-requests:read"],
          <ProviderAccessRequests />,
          { title: "Access requests" },
        )}
      />
      <Route path="agent/providers" element={<ProviderDirectory />} />
      <Route path="agent/requests" element={<OwnRequests />} />
      <Route
        path="agent/users"
        element={guard("users:read", <UsersPage />, { title: "Users" })}
      />
      <Route path="stakeholder/providers" element={<ProviderDirectory />} />
      <Route path="stakeholder/requests" element={<OwnRequests />} />
      <Route
        path="stakeholder/users"
        element={guard("users:read", <UsersPage />, { title: "Users" })}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
