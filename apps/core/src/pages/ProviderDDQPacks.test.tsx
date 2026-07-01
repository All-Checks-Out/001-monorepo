import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Permission } from "@shared/permissions";
import { listProviderDDQPacks } from "@frontend/api/onboarding/client";
import ProviderDDQPacks from "./ProviderDDQPacks";
import { useCurrentUser } from "../context/CurrentUserContext";

vi.mock("../context/CurrentUserContext", () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock("@frontend/api/onboarding/client", () => ({
  addProviderDDQPack: vi.fn(),
  createProviderDDQChecklist: vi.fn(),
  listAvailableProviderDDQPacks: vi.fn(),
  listProviderDDQPackItems: vi.fn(),
  listProviderDDQPacks: vi.fn(),
}));

describe("ProviderDDQPacks", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listProviderDDQPacks).mockResolvedValue({ packs: [] });
  });

  it("hides the add DDQ Pack action when the user lacks ddq-packs:add-new", async () => {
    mockCurrentUserPermissions([]);

    renderProviderDDQPacks();

    await waitFor(() => expect(listProviderDDQPacks).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Add DDQ Pack" })).toBeNull();
  });

  it("shows the add DDQ Pack action when the user has ddq-packs:add-new", async () => {
    mockCurrentUserPermissions(["ddq-packs:add-new"]);

    renderProviderDDQPacks();

    await waitFor(() => expect(listProviderDDQPacks).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Add DDQ Pack" })).toBeTruthy();
  });
});

function renderProviderDDQPacks() {
  render(
    <MemoryRouter>
      <ProviderDDQPacks />
    </MemoryRouter>,
  );
}

function mockCurrentUserPermissions(permissions: Permission[]) {
  vi.mocked(useCurrentUser).mockReturnValue({
    user: null,
    corporation: null,
    corporationType: "PROVIDER",
    loading: false,
    effectivePermissions: permissions,
    hasPermission: (permission) => permissions.includes(permission),
    refreshCurrentUser: vi.fn(),
  });
}
