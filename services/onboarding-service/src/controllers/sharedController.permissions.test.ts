import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Permission } from "@shared/permissions";
import { requirePermission } from "../services/currentUser";
import {
  getMyUsers,
  inviteMyUser,
  updateMyCorporationUserPermissions,
} from "./sharedController";

vi.mock("../services/currentUser", () => ({
  getCurrentUserContext: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("../services/onboardingService", () => ({
  getMyAccessRequests: vi.fn(),
  getMyUsers: vi.fn(),
  inviteUserForMyCorporation: vi.fn(),
  updateOtherUserPermissionsForMyCorporation: vi.fn(),
}));

const protectedOperations: ProtectedOperation[] = [
  [getMyUsers, "own-users:read"],
  [inviteMyUser, "own-users:invite"],
  [updateMyCorporationUserPermissions, "own-user-permissions:change"],
];

describe("shared controller permission gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requirePermission).mockResolvedValue(null);
  });

  it.each(protectedOperations)(
    "uses %s for protected operation",
    async (handler, permission) => {
      const req = mockRequest();
      const res = mockResponse();

      await handler(req, res);

      expect(requirePermission).toHaveBeenCalledWith(req, res, permission);
    },
  );
});

type Handler = (req: never, res: never) => Promise<void>;
type ProtectedOperation = [Handler, Permission];

function mockRequest() {
  return {
    body: { email: "user@example.test", permissions: [] },
    params: { id: "1" },
  } as never;
}

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as never;
}
