import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireProviderUser } from "../services/currentUser";
import {
  archiveProviderSubject,
  approveProviderAccessRequest,
  approveProviderCorporationApplication,
  changeProviderDDQChecklistStatus,
  changeProviderDDQChecklistTaskStatus,
  completeProviderDDQChecklistTaskFormResponse,
  createProviderDDQChecklist,
  createProviderDDQChecklistTaskEvidenceUploadUrl,
  createProviderDDQPack,
  createProviderSubject,
  getProviderAccessRequests,
  getProviderCorporationApplications,
  listAvailableProviderDDQPacks,
  listProviderDDQPackItems,
  listProviderDDQPacks,
  listProviderSubjects,
  readProviderDDQChecklist,
  readProviderDDQChecklistTask,
  readProviderSubject,
  rejectProviderAccessRequest,
  rejectProviderCorporationApplication,
  saveProviderDDQChecklistTaskFormResponse,
  updateProviderSubject,
  updateProviderDDQChecklistTaskEvidenceTags,
} from "./providerController";
import { saveProviderDDQChecklistTaskFormResponse as saveProviderDDQChecklistTaskFormResponseService } from "../services/onboardingService";

vi.mock("../services/currentUser", () => ({
  requireProviderUser: vi.fn(),
}));

vi.mock("../services/onboardingService", () => ({
  addProviderDDQPack: vi.fn(),
  archiveProviderSubject: vi.fn(),
  approveProviderCorporationApplication: vi.fn(),
  changeProviderDDQChecklistStatus: vi.fn(),
  changeProviderDDQChecklistTaskStatus: vi.fn(),
  completeProviderDDQChecklistTaskFormResponse: vi.fn(),
  createProviderSubject: vi.fn(),
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
  getProviderSubject: vi.fn(),
  getProviderSubjects: vi.fn(),
  rejectProviderCorporationApplication: vi.fn(),
  saveProviderDDQChecklistTaskFormResponse: vi.fn(),
  updateProviderSubject: vi.fn(),
  updateProviderDDQChecklistTaskEvidenceTags: vi.fn(),
}));

const protectedOperations = [
  getProviderAccessRequests,
  getProviderCorporationApplications,
  listProviderDDQPacks,
  listProviderSubjects,
  readProviderSubject,
  createProviderSubject,
  updateProviderSubject,
  archiveProviderSubject,
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

describe("provider form response parsing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireProviderUser).mockResolvedValue({
      user: { id: 1, corporation_id: 2, permissions: [] },
      corporation: { id: 2, type: "PROVIDER" },
    } as never);
    vi.mocked(saveProviderDDQChecklistTaskFormResponseService).mockResolvedValue({
      formResponse: {
        id: 1,
        checklist_task_id: 1,
        form_document: {
          kind: "form-document",
          version: 1,
          definition: { title: "People", items: [] },
          values: {},
        },
        complete: false,
        errors: {},
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        completed_at: null,
      },
    } as never);
  });

  it("accepts repeatable Subject group values when saving form progress", async () => {
    const req = mockRequest({
      values: {
        people: [
          {
            name: "Jane Doe",
            date_of_birth: "1988-04-12",
          },
        ],
      },
    });
    const res = mockResponse();

    await saveProviderDDQChecklistTaskFormResponse(req, res);

    expect(saveProviderDDQChecklistTaskFormResponseService).toHaveBeenCalledWith(
      expect.anything(),
      1,
      1,
      {
        values: {
          people: [
            {
              name: "Jane Doe",
              date_of_birth: "1988-04-12",
            },
          ],
        },
      },
    );
    expect((res as { status: ReturnType<typeof vi.fn> }).status).not.toHaveBeenCalledWith(400);
  });
});

function mockRequest(body: Record<string, unknown> = {}) {
  return {
    body,
    params: { id: "1", packId: "1", taskId: "1", evidenceId: "1", subjectId: "1" },
    query: {},
  } as never;
}

function mockResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as never;
}
