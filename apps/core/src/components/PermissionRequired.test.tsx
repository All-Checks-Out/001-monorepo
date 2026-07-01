import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPermissionsForCorporationType,
  hasPermission as hasSharedPermission,
  PERMISSIONS_BY_CORPORATION_TYPE,
  type CorporationType,
  type Permission,
} from "@shared/permissions";
import PermissionRequired from "./PermissionRequired";
import { useCurrentUser } from "../context/CurrentUserContext";

vi.mock("../context/CurrentUserContext", () => ({
  useCurrentUser: vi.fn(),
}));

const corporationTypes = Object.keys(
  PERMISSIONS_BY_CORPORATION_TYPE,
) as CorporationType[];
const allPermissions = [
  ...new Set(corporationTypes.flatMap((type) => PERMISSIONS_BY_CORPORATION_TYPE[type])),
] as Permission[];

describe("PermissionRequired", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockCurrentUserPermissions([]);
  });

  it("renders protected content when the user has the required permission", () => {
    mockCurrentUserPermissions(["own-users:read"]);

    render(
      <PermissionRequired permissions="own-users:read">
        <span>Protected users page</span>
      </PermissionRequired>,
    );

    expect(screen.getByText("Protected users page")).toBeTruthy();
  });

  it("renders an access denied message when the user lacks the required permission", () => {
    mockCurrentUserPermissions([]);

    render(
      <PermissionRequired permissions="own-users:read">
        <span>Protected users page</span>
      </PermissionRequired>,
    );

    expect(
      screen.getByText("You do not have permission to access this page."),
    ).toBeTruthy();
    expect(screen.queryByText("Protected users page")).toBeNull();
  });

  it("renders protected content when the user has any required permission", () => {
    mockCurrentUserPermissions(["provider-stakeholder-requests:read"], "PROVIDER");

    render(
      <PermissionRequired
        permissions={{
          anyOf: [
            "provider-agent-requests:read",
            "provider-stakeholder-requests:read",
          ],
        }}
      >
        <span>Provider requests</span>
      </PermissionRequired>,
    );

    expect(screen.getByText("Provider requests")).toBeTruthy();
  });

  it("renders an access denied message when the user lacks one required permission", () => {
    mockCurrentUserPermissions(["all-corporations:read"]);

    render(
      <PermissionRequired
        permissions={{ allOf: ["all-corporations:read", "all-users:read"] }}
      >
        <span>System data</span>
      </PermissionRequired>,
    );

    expect(
      screen.getByText("You do not have permission to access this page."),
    ).toBeTruthy();
    expect(screen.queryByText("System data")).toBeNull();
  });

  it("renders an access denied message when the user has the permission for the wrong route type", () => {
    mockCurrentUserPermissions(["own-users:read"], "PROVIDER");

    render(
      <PermissionRequired
        permissions="own-users:read"
        corporationTypes={["ASSOCIATION"]}
      >
        <span>Association users</span>
      </PermissionRequired>,
    );

    expect(
      screen.getByText("You do not have permission to access this page."),
    ).toBeTruthy();
    expect(screen.queryByText("Association users")).toBeNull();
  });

  it("renders protected content for corporation-only gates", () => {
    mockCurrentUserPermissions([], "PROVIDER");

    render(
      <PermissionRequired corporationTypes={["PROVIDER"]}>
        <span>Provider page</span>
      </PermissionRequired>,
    );

    expect(screen.getByText("Provider page")).toBeTruthy();
  });

  it.each(allPermissions)(
    "evaluates %s for every corporation user type",
    (permission) => {
      for (const corporationType of corporationTypes) {
        const allowedPermissions = getPermissionsForCorporationType(corporationType);
        const permissionBelongsToCorporation =
          allowedPermissions.includes(permission);

        cleanup();
        mockCurrentUserPermissions([...allowedPermissions], corporationType);
        render(
          <PermissionRequired permissions={permission}>
            <span>Protected content</span>
          </PermissionRequired>,
        );
        expect(Boolean(screen.queryByText("Protected content"))).toBe(
          permissionBelongsToCorporation,
        );

        cleanup();
        mockCurrentUserPermissions([], corporationType);
        render(
          <PermissionRequired permissions={permission}>
            <span>Protected content</span>
          </PermissionRequired>,
        );
        expect(screen.queryByText("Protected content")).toBeNull();
      }
    },
  );
});

function mockCurrentUserPermissions(
  permissions: Permission[],
  corporationType: CorporationType | null = "ASSOCIATION",
) {
  vi.mocked(useCurrentUser).mockReturnValue({
    user: null,
    corporation: null,
    corporationType,
    loading: false,
    effectivePermissions: permissions,
    hasPermission: (permission) =>
      hasSharedPermission(
        {
          user: { permissions },
          corporationType,
        },
        permission,
      ),
    refreshCurrentUser: vi.fn(),
  });
}
