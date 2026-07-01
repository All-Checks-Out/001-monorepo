import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPermissionsForCorporationType, type CorporationType } from "@shared/permissions";
import type { CurrentUserContext } from "./currentUser";
import type { DDQPackItemRow, DDQPackRow, Permission } from "../database/onboardingTypes";
import { createDbClient } from "../database/db";
import {
  getDDQPack,
  listAvailableProviderDDQPacks,
  listDDQPackItems,
} from "../database/ddqPackRepository";
import {
  getAvailableProviderDDQPacks,
  getProviderDDQPackItems,
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
  created_at: "2026-01-01T00:00:00.000Z",
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
    end: vi.fn(),
  } as never);
  vi.mocked(getDDQPack).mockResolvedValue(providerPack);
  vi.mocked(listAvailableProviderDDQPacks).mockResolvedValue([providerPack]);
  vi.mocked(listDDQPackItems).mockResolvedValue([providerPackItem]);
}
