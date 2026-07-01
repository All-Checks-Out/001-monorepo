import { cleanup, render, screen } from "@testing-library/react";
import {
  getPermissionsForCorporationType,
  hasPermission as hasSharedPermission,
  type CorporationType,
  type Permission,
} from "@shared/permissions";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoreRouteContent } from "./CoreRouteContent";
import { useCurrentUser } from "./context/CurrentUserContext";

vi.mock("@frontend/auth/session/ThemeProvider", () => ({
  useTheme: () => ({ dark: false }),
}));

vi.mock("./context/CurrentUserContext", () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock("./pages/AssociationAccessRequests", () => ({
  default: () => <span>Association access requests page</span>,
}));
vi.mock("./pages/AssociationDDQPackContent", () => ({
  default: () => <span>Association DDQ pack content page</span>,
}));
vi.mock("./pages/AssociationDDQPacks", () => ({
  default: () => <span>Association DDQ packs page</span>,
}));
vi.mock("./pages/AssociationProviders", () => ({
  default: () => <span>Association providers page</span>,
}));
vi.mock("./pages/AssociationSystemData", () => ({
  default: () => <span>Association system data page</span>,
}));
vi.mock("./pages/OwnRequests", () => ({
  default: () => <span>Own requests page</span>,
}));
vi.mock("./pages/ProviderAccessRequests", () => ({
  default: () => <span>Provider access requests page</span>,
}));
vi.mock("./pages/ProviderDDQChecklist", () => ({
  default: () => <span>Provider DDQ checklist page</span>,
}));
vi.mock("./pages/ProviderDDQChecklistTaskPage", () => ({
  ProviderDDQChecklistTaskPage: () => <span>Provider DDQ task page</span>,
}));
vi.mock("./pages/ProviderDDQPacks", () => ({
  default: () => <span>Provider DDQ packs page</span>,
}));
vi.mock("./pages/ProviderDirectory", () => ({
  default: () => <span>Provider directory page</span>,
}));
vi.mock("./pages/ProviderSetupRequests", () => ({
  default: () => <span>Provider setup requests page</span>,
}));
vi.mock("./pages/UsersPage", () => ({
  default: () => <span>Users page</span>,
}));

const protectedRoutes: ProtectedRouteCase[] = [
  {
    path: "/association/providers",
    text: "Association providers page",
    corporationTypes: ["ASSOCIATION"],
    permissions: ["association-provider-requests:read"],
  },
  {
    path: "/association/system-data",
    text: "Association system data page",
    corporationTypes: ["ASSOCIATION"],
    permissions: ["all-corporations:read", "all-users:read"],
    mode: "all",
  },
  {
    path: "/association/users",
    text: "Users page",
    corporationTypes: ["ASSOCIATION"],
    permissions: ["own-users:read"],
  },
  {
    path: "/association/access-requests",
    text: "Association access requests page",
    corporationTypes: ["ASSOCIATION"],
    permissions: ["association-provider-requests:read"],
  },
  {
    path: "/association/ddq-packs",
    text: "Association DDQ packs page",
    corporationTypes: ["ASSOCIATION"],
    permissions: ["association-ddq-packs:read"],
  },
  {
    path: "/association/ddq-packs/1",
    text: "Association DDQ pack content page",
    corporationTypes: ["ASSOCIATION"],
    permissions: ["association-ddq-packs:read"],
  },
  {
    path: "/provider/ddq-packs",
    text: "Provider DDQ packs page",
    corporationTypes: ["PROVIDER"],
  },
  {
    path: "/provider/ddq-packs/1/checklist",
    text: "Provider DDQ checklist page",
    corporationTypes: ["PROVIDER"],
  },
  {
    path: "/provider/ddq-packs/1/checklist/tasks/2",
    text: "Provider DDQ task page",
    corporationTypes: ["PROVIDER"],
  },
  {
    path: "/provider/users",
    text: "Users page",
    corporationTypes: ["PROVIDER"],
    permissions: ["own-users:read"],
  },
  {
    path: "/provider/setup-requests",
    text: "Provider setup requests page",
    corporationTypes: ["PROVIDER"],
    permissions: [
      "provider-agent-requests:read",
      "provider-stakeholder-requests:read",
    ],
  },
  {
    path: "/provider/access-requests",
    text: "Provider access requests page",
    corporationTypes: ["PROVIDER"],
    permissions: [
      "provider-agent-requests:read",
      "provider-stakeholder-requests:read",
    ],
  },
  {
    path: "/agent/providers",
    text: "Provider directory page",
    corporationTypes: ["AGENT"],
  },
  {
    path: "/agent/requests",
    text: "Own requests page",
    corporationTypes: ["AGENT"],
  },
  {
    path: "/agent/users",
    text: "Users page",
    corporationTypes: ["AGENT"],
    permissions: ["own-users:read"],
  },
  {
    path: "/stakeholder/providers",
    text: "Provider directory page",
    corporationTypes: ["STAKEHOLDER"],
  },
  {
    path: "/stakeholder/requests",
    text: "Own requests page",
    corporationTypes: ["STAKEHOLDER"],
  },
  {
    path: "/stakeholder/users",
    text: "Users page",
    corporationTypes: ["STAKEHOLDER"],
    permissions: ["own-users:read"],
  },
];

const corporationTypes: CorporationType[] = [
  "ASSOCIATION",
  "PROVIDER",
  "AGENT",
  "STAKEHOLDER",
];

describe("CoreRouteContent permission gates", () => {
  afterEach(() => {
    cleanup();
  });

  it.each(protectedRoutes)(
    "protects $path for every corporation user type",
    (route) => {
      for (const corporationType of corporationTypes) {
        const allPermissions = [...getPermissionsForCorporationType(corporationType)];

        cleanup();
        mockCurrentUser(corporationType, allPermissions);
        renderRoute(route.path);
        expect(Boolean(screen.queryByText(route.text))).toBe(
          routeAllows(route, corporationType, allPermissions),
        );

        cleanup();
        mockCurrentUser(corporationType, []);
        renderRoute(route.path);
        expect(Boolean(screen.queryByText(route.text))).toBe(
          routeAllows(route, corporationType, []),
        );
      }
    },
  );
});

type ProtectedRouteCase = {
  path: string;
  text: string;
  corporationTypes: CorporationType[];
  permissions?: Permission[];
  mode?: "any" | "all";
};

function routeAllows(
  route: ProtectedRouteCase,
  corporationType: CorporationType,
  permissions: Permission[],
) {
  if (!route.corporationTypes.includes(corporationType)) return false;
  if (!route.permissions || route.permissions.length === 0) return true;

  const checks = route.permissions.map((permission) =>
    hasSharedPermission({ user: { permissions }, corporationType }, permission),
  );

  return route.mode === "all" ? checks.every(Boolean) : checks.some(Boolean);
}

function renderRoute(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <CoreRouteContent />
    </MemoryRouter>,
  );
}

function mockCurrentUser(
  corporationType: CorporationType,
  permissions: Permission[],
) {
  vi.mocked(useCurrentUser).mockReturnValue({
    user: null,
    corporation: null,
    corporationType,
    loading: false,
    effectivePermissions: permissions,
    hasPermission: (permission) =>
      hasSharedPermission({ user: { permissions }, corporationType }, permission),
    refreshCurrentUser: vi.fn(),
  });
}
