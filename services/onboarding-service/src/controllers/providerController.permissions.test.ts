import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireProviderUser } from "../services/currentUser";
import {
  approveProviderAccessRequest,
  approveProviderCorporationApplication,
  changeProviderDDQChecklistStatus,
  changeProviderDDQChecklistTaskStatus,
  completeProviderDDQChecklistTaskFormResponse,
  createProviderDDQChecklist,
  createProviderDDQChecklistTaskEvidenceUploadUrl,
  createProviderDDQPack,
  getProviderAccessRequests,
  getProviderCorporationApplications,
  listAvailableProviderDDQPacks,
  listProviderDDQPackItems,
  listProviderDDQPacks,
  readProviderDDQChecklist,
  readProviderDDQChecklistTask,
  rejectProviderAccessRequest,
  rejectProviderCorporationApplication,
  saveProviderDDQChecklistTaskFormResponse,
  updateProviderDDQChecklistTaskEvidenceTags,
} from "./providerController";

vi.mock("../services/currentUser", () => ({
  requireProviderUser: vi.fn(),
}));

vi.mock("../services/onboardingService", () => ({
  addProviderDDQPack: vi.fn(),
  approveProviderCorporationApplication: vi.fn(),
  changeProviderDDQChecklistStatus: vi.fn(),
  changeProviderDDQChecklistTaskStatus: vi.fn(),
  completeProviderDDQChecklistTaskFormResponse: vi.fn(),
  createProviderDDQChecklistTaskEvidenceUploadUrl: vi.fn(),
  decideProviderAccessRequest: vi.fn(),
  getAvailableProviderDDQPacks: vi.fn(),
  getOrCreateProviderDDQChecklist: vi.fn(),
  getProviderAccessRequests: vi.fn(),
  getProviderCorporationApplications: vi.fn(),
  getProviderDDQChecklist: vi.fn(),
  getProviderDDQChecklistTask: vi.fn(),
  getProviderDDQPackItems: vi.fn(),
  getProviderDDQPacks: vi.fn(),
  rejectProviderCorporationApplication: vi.fn(),
  saveProviderDDQChecklistTaskFormResponse: vi.fn(),
  updateProviderDDQChecklistTaskEvidenceTags: vi.fn(),
}));

const protectedOperations = [
  getProviderAccessRequests,
  getProviderCorporationApplications,
  listProviderDDQPacks,
  listAvailableProviderDDQPacks,
  createProviderDDQPack,
  listProviderDDQPackItems,
  readProviderDDQChecklist,
  createProviderDDQChecklist,
  changeProviderDDQChecklistStatus,
  changeProviderDDQChecklistTaskStatus,
  readProviderDDQChecklistTask,
  saveProviderDDQChecklistTaskFormResponse,
  completeProviderDDQChecklistTaskFormResponse,
  createProviderDDQChecklistTaskEvidenceUploadUrl,
  updateProviderDDQChecklistTaskEvidenceTags,
  approveProviderCorporationApplication,
  rejectProviderCorporationApplication,
  approveProviderAccessRequest,
  rejectProviderAccessRequest,
];

describe("provider controller permission gates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProviderUser).mockResolvedValue(null);
  });

  it.each(protectedOperations)(
    "requires provider users for protected operation",
    async (handler) => {
      const req = mockRequest();
      const res = mockResponse();

      await handler(req, res);

      expect(requireProviderUser).toHaveBeenCalledWith(req, res);
    },
  );
});

function mockRequest() {
  return {
    body: {},
    params: { id: "1", packId: "1", taskId: "1", evidenceId: "1" },
  } as never;
}

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as never;
}
