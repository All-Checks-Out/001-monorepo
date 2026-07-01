import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Permission } from "@shared/permissions";
import PermissionRequired from "./PermissionRequired";
import { useCurrentUser } from "../context/CurrentUserContext";

vi.mock("../context/CurrentUserContext", () => ({
  useCurrentUser: vi.fn(),
}));

describe("PermissionRequired", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mockCurrentUserPermissions([]);
  });

  it("renders protected content when the user has the required permission", () => {
    mockCurrentUserPermissions(["users:read"]);

    render(
      <PermissionRequired permission="users:read">
        <span>Protected users page</span>
      </PermissionRequired>,
    );

    expect(screen.getByText("Protected users page")).toBeTruthy();
  });

  it("renders an access denied message when the user lacks the required permission", () => {
    mockCurrentUserPermissions([]);

    render(
      <PermissionRequired permission="users:read">
        <span>Protected users page</span>
      </PermissionRequired>,
    );

    expect(
      screen.getByText("You do not have permission to access this page."),
    ).toBeTruthy();
    expect(screen.queryByText("Protected users page")).toBeNull();
  });

  it("renders protected content when the user has any required permission", () => {
    mockCurrentUserPermissions(["stakeholder-requests:read"]);

    render(
      <PermissionRequired
        permissions={["agent-requests:read", "stakeholder-requests:read"]}
      >
        <span>Provider requests</span>
      </PermissionRequired>,
    );

    expect(screen.getByText("Provider requests")).toBeTruthy();
  });
});

function mockCurrentUserPermissions(permissions: Permission[]) {
  vi.mocked(useCurrentUser).mockReturnValue({
    user: null,
    corporation: null,
    corporationType: null,
    loading: false,
    effectivePermissions: permissions,
    hasPermission: (permission) => permissions.includes(permission),
    refreshCurrentUser: vi.fn(),
  });
}
