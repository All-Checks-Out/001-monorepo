import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Permission } from "@shared/permissions";
import { requireAssociationUserWithPermission } from "../services/currentUser";
import {
  approveAssociationAccessRequest,
  approveAssociationCorporationApplication,
  changeAssociationDDQPackStatusController,
  createAssociationDDQPackController,
  createAssociationDDQPackItemController,
  createAssociationFormTemplateController,
  deleteAssociationDDQPackController,
  deleteAssociationDDQPackItemController,
  deleteAssociationFormTemplateController,
  getAssociationAccessRequests,
  getAssociationCorporationApplications,
  getAssociationCorporations,
  getAssociationUsers,
  listAssociationDDQPackItems,
  listAssociationDDQPacks,
  listAssociationFormTemplates,
  readAssociationDDQPack,
  readAssociationFormTemplate,
  rejectAssociationAccessRequest,
  rejectAssociationCorporationApplication,
  saveAssociationDDQPackDraftController,
  updateAssociationDDQPackController,
  updateAssociationDDQPackItemController,
  updateAssociationFormTemplateController,
} from "./associationController";

vi.mock("../services/currentUser", () => ({
  requireAssociationUserWithPermission: vi.fn(),
}));

vi.mock("../services/onboardingService", () => ({
  approveAssociationApplication: vi.fn(),
  changeAssociationDDQPackStatus: vi.fn(),
  createAssociationDDQPack: vi.fn(),
  createAssociationDDQPackItem: vi.fn(),
  createAssociationFormTemplate: vi.fn(),
  decideAssociationAccessRequest: vi.fn(),
  deleteAssociationDDQPack: vi.fn(),
  deleteAssociationDDQPackItem: vi.fn(),
  deleteAssociationFormTemplate: vi.fn(),
  getAssociationAccessRequests: vi.fn(),
  getAssociationApplications: vi.fn(),
  getAssociationCorporations: vi.fn(),
  getAssociationDDQPack: vi.fn(),
  getAssociationDDQPackItems: vi.fn(),
  getAssociationDDQPacks: vi.fn(),
  getAssociationFormTemplate: vi.fn(),
  getAssociationFormTemplates: vi.fn(),
  getAssociationUsers: vi.fn(),
  rejectAssociationApplication: vi.fn(),
  saveAssociationDDQPackDraft: vi.fn(),
  updateAssociationDDQPack: vi.fn(),
  updateAssociationDDQPackItem: vi.fn(),
  updateAssociationFormTemplate: vi.fn(),
}));

const protectedOperations: ProtectedOperation[] = [
  [getAssociationCorporationApplications, "association-provider-requests:read"],
  [approveAssociationCorporationApplication, "association-provider-requests:approve"],
  [rejectAssociationCorporationApplication, "association-provider-requests:approve"],
  [getAssociationCorporations, "all-corporations:read"],
  [getAssociationUsers, "all-users:read"],
  [getAssociationAccessRequests, "association-provider-requests:read"],
  [approveAssociationAccessRequest, "association-provider-requests:approve"],
  [rejectAssociationAccessRequest, "association-provider-requests:approve"],
  [listAssociationDDQPacks, "association-ddq-packs:read"],
  [readAssociationDDQPack, "association-ddq-packs:read"],
  [createAssociationDDQPackController, "association-ddq-packs:edit"],
  [updateAssociationDDQPackController, "association-ddq-packs:edit"],
  [saveAssociationDDQPackDraftController, "association-ddq-packs:edit"],
  [changeAssociationDDQPackStatusController, "association-ddq-packs:edit"],
  [deleteAssociationDDQPackController, "association-ddq-packs:edit"],
  [listAssociationDDQPackItems, "association-ddq-packs:read"],
  [createAssociationDDQPackItemController, "association-ddq-packs:edit"],
  [updateAssociationDDQPackItemController, "association-ddq-packs:edit"],
  [deleteAssociationDDQPackItemController, "association-ddq-packs:edit"],
  [listAssociationFormTemplates, "association-forms:read"],
  [readAssociationFormTemplate, "association-forms:read"],
  [createAssociationFormTemplateController, "association-forms:edit"],
  [updateAssociationFormTemplateController, "association-forms:edit"],
  [deleteAssociationFormTemplateController, "association-forms:edit"],
];

describe("association controller permission gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAssociationUserWithPermission).mockResolvedValue(null);
  });

  it.each(protectedOperations)(
    "uses %s for protected operation",
    async (handler, permission) => {
      const req = mockRequest();
      const res = mockResponse();

      await handler(req, res);

      expect(requireAssociationUserWithPermission).toHaveBeenCalledWith(
        req,
        res,
        permission,
      );
    },
  );
});

type Handler = (req: never, res: never) => Promise<void>;
type ProtectedOperation = [Handler, Permission];

function mockRequest() {
  return {
    body: {},
    params: { id: "1", packId: "1", itemId: "1" },
  } as never;
}

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as never;
}
