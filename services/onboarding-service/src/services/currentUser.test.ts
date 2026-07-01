import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPermissionsForCorporationType,
  PERMISSIONS_BY_CORPORATION_TYPE,
  type CorporationType,
  type Permission,
} from "@shared/permissions";
import { createDbClient } from "../database/db";
import { getCurrentAppUser } from "../database/appUserRepository";
import {
  requireAssociationUserWithPermission,
  requirePermission,
  requireProviderUserWithPermission,
} from "./currentUser";

vi.mock("../database/db", () => ({
  createDbClient: vi.fn(),
}));

vi.mock("../database/appUserRepository", () => ({
  getCurrentAppUser: vi.fn(),
}));

const corporationTypes = Object.keys(
  PERMISSIONS_BY_CORPORATION_TYPE,
) as CorporationType[];
const allPermissions = [
  ...new Set(corporationTypes.flatMap((type) => PERMISSIONS_BY_CORPORATION_TYPE[type])),
] as Permission[];

describe("current user permission guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createDbClient).mockResolvedValue({ end: vi.fn() } as never);
  });

  it.each(allPermissions)(
    "requires %s for every corporation user type",
    async (permission) => {
      for (const corporationType of corporationTypes) {
        const allowedPermissions = getPermissionsForCorporationType(corporationType);
        const permissionBelongsToCorporation =
          allowedPermissions.includes(permission);

        await expectGuardResult({
          corporationType,
          permissions: allowedPermissions,
          permission,
          expectedAllowed: permissionBelongsToCorporation,
        });
        await expectGuardResult({
          corporationType,
          permissions: [],
          permission,
          expectedAllowed: false,
        });
      }
    },
  );

  it.each(PERMISSIONS_BY_CORPORATION_TYPE.ASSOCIATION)(
    "requires association users with %s",
    async (permission) => {
      for (const corporationType of corporationTypes) {
        const expectedAllowed = corporationType === "ASSOCIATION";

        await expectAssociationGuardResult({
          corporationType,
          permissions: getPermissionsForCorporationType(corporationType),
          permission,
          expectedAllowed,
        });
        await expectAssociationGuardResult({
          corporationType,
          permissions: [],
          permission,
          expectedAllowed: false,
        });
      }
    },
  );

  it.each(PERMISSIONS_BY_CORPORATION_TYPE.PROVIDER)(
    "requires provider users with %s",
    async (permission) => {
      for (const corporationType of corporationTypes) {
        const expectedAllowed = corporationType === "PROVIDER";

        await expectProviderGuardResult({
          corporationType,
          permissions: getPermissionsForCorporationType(corporationType),
          permission,
          expectedAllowed,
        });
        await expectProviderGuardResult({
          corporationType,
          permissions: [],
          permission,
          expectedAllowed: false,
        });
      }
    },
  );
});

async function expectGuardResult(input: GuardInput) {
  const res = mockResponse();
  mockCurrentUser(input.corporationType, input.permissions);

  const result = await requirePermission(mockRequest(), res as never, input.permission);

  expect(Boolean(result)).toBe(input.expectedAllowed);
  if (!input.expectedAllowed) {
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Permission required." });
  }
}

async function expectAssociationGuardResult(input: GuardInput) {
  const res = mockResponse();
  mockCurrentUser(input.corporationType, input.permissions);

  const result = await requireAssociationUserWithPermission(
    mockRequest(),
    res as never,
    input.permission,
  );

  expect(Boolean(result)).toBe(input.expectedAllowed);
  if (!input.expectedAllowed) {
    expect(res.status).toHaveBeenCalledWith(403);
  }
}

async function expectProviderGuardResult(input: GuardInput) {
  const res = mockResponse();
  mockCurrentUser(input.corporationType, input.permissions);

  const result = await requireProviderUserWithPermission(
    mockRequest(),
    res as never,
    input.permission,
  );

  expect(Boolean(result)).toBe(input.expectedAllowed);
  if (!input.expectedAllowed) {
    expect(res.status).toHaveBeenCalledWith(403);
  }
}

type GuardInput = {
  corporationType: CorporationType;
  permissions: readonly Permission[];
  permission: Permission;
  expectedAllowed: boolean;
};

function mockRequest() {
  return { auth: { sub: "current-user" } } as never;
}

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
}

function mockCurrentUser(
  corporationType: CorporationType,
  permissions: readonly Permission[],
) {
  vi.mocked(getCurrentAppUser).mockResolvedValue({
    id: 1,
    corporation_id: 10,
    cognito_sub: "current-user",
    email: "current@example.test",
    status: "active",
    permissions: [...permissions],
    corporation_name: `${corporationType} Corp`,
    corporation_type: corporationType,
    corporation_status: "approved",
  } as never);
}
