import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPermissionsForCorporationType, type CorporationType } from "@shared/permissions";
import type { CurrentUserContext } from "./currentUser";
import type {
  DDQPackItemRow,
  DDQPackRow,
  FormTemplateDetailRow,
  Permission,
} from "../database/onboardingTypes";
import { createDbClient } from "../database/db";
import {
  getDDQPack,
  getDDQPackForAssociation,
  listAvailableProviderDDQPacks,
  listDDQPackItems,
  createDDQPackItemForAssociation,
} from "../database/ddqPackRepository";
import { upsertChecklistTaskFormResponse } from "../database/ddqChecklistFormResponseRepository";
import {
  readChecklistTaskAutomaticEvidenceTags,
  readChecklistTaskEvidenceTags,
  readLatestUploadedChecklistTaskEvidence,
  readProviderDDQChecklistTaskContext,
} from "../database/ddqChecklistEvidenceRepository";
import { getFormTemplateForAssociation } from "../database/formTemplateRepository";
import {
  createAssociationDDQPackItem,
  getAvailableProviderDDQPacks,
  getProviderDDQPackItems,
  saveProviderDDQChecklistTaskFormResponse,
} from "./onboardingService";

vi.mock("../database/db", () => ({
  createDbClient: vi.fn(),
}));

vi.mock("../database/ddqPackRepository", () => ({
  addProviderDDQPack: vi.fn(),
  createDDQPackForAssociation: vi.fn(),
  createDDQPackItemForAssociation: vi.fn(),
  deleteDDQPackForAssociation: vi.fn(),
  deleteDDQPackItemForAssociation: vi.fn(),
  getDDQPack: vi.fn(),
  getDDQPackForAssociation: vi.fn(),
  listAvailableProviderDDQPacks: vi.fn(),
  listDDQPackItems: vi.fn(),
  listDDQPackItemsForAssociation: vi.fn(),
  listDDQPacksForAssociation: vi.fn(),
  listProviderDDQPacks: vi.fn(),
  replaceDDQPackItemsForAssociation: vi.fn(),
  updateDDQPackItemForAssociation: vi.fn(),
  updateDDQPackMetadataForAssociation: vi.fn(),
  updateDDQPackStatusForAssociation: vi.fn(),
}));

vi.mock("../database/ddqChecklistFormResponseRepository", () => ({
  readChecklistTaskFormResponse: vi.fn(),
  upsertChecklistTaskFormResponse: vi.fn(),
}));

vi.mock("../database/ddqChecklistEvidenceRepository", () => ({
  countUploadedChecklistTaskEvidence: vi.fn(),
  createPendingChecklistTaskEvidence: vi.fn(),
  markChecklistTaskEvidenceUploaded: vi.fn(),
  markOtherChecklistTaskEvidenceReplaced: vi.fn(),
  readChecklistTaskAutomaticEvidenceTags: vi.fn(),
  readChecklistTaskEvidence: vi.fn(),
  readChecklistTaskEvidenceContextByObjectKey: vi.fn(),
  readChecklistTaskEvidenceTags: vi.fn(),
  readLatestUploadedChecklistTaskEvidence: vi.fn(),
  readProviderDDQChecklistTaskContext: vi.fn(),
  replaceChecklistTaskEvidenceTags: vi.fn(),
}));

vi.mock("../database/formTemplateRepository", () => ({
  createFormTemplateForAssociation: vi.fn(),
  deleteFormTemplateForAssociation: vi.fn(),
  getFormTemplateForAssociation: vi.fn(),
  listFormTemplatesForAssociation: vi.fn(),
  updateFormTemplateForAssociation: vi.fn(),
}));

const providerPack: DDQPackRow = {
  id: 11,
  association_corporation_id: 1,
  name: "Provider onboarding",
  valid_from: "2026-01-01",
  valid_to: "2026-12-31",
  status: "published",
  created_at: "2026-01-01T00:00:00.000Z",
};

const providerPackItem: DDQPackItemRow = {
  id: 21,
  pack_id: providerPack.id,
  position: 1,
  kind: "ddq-task",
  task_type: "document-upload",
  title: "Upload policy",
  config: {},
  parent_branch_item_id: null,
  parent_branch_option_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

const associationPack: DDQPackRow = {
  id: 31,
  association_corporation_id: 200,
  name: "Association pack",
  valid_from: "2026-01-01",
  valid_to: "2026-12-31",
  status: "draft",
  created_at: "2026-01-01T00:00:00.000Z",
};

const mappedFormTemplate: FormTemplateDetailRow = {
  id: 41,
  association_corporation_id: 200,
  short_name: "People details",
  description: "Collect person details",
  schema_json: {
    version: 1,
    items: [
      {
        id: "people",
        type: "subject",
        label: "People",
        required: true,
        subjectTypeKey: "person",
        repeatable: true,
        selectedProperties: [{ key: "name" }, { key: "date_of_birth" }],
      },
    ],
  },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("provider DDQ pack permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createDbClient).mockResolvedValue({
      end: vi.fn(),
    } as never);
    vi.mocked(getDDQPack).mockResolvedValue(providerPack);
    vi.mocked(listAvailableProviderDDQPacks).mockResolvedValue([providerPack]);
    vi.mocked(listDDQPackItems).mockResolvedValue([providerPackItem]);
  });

  it("allows provider users with provider-ddq-packs:add-new to list available packs", async () => {
    const result = await getAvailableProviderDDQPacks(
      providerContext(["provider-ddq-packs:add-new"]),
    );

    expect(result).toEqual({
      packs: [
        {
          id: providerPack.id,
          name: providerPack.name,
          valid_from: providerPack.valid_from,
          valid_to: providerPack.valid_to,
          status: providerPack.status,
          created_at: providerPack.created_at,
        },
      ],
    });
    expect(listAvailableProviderDDQPacks).toHaveBeenCalledWith(
      expect.anything(),
      200,
    );
  });

  it("rejects provider users without provider-ddq-packs:add-new from listing available packs", async () => {
    await expect(getAvailableProviderDDQPacks(providerContext([]))).rejects.toMatchObject({
      status: 403,
      message: "Permission required.",
    });

    expect(createDbClient).not.toHaveBeenCalled();
    expect(listAvailableProviderDDQPacks).not.toHaveBeenCalled();
  });

  it("allows provider users with provider-ddq-packs:add-new to preview pack items", async () => {
    const result = await getProviderDDQPackItems(
      providerContext(["provider-ddq-packs:add-new"]),
      providerPack.id,
    );

    expect(result).toEqual({
      pack: {
        id: providerPack.id,
        name: providerPack.name,
        valid_from: providerPack.valid_from,
        valid_to: providerPack.valid_to,
        status: providerPack.status,
        created_at: providerPack.created_at,
      },
      items: [providerPackItem],
    });
    expect(getDDQPack).toHaveBeenCalledWith(expect.anything(), providerPack.id);
    expect(listDDQPackItems).toHaveBeenCalledWith(expect.anything(), providerPack.id);
  });

  it("rejects provider users without provider-ddq-packs:add-new from previewing pack items", async () => {
    await expect(
      getProviderDDQPackItems(providerContext([]), providerPack.id),
    ).rejects.toMatchObject({
      status: 403,
      message: "Permission required.",
    });

    expect(createDbClient).not.toHaveBeenCalled();
    expect(getDDQPack).not.toHaveBeenCalled();
    expect(listDDQPackItems).not.toHaveBeenCalled();
  });

  it("enforces provider-ddq-packs:add-new for all corporation user types", async () => {
    const operations = [
      {
        run: (context: CurrentUserContext) => getAvailableProviderDDQPacks(context),
        assertCalled: () =>
          expect(listAvailableProviderDDQPacks).toHaveBeenCalledWith(
            expect.anything(),
            200,
          ),
      },
      {
        run: (context: CurrentUserContext) =>
          getProviderDDQPackItems(context, providerPack.id),
        assertCalled: () =>
          expect(listDDQPackItems).toHaveBeenCalledWith(
            expect.anything(),
            providerPack.id,
          ),
      },
    ];

    for (const corporationType of corporationTypes) {
      for (const operation of operations) {
        vi.clearAllMocks();
        resetRepositoryMocks();

        const allowedContext = userContext(
          corporationType,
          getPermissionsForCorporationType(corporationType),
        );
        const shouldAllow = corporationType === "PROVIDER";

        if (shouldAllow) {
          await expect(operation.run(allowedContext)).resolves.toBeTruthy();
          operation.assertCalled();
        } else {
          await expect(operation.run(allowedContext)).rejects.toMatchObject({
            status: 403,
            message: "Permission required.",
          });
          expect(createDbClient).not.toHaveBeenCalled();
        }

        vi.clearAllMocks();
        resetRepositoryMocks();

        await expect(
          operation.run(userContext(corporationType, [])),
        ).rejects.toMatchObject({
          status: 403,
          message: "Permission required.",
        });
        expect(createDbClient).not.toHaveBeenCalled();
      }
    }
  });
});

describe("association DDQ pack form copying", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRepositoryMocks();
    vi.mocked(getDDQPackForAssociation).mockResolvedValue(associationPack);
    vi.mocked(getFormTemplateForAssociation).mockResolvedValue(mappedFormTemplate);
    vi.mocked(createDDQPackItemForAssociation).mockImplementation(
      async (_client, _associationCorporationId, packId, _insertAfterItemId, input) => ({
        id: 51,
        pack_id: packId,
        position: 1,
        kind: input.kind,
        task_type: input.taskType,
        title: input.title,
        config: input.config,
        parent_branch_item_id: input.parentBranchItemId,
        parent_branch_option_id: input.parentBranchOptionId,
        created_at: "2026-01-01T00:00:00.000Z",
      }),
    );
  });

  it("preserves Subject groups when copying a form template into a DDQ pack item", async () => {
    const result = await createAssociationDDQPackItem(
      userContext("ASSOCIATION", ["association-ddq-packs:edit"]),
      associationPack.id,
      null,
      {
        kind: "ddq-task",
        taskType: "form-completion",
        title: "Complete people details",
        config: {
          form_template_id: mappedFormTemplate.id,
        },
      },
    );

    expect(result.item.config).toEqual({
      form: {
        kind: "form-document",
        version: 1,
        definition: {
          title: "People details",
          description: "Collect person details",
          items: mappedFormTemplate.schema_json.items,
        },
        values: {},
      },
    });
    expect(createDDQPackItemForAssociation).toHaveBeenCalledWith(
      expect.anything(),
      200,
      associationPack.id,
      null,
      expect.objectContaining({
        config: expect.objectContaining({
          form: expect.objectContaining({
            definition: expect.objectContaining({
              items: mappedFormTemplate.schema_json.items,
            }),
          }),
        }),
      }),
    );
  });

  it("creates branch DDQ pack items with normalized options", async () => {
    const result = await createAssociationDDQPackItem(
      userContext("ASSOCIATION", ["association-ddq-packs:edit"]),
      associationPack.id,
      null,
      {
        kind: "branch",
        taskType: null,
        title: " Choose a route ",
        config: {
          options: [
            { id: "option-a", label: " Standard " },
            { id: "option-b", label: "Enhanced" },
          ],
        },
      },
    );

    expect(result.item.config).toEqual({
      options: [
        { id: "option-a", label: "Standard" },
        { id: "option-b", label: "Enhanced" },
      ],
    });
    expect(createDDQPackItemForAssociation).toHaveBeenCalledWith(
      expect.anything(),
      200,
      associationPack.id,
      null,
      expect.objectContaining({
        kind: "branch",
        taskType: null,
        title: "Choose a route",
      }),
    );
  });

  it("rejects branch DDQ pack items with duplicate option labels", async () => {
    await expect(
      createAssociationDDQPackItem(
        userContext("ASSOCIATION", ["association-ddq-packs:edit"]),
        associationPack.id,
        null,
        {
          kind: "branch",
          taskType: null,
          title: "Choose a route",
          config: {
            options: [
              { id: "option-a", label: "Standard" },
              { id: "option-b", label: " standard " },
            ],
          },
        },
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: "Branch option labels must be unique.",
    });

    expect(createDDQPackItemForAssociation).not.toHaveBeenCalled();
  });
});

describe("provider form responses with Subject tables", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRepositoryMocks();
    vi.mocked(readProviderDDQChecklistTaskContext).mockResolvedValue(
      formCompletionChecklistTaskContext(),
    );
    vi.mocked(readLatestUploadedChecklistTaskEvidence).mockResolvedValue(
      null as unknown as Awaited<ReturnType<typeof readLatestUploadedChecklistTaskEvidence>>,
    );
    vi.mocked(readChecklistTaskEvidenceTags).mockResolvedValue([]);
    vi.mocked(readChecklistTaskAutomaticEvidenceTags).mockResolvedValue([]);
    vi.mocked(upsertChecklistTaskFormResponse).mockImplementation(
      async (_client, input) => ({
        id: 71,
        checklist_task_id: input.checklistTaskId,
        form_document: input.formDocument,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        completed_at: null,
      }),
    );
  });

  it("normalizes fixed-depth Subject table values and drops unselected columns", async () => {
    const result = await saveProviderDDQChecklistTaskFormResponse(
      providerContext(["provider-ddq-packs:perform-checks"]),
      providerPack.id,
      61,
      {
        values: {
          people: [
            {
              name: " Ada Lovelace ",
              directorships: [
                {
                  company: " Example Ltd ",
                  role: "Director",
                  date_started: "2026-01-01",
                  date_left: "2026-02-01",
                },
              ],
            },
          ],
        },
      },
    );

    expect(upsertChecklistTaskFormResponse).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        checklistTaskId: 61,
        formDocument: expect.objectContaining({
          values: {
            people: [
              {
                name: "Ada Lovelace",
                directorships: [
                  {
                    company: "Example Ltd",
                    role: "Director",
                  },
                ],
              },
            ],
          },
        }),
      }),
    );
    expect(result.formResponse?.errors).toEqual({});
    expect(result.formResponse?.complete).toBe(true);
  });

  it("rejects nested complex Subject table values", async () => {
    await expect(
      saveProviderDDQChecklistTaskFormResponse(
        providerContext(["provider-ddq-packs:perform-checks"]),
        providerPack.id,
        61,
        {
          values: {
            people: [
              {
                name: "Ada Lovelace",
                directorships: [
                  {
                    company: "Example Ltd",
                    role: [{ value: "not supported" }] as never,
                  },
                ],
              },
            ],
          },
        },
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: "Invalid form value.",
    });

    expect(upsertChecklistTaskFormResponse).not.toHaveBeenCalled();
  });
});

const corporationTypes: CorporationType[] = [
  "ASSOCIATION",
  "PROVIDER",
  "AGENT",
  "STAKEHOLDER",
];

function providerContext(permissions: Permission[]): CurrentUserContext {
  return userContext("PROVIDER", permissions);
}

function userContext(
  corporationType: CorporationType,
  permissions: readonly Permission[],
): CurrentUserContext {
  return {
    user: {
      id: 100,
      corporation_id: 200,
      cognito_sub: "provider-user",
      email: "provider@example.test",
      status: "active",
      permissions: [...permissions],
    },
    corporation: {
      id: 200,
      name: `${corporationType} Corp`,
      type: corporationType,
      status: "approved",
    },
  };
}

function resetRepositoryMocks() {
  vi.mocked(createDbClient).mockResolvedValue({
    query: vi.fn(),
    end: vi.fn(),
  } as never);
  vi.mocked(getDDQPack).mockResolvedValue(providerPack);
  vi.mocked(listAvailableProviderDDQPacks).mockResolvedValue([providerPack]);
  vi.mocked(listDDQPackItems).mockResolvedValue([providerPackItem]);
}

function formCompletionChecklistTaskContext() {
  return {
    pack: providerPack,
    checklist: {
      id: 81,
      provider_ddq_pack_id: 91,
      status: "active" as const,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    task: {
      id: 61,
      checklist_id: 81,
      ddq_pack_item_id: 21,
      status: "active" as const,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      position: 1,
      kind: "ddq-task" as const,
      task_type: "form-completion" as const,
      title: "Complete people details",
      parent_branch_item_id: null,
      parent_branch_option_id: null,
      config: {
        form: {
          kind: "form-document" as const,
          version: 1 as const,
          definition: {
            title: "People details",
            items: [
              {
                id: "people",
                type: "subject" as const,
                label: "People",
                required: true,
                subjectTypeKey: "person",
                repeatable: true,
                selectedProperties: [
                  { key: "name" },
                  {
                    key: "directorships",
                    columns: [{ key: "company" }, { key: "role" }],
                  },
                ],
              },
            ],
          },
          values: {},
        },
      },
    },
  };
}
