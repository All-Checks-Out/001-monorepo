import { useTheme } from "@frontend/auth/session/ThemeProvider";
import type { CorporationType, Permission } from "@shared/permissions";
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
  corporationTypes?: CorporationType[];
  title?: string;
};

const guard = (
  permissions: Permission,
  element: ReactNode,
  { corporationTypes, title }: GuardOptions = {},
) => (
  <PermissionRequired
    permissions={permissions}
    corporationTypes={corporationTypes}
    title={title}
  >
    {element}
  </PermissionRequired>
);

const guardAny = (
  permissions: Permission[],
  element: ReactNode,
  { corporationTypes, title }: GuardOptions = {},
) => (
  <PermissionRequired
    permissions={{ anyOf: permissions }}
    corporationTypes={corporationTypes}
    title={title}
  >
    {element}
  </PermissionRequired>
);

const guardAll = (
  permissions: Permission[],
  element: ReactNode,
  { corporationTypes, title }: GuardOptions = {},
) => (
  <PermissionRequired
    permissions={{ allOf: permissions }}
    corporationTypes={corporationTypes}
    title={title}
  >
    {element}
  </PermissionRequired>
);

const guardCorporation = (
  corporationTypes: CorporationType[],
  element: ReactNode,
  { title }: GuardOptions = {},
) => (
  <PermissionRequired corporationTypes={corporationTypes} title={title}>
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
        element={guard(
          "association-provider-requests:read",
          <AssociationProviders />,
          { corporationTypes: ["ASSOCIATION"] },
        )}
      />
      <Route
        path="association/system-data"
        element={guardAll(
          ["all-corporations:read", "all-users:read"],
          <AssociationSystemData />,
          { corporationTypes: ["ASSOCIATION"] },
        )}
      />
      <Route
        path="association/users"
        element={guard("own-users:read", <UsersPage />, {
          corporationTypes: ["ASSOCIATION"],
          title: "Users",
        })}
      />
      <Route
        path="association/access-requests"
        element={guard(
          "association-provider-requests:read",
          <AssociationAccessRequests />,
          { corporationTypes: ["ASSOCIATION"], title: "Access requests" },
        )}
      />
      <Route
        path="association/ddq-packs"
        element={guard("association-ddq-packs:read", <AssociationDDQPacks />, {
          corporationTypes: ["ASSOCIATION"],
        })}
      />
      <Route
        path="association/ddq-packs/:packId"
        element={guard(
          "association-ddq-packs:read",
          <AssociationDDQPackContent />,
          { corporationTypes: ["ASSOCIATION"] },
        )}
      />
      <Route
        path="provider/ddq-packs"
        element={guardCorporation(["PROVIDER"], <ProviderDDQPacks />)}
      />
      <Route
        path="provider/ddq-packs/:packId/checklist"
        element={guardCorporation(["PROVIDER"], <ProviderDDQChecklist />)}
      />
      <Route
        path="provider/ddq-packs/:packId/checklist/tasks/:taskId"
        element={guardCorporation(["PROVIDER"], <ProviderDDQChecklistTaskPage />)}
      />
      <Route
        path="provider/users"
        element={guard("own-users:read", <UsersPage />, {
          corporationTypes: ["PROVIDER"],
          title: "Users",
        })}
      />
      <Route
        path="provider/setup-requests"
        element={guardAny(
          [
            "provider-agent-requests:read",
            "provider-stakeholder-requests:read",
          ],
          <ProviderSetupRequests />,
          { corporationTypes: ["PROVIDER"], title: "Setup requests" },
        )}
      />
      <Route
        path="provider/access-requests"
        element={guardAny(
          [
            "provider-agent-requests:read",
            "provider-stakeholder-requests:read",
          ],
          <ProviderAccessRequests />,
          { corporationTypes: ["PROVIDER"], title: "Access requests" },
        )}
      />
      <Route
        path="agent/providers"
        element={guardCorporation(["AGENT"], <ProviderDirectory />)}
      />
      <Route
        path="agent/requests"
        element={guardCorporation(["AGENT"], <OwnRequests />)}
      />
      <Route
        path="agent/users"
        element={guard("own-users:read", <UsersPage />, {
          corporationTypes: ["AGENT"],
          title: "Users",
        })}
      />
      <Route
        path="stakeholder/providers"
        element={guardCorporation(["STAKEHOLDER"], <ProviderDirectory />)}
      />
      <Route
        path="stakeholder/requests"
        element={guardCorporation(["STAKEHOLDER"], <OwnRequests />)}
      />
      <Route
        path="stakeholder/users"
        element={guard("own-users:read", <UsersPage />, {
          corporationTypes: ["STAKEHOLDER"],
          title: "Users",
        })}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};
