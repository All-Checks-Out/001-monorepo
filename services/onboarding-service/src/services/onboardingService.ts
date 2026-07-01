import type { Client } from "pg";
import { createAccessRequest, approveAccessRequest, rejectAccessRequest } from "../database/accessRequestRepository";
import {
  createAppUser,
  getAppUserByEmail,
  getAppUserById,
  listUsersForCorporation,
  listUsersWithCorporations,
  updateAppUserPermissions,
} from "../database/appUserRepository";
import {
  createCorporationApplication,
  getCorporationApplication,
  listApplicationsForProvider,
  listCorporationApplications,
  listProviderSetupApplications,
  markCorporationApplicationApproved,
  rejectCorporationApplication,
  rejectCorporationApplicationForProvider,
} from "../database/corporationApplicationRepository";
import { createDbClient } from "../database/db";
import {
  createApprovedCorporation,
  getCorporationById,
  listApprovedProviders,
  listCorporations,
} from "../database/corporationRepository";
import {
  listAccessRequests,
  listAccessRequestsForProvider,
  listAccessRequestsForRequester,
} from "../database/accessRequestRepository";
import {
  countProviderDDQChecklistTasksByStatus,
  createMissingProviderDDQChecklistTasks,
  createProviderDDQChecklist,
  getProviderDDQPackPoolItem,
  readProviderDDQChecklist,
  updateProviderDDQChecklistStatus,
  updateProviderDDQChecklistTaskStatus,
} from "../database/ddqChecklistRepository";
import {
  readChecklistTaskFormResponse,
  upsertChecklistTaskFormResponse,
} from "../database/ddqChecklistFormResponseRepository";
import {
  countUploadedChecklistTaskEvidence,
  createPendingChecklistTaskEvidence,
  markChecklistTaskEvidenceUploaded,
  markOtherChecklistTaskEvidenceReplaced,
  readChecklistTaskAutomaticEvidenceTags,
  readChecklistTaskEvidence,
  readChecklistTaskEvidenceContextByObjectKey,
  readChecklistTaskEvidenceTags,
  readLatestUploadedChecklistTaskEvidence,
  readProviderDDQChecklistTaskContext,
  replaceChecklistTaskEvidenceTags,
} from "../database/ddqChecklistEvidenceRepository";
import { EVENT_DETAIL_TYPES } from "@backend/events";
import {
  addProviderDDQPack as addProviderDDQPackRepository,
  createDDQPackForAssociation,
  createDDQPackItemForAssociation,
  deleteDDQPackForAssociation,
  deleteDDQPackItemForAssociation,
  getDDQPack,
  getDDQPackForAssociation,
  listAvailableProviderDDQPacks,
  listDDQPackItems,
  listDDQPackItemsForAssociation,
  listDDQPacksForAssociation,
  listProviderDDQPacks,
  replaceDDQPackItemsForAssociation,
  updateDDQPackMetadataForAssociation,
  updateDDQPackStatusForAssociation,
  updateDDQPackItemForAssociation,
} from "../database/ddqPackRepository";
import {
  createFormTemplateForAssociation,
  deleteFormTemplateForAssociation,
  getFormTemplateForAssociation,
  listFormTemplatesForAssociation,
  updateFormTemplateForAssociation,
} from "../database/formTemplateRepository";
import type {
  ApplicationType,
  DDQChecklistStatus,
  DDQPackItemKind,
  DDQPackRow,
  DDQPackStatus,
  DDQTaskType,
  FormDocument,
  FormValue,
  FormValues,
  FormTemplateDetailRow,
  ProviderDDQChecklistRow,
  ProviderDDQChecklistTaskEvidenceRow,
  ProviderDDQChecklistTaskEvidenceTagRow,
  ProviderDDQChecklistTaskFormResponseRow,
  ProviderDDQChecklistTaskWithItemRow,
  ProviderDDQPackRow,
  Permission,
} from "../database/onboardingTypes";
import type { ProviderDDQChecklistTaskContextRows } from "../database/ddqChecklistEvidenceRepository";
import { inviteCognitoUser } from "./cognitoAdmin";
import type { CurrentUserContext } from "./currentUser";
import {
  createEvidenceUploadUrl,
  evidenceObjectUrl,
  headEvidenceObject,
} from "./evidenceStorage";
import { publishEvidenceEvent } from "../events/evidenceEvents";
import {
  FormTemplateValidationError,
  parseFormItem,
  parseFormTemplateInput,
} from "./formTemplateValidation";
import {
  getPermissionsForCorporationType,
  hasPermission,
  validatePermissionsForCorporationType,
} from "./permissions";
import { randomUUID } from "node:crypto";
import { isLocalMode } from "../localMode";
import { localCognitoSub } from "./localIdentity";

export class ServiceError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function submitCorporationApplication(input: {
  name: string;
  type: ApplicationType;
  applicantEmail: string;
  providerCorporationId?: number | null;
}) {
  const client = await createDbClient();

  try {
    const providerCorporationId = input.providerCorporationId ?? null;

    if (input.type === "PROVIDER" && providerCorporationId) {
      throw new ServiceError(400, "Provider applications cannot target a provider.");
    }

    if (input.type !== "PROVIDER") {
      if (!providerCorporationId) {
        throw new ServiceError(400, "Agent and stakeholder applications must target a provider.");
      }

      const provider = await getCorporationById(client, providerCorporationId);
      if (!provider || provider.type !== "PROVIDER" || provider.status !== "approved") {
        throw new ServiceError(400, "Target provider is not available.");
      }
    }

    const application = await createCorporationApplication(client, input);
    return { application };
  } finally {
    await client.end();
  }
}

export async function getPublicProviders() {
  const client = await createDbClient();

  try {
    const providers = await listApprovedProviders(client);
    return { providers };
  } finally {
    await client.end();
  }
}

export async function submitAccessRequest(input: {
  requesterCorporationId: number;
  providerCorporationId: number;
}) {
  const client = await createDbClient();

  try {
    const requester = await getCorporationById(client, input.requesterCorporationId);
    const provider = await getCorporationById(client, input.providerCorporationId);

    if (!requester || !provider) {
      throw new ServiceError(404, "Corporation not found.");
    }

    if (
      requester.status !== "approved"
      || provider.status !== "approved"
      || !["AGENT", "STAKEHOLDER"].includes(requester.type)
      || provider.type !== "PROVIDER"
    ) {
      throw new ServiceError(400, "Invalid access request corporations.");
    }

    const accessRequest = await createAccessRequest(client, {
      requesterCorporationId: requester.id,
      providerCorporationId: provider.id,
    });
    return { accessRequest };
  } finally {
    await client.end();
  }
}

export async function getMyUsers(context: CurrentUserContext) {
  const client = await createDbClient();

  try {
    const users = await listUsersForCorporation(client, context.user.corporation_id);
    return { users };
  } finally {
    await client.end();
  }
}

export async function inviteUserForMyCorporation(
  context: CurrentUserContext,
  input: { email: string },
) {
  const client = await createDbClient();

  try {
    await assertAppUserEmailAvailable(client, input.email);

    const cognitoSub = await createUserIdentity(input.email);
    const user = await createAppUser(client, {
      corporationId: context.user.corporation_id,
      cognitoSub,
      email: input.email,
      permissions: [],
    });

    if (!user) {
      throw new ServiceError(409, "User email is already registered.");
    }

    return { user };
  } finally {
    await client.end();
  }
}

export async function updateOtherUserPermissionsForMyCorporation(
  context: CurrentUserContext,
  userId: number,
  permissions: string[],
) {
  const client = await createDbClient();

  try {
    const user = await getAppUserById(client, userId);

    // Permission managers may update other users in their own corporation only.
    if (!user || user.corporation_id !== context.user.corporation_id) {
      throw new ServiceError(404, "User not found.");
    }

    if (user.id === context.user.id) {
      throw new ServiceError(400, "Users cannot change their own permissions.");
    }

    let validatedPermissions: string[];
    try {
      validatedPermissions = validatePermissionsForCorporationType(
        context.corporation.type,
        permissions,
      );
    } catch (error) {
      throw new ServiceError(
        400,
        error instanceof Error ? error.message : "Invalid permissions.",
      );
    }

    const updatedUser = await updateAppUserPermissions(client, user.id, validatedPermissions);

    if (!updatedUser) {
      throw new ServiceError(404, "User not found.");
    }

    return { user: updatedUser };
  } finally {
    await client.end();
  }
}

export async function getAssociationApplications() {
  const client = await createDbClient();

  try {
    const applications = await listProviderSetupApplications(client);
    return { applications };
  } finally {
    await client.end();
  }
}

export async function approveAssociationApplication(id: number) {
  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const application = await getCorporationApplication(client, id);

    if (!application) {
      await client.query("ROLLBACK");
      throw new ServiceError(404, "Corporation application not found.");
    }

    if (application.status !== "pending") {
      await client.query("ROLLBACK");
      throw new ServiceError(400, "Corporation application cannot be approved.");
    }

    if (application.type !== "PROVIDER" || application.provider_corporation_id) {
      await client.query("ROLLBACK");
      throw new ServiceError(400, "Corporation application cannot be approved by the Association.");
    }

    await assertAppUserEmailAvailable(client, application.applicant_email);

    const cognitoSub = await createUserIdentity(application.applicant_email);
    const corporation = await createApprovedCorporation(client, {
      name: application.name,
      type: application.type,
    });
    const user = await createAppUser(client, {
      corporationId: corporation.id,
      cognitoSub,
      email: application.applicant_email,
      permissions: [...getPermissionsForCorporationType(corporation.type)],
    });

    if (!user) {
      await client.query("ROLLBACK");
      throw new ServiceError(409, "User email is already registered.");
    }

    const approvedApplication = await markCorporationApplicationApproved(client, application.id);

    if (!approvedApplication) {
      await client.query("ROLLBACK");
      throw new ServiceError(400, "Corporation application cannot be approved.");
    }

    await client.query("COMMIT");
    return { application: approvedApplication, corporation, user };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function getProviderCorporationApplications(context: CurrentUserContext) {
  const client = await createDbClient();

  try {
    const applications = (await listApplicationsForProvider(client, context.corporation.id))
      .filter((application) => hasProviderApplicationReadPermission(context, application.type));
    return { applications };
  } finally {
    await client.end();
  }
}

export async function approveProviderCorporationApplication(
  context: CurrentUserContext,
  id: number,
) {
  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const application = (await listApplicationsForProvider(client, context.corporation.id)).find(
      (row) => row.id === id,
    );

    if (!application) {
      await client.query("ROLLBACK");
      throw new ServiceError(404, "Corporation application not found.");
    }

    requireProviderApplicationApprovePermission(context, application.type);

    if (application.status !== "pending") {
      await client.query("ROLLBACK");
      throw new ServiceError(400, "Corporation application cannot be approved.");
    }

    await assertAppUserEmailAvailable(client, application.applicant_email);

    const cognitoSub = await createUserIdentity(application.applicant_email);
    const corporation = await createApprovedCorporation(client, {
      name: application.name,
      type: application.type,
    });
    const user = await createAppUser(client, {
      corporationId: corporation.id,
      cognitoSub,
      email: application.applicant_email,
      permissions: [...getPermissionsForCorporationType(corporation.type)],
    });

    if (!user) {
      await client.query("ROLLBACK");
      throw new ServiceError(409, "User email is already registered.");
    }

    const approvedApplication = await markCorporationApplicationApproved(client, application.id);

    if (!approvedApplication) {
      await client.query("ROLLBACK");
      throw new ServiceError(400, "Corporation application cannot be approved.");
    }

    const accessRequest = await createAccessRequest(client, {
      requesterCorporationId: corporation.id,
      providerCorporationId: context.corporation.id,
    });
    const approvedAccessRequest = await approveAccessRequest(client, accessRequest.id);

    await client.query("COMMIT");
    return {
      application: approvedApplication,
      corporation,
      user,
      accessRequest: approvedAccessRequest ?? accessRequest,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function rejectProviderCorporationApplication(
  context: CurrentUserContext,
  id: number,
) {
  const client = await createDbClient();

  try {
    const existingApplication = (await listApplicationsForProvider(client, context.corporation.id)).find(
      (row) => row.id === id,
    );

    if (!existingApplication) {
      throw new ServiceError(404, "Corporation application not found.");
    }

    requireProviderApplicationApprovePermission(context, existingApplication.type);

    const application = await rejectCorporationApplicationForProvider(client, id, context.corporation.id);

    if (!application) {
      throw new ServiceError(404, "Corporation application not found.");
    }

    return { application };
  } finally {
    await client.end();
  }
}

export async function rejectAssociationApplication(id: number) {
  const client = await createDbClient();

  try {
    const existingApplication = (await listProviderSetupApplications(client)).find((row) => row.id === id);

    if (!existingApplication) {
      throw new ServiceError(404, "Corporation application not found.");
    }

    if (existingApplication.type !== "PROVIDER" || existingApplication.provider_corporation_id) {
      throw new ServiceError(400, "Association can only reject provider setup requests.");
    }

    const application = await rejectCorporationApplication(client, id);

    if (!application) {
      throw new ServiceError(404, "Corporation application not found.");
    }

    return { application };
  } finally {
    await client.end();
  }
}

export async function getAssociationCorporations() {
  const client = await createDbClient();

  try {
    const corporations = await listCorporations(client);
    return { corporations };
  } finally {
    await client.end();
  }
}

export async function getAssociationUsers() {
  const client = await createDbClient();

  try {
    const users = await listUsersWithCorporations(client);
    return { users };
  } finally {
    await client.end();
  }
}

export async function getAssociationAccessRequests() {
  const client = await createDbClient();

  try {
    const accessRequests = await listAccessRequests(client);
    return { accessRequests };
  } finally {
    await client.end();
  }
}

export async function decideAssociationAccessRequest(id: number, decision: "approve" | "reject") {
  const client = await createDbClient();

  try {
    const accessRequest =
      decision === "approve"
        ? await approveAccessRequest(client, id)
        : await rejectAccessRequest(client, id);

    if (!accessRequest) {
      throw new ServiceError(404, "Access request not found.");
    }

    return { accessRequest };
  } finally {
    await client.end();
  }
}

export async function getProviderAccessRequests(context: CurrentUserContext) {
  const client = await createDbClient();

  try {
    const accessRequests = (await listAccessRequestsForProvider(client, context.corporation.id))
      .filter((accessRequest) =>
        hasProviderAccessRequestReadPermission(context, accessRequest.requester_corporation_type),
      );
    return { accessRequests };
  } finally {
    await client.end();
  }
}

export async function getProviderDDQPacks(_context: CurrentUserContext) {
  const client = await createDbClient();

  try {
    const packs = await listProviderDDQPacks(client, _context.corporation.id);
    return { packs: packs.map(toProviderDDQPackData) };
  } finally {
    await client.end();
  }
}

export async function getAvailableProviderDDQPacks(context: CurrentUserContext) {
  requirePermission(context, "ddq-packs:add-new");

  const client = await createDbClient();

  try {
    const packs = await listAvailableProviderDDQPacks(client, context.corporation.id);
    return { packs: packs.map(toDDQPackData) };
  } finally {
    await client.end();
  }
}

export async function addProviderDDQPack(
  context: CurrentUserContext,
  ddqPackId: number,
) {
  requirePermission(context, "ddq-packs:add-new");

  const client = await createDbClient();

  try {
    const pack = await getDDQPack(client, ddqPackId);
    if (!pack || pack.status === "draft") {
      throw new ServiceError(404, "DDQ Pack not found.");
    }

    const added = await addProviderDDQPackRepository(
      client,
      context.corporation.id,
      ddqPackId,
    );
    if (!added) {
      throw new ServiceError(400, "DDQ Pack has already been added.");
    }

    return { pack: toDDQPackData(pack) };
  } finally {
    await client.end();
  }
}

export async function getProviderDDQPackItems(
  context: CurrentUserContext,
  packId: number,
) {
  requirePermission(context, "ddq-packs:add-new");

  const client = await createDbClient();

  try {
    const pack = await getDDQPack(client, packId);
    if (!pack || pack.status === "draft") {
      throw new ServiceError(404, "DDQ Pack not found.");
    }

    const items = await listDDQPackItems(client, packId);
    return { pack: toDDQPackData(pack), items };
  } finally {
    await client.end();
  }
}

export type DDQChecklistStatusAction = "complete" | "withdraw" | "restore" | "reopen";

const ddqChecklistTransitions: Record<
  DDQChecklistStatus,
  Partial<Record<DDQChecklistStatusAction, DDQChecklistStatus>>
> = {
  active: {
    complete: "completed",
    withdraw: "withdrawn",
  },
  completed: {
    reopen: "active",
  },
  withdrawn: {
    restore: "active",
  },
};

const providerChecklistViewPermissions: Permission[] = [
  "ddq-packs:perform-checks",
  "ddq-packs:review-checks",
  "ddq-packs:approve-checks",
];

export async function getProviderDDQChecklist(
  context: CurrentUserContext,
  packId: number,
) {
  requireAnyPermission(context, providerChecklistViewPermissions);

  const client = await createDbClient();

  try {
    const result = await readProviderDDQChecklist(
      client,
      context.corporation.id,
      packId,
    );
    if (!result.pack || !result.checklist) {
      throw new ServiceError(404, "DDQ Checklist not found.");
    }

    return toProviderDDQChecklistResponse(result);
  } finally {
    await client.end();
  }
}

export async function getProviderDDQChecklistTask(
  context: CurrentUserContext,
  packId: number,
  taskId: number,
) {
  requireAnyPermission(context, providerChecklistViewPermissions);

  const client = await createDbClient();

  try {
    return await readChecklistTaskDetailResponse(client, context, packId, taskId);
  } finally {
    await client.end();
  }
}

export async function createProviderDDQChecklistTaskEvidenceUploadUrl(
  context: CurrentUserContext,
  packId: number,
  taskId: number,
  input: {
    originalFilename: string;
    contentType: string;
    fileSizeBytes: number;
    tags: string[];
  },
) {
  requirePermission(context, "ddq-packs:perform-checks");

  const normalizedTags = normalizeTags(input.tags);
  const objectKey = randomUUID();
  const uploadUrl = await createEvidenceUploadUrl({
    objectKey,
    contentType: input.contentType,
  });
  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const detail = await readProviderDDQChecklistTaskContext(
      client,
      context.corporation.id,
      packId,
      taskId,
    );

    if (!detail.pack || !detail.checklist || !detail.task) {
      throw new ServiceError(404, "DDQ Checklist Task not found.");
    }
    validateEvidenceMutation(detail.checklist.status);
    validateEvidenceUploadTask(detail.task.task_type);
    validateEvidenceFile(input, detail.task.task_type);

    const evidence = await createPendingChecklistTaskEvidence(client, {
      checklistTaskId: detail.task.id,
      uploadedByAppUserId: context.user.id,
      objectKey,
      originalFilename: input.originalFilename.trim(),
      contentType: input.contentType,
      fileSizeBytes: input.fileSizeBytes,
    });
    await replaceChecklistTaskEvidenceTags(
      client,
      evidence.id,
      normalizedTags,
      "manual",
    );
    const tags = await readChecklistTaskEvidenceTags(client, evidence.id);
    const bucketName = process.env.EVIDENCE_BUCKET_NAME;

    if (!bucketName) {
      throw new Error("EVIDENCE_BUCKET_NAME environment variable is not configured.");
    }

    await publishEvidenceEvent({
      version: 1,
      eventId: randomUUID(),
      eventType: EVENT_DETAIL_TYPES.evidenceUploadRequested,
      evidenceId: evidence.id,
      checklistTaskId: evidence.checklist_task_id,
      providerCorporationId: context.corporation.id,
      uploadedByAppUserId: evidence.uploaded_by_app_user_id,
      bucketName,
      objectKey: evidence.object_key,
      originalFilename: evidence.original_filename,
      contentType: evidence.content_type,
      uploadTimeTags: normalizedTags,
      occurredAt: new Date().toISOString(),
    });

    await client.query("COMMIT");
    return {
      evidence: toEvidenceData(evidence, tags),
      upload_url: uploadUrl,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function completeChecklistTaskEvidenceUploadFromObjectKey(
  objectKey: string,
) {
  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const evidence = await readChecklistTaskEvidenceContextByObjectKey(client, objectKey);
    if (!evidence) {
      await client.query("COMMIT");
      return null;
    }
    await validateUploadedEvidenceObject(evidence);

    const uploadedEvidence =
      evidence.status === "uploaded"
        ? evidence
        : await markChecklistTaskEvidenceUploaded(
            client,
            evidence.checklist_task_id,
            evidence.id,
          );

    if (!uploadedEvidence) {
      await client.query("COMMIT");
      return null;
    }

    await markOtherChecklistTaskEvidenceReplaced(
      client,
      evidence.checklist_task_id,
      evidence.id,
    );

    if (evidence.task_status === "active") {
      await updateProviderDDQChecklistTaskStatus(
        client,
        evidence.checklist_id,
        evidence.checklist_task_id,
        "completed",
      );
      await applyAutomaticChecklistStatus(
        client,
        evidence.checklist_id,
        evidence.checklist_status,
      );
    }

    const manualTags = await readChecklistTaskEvidenceTags(client, evidence.id);
    const bucketName = process.env.EVIDENCE_BUCKET_NAME;

    if (!bucketName) {
      throw new Error("EVIDENCE_BUCKET_NAME environment variable is not configured.");
    }

    await publishEvidenceEvent({
      version: 1,
      eventId: randomUUID(),
      eventType: EVENT_DETAIL_TYPES.evidenceObjectCreated,
      evidenceId: evidence.id,
      checklistTaskId: evidence.checklist_task_id,
      providerCorporationId: evidence.provider_corporation_id,
      uploadedByAppUserId: evidence.uploaded_by_app_user_id,
      bucketName,
      objectKey: evidence.object_key,
      originalFilename: evidence.original_filename,
      contentType: evidence.content_type,
      uploadTimeTags: manualTags
        .filter((tag) => tag.source === "manual")
        .map((tag) => tag.tag),
      occurredAt: new Date().toISOString(),
    });

    await client.query("COMMIT");
    return uploadedEvidence;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function updateProviderDDQChecklistTaskEvidenceTags(
  context: CurrentUserContext,
  packId: number,
  taskId: number,
  evidenceId: number,
  tags: string[],
) {
  requirePermission(context, "ddq-packs:perform-checks");

  const normalizedTags = normalizeTags(tags);
  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const detail = await readProviderDDQChecklistTaskContext(
      client,
      context.corporation.id,
      packId,
      taskId,
    );

    if (!detail.pack || !detail.checklist || !detail.task) {
      throw new ServiceError(404, "DDQ Checklist Task not found.");
    }
    validateEvidenceMutation(detail.checklist.status);

    const evidence = await readChecklistTaskEvidence(client, detail.task.id, evidenceId);
    if (!evidence) {
      throw new ServiceError(404, "Checklist task evidence not found.");
    }

    await replaceChecklistTaskEvidenceTags(client, evidence.id, normalizedTags, "manual");
    const response = await readChecklistTaskDetailResponse(
      client,
      context,
      packId,
      taskId,
      evidence,
    );

    await client.query("COMMIT");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function saveProviderDDQChecklistTaskFormResponse(
  context: CurrentUserContext,
  packId: number,
  taskId: number,
  input: { values: FormValues },
) {
  requirePermission(context, "ddq-packs:perform-checks");

  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const detail = await readProviderDDQChecklistTaskContext(
      client,
      context.corporation.id,
      packId,
      taskId,
    );
    const saved = await saveChecklistTaskFormResponseInTransaction(
      client,
      detail,
      input.values,
      false,
    );
    const response = await readChecklistTaskDetailResponse(
      client,
      context,
      packId,
      taskId,
      undefined,
      saved,
    );

    await client.query("COMMIT");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function completeProviderDDQChecklistTaskFormResponse(
  context: CurrentUserContext,
  packId: number,
  taskId: number,
  input: { values: FormValues },
) {
  requirePermission(context, "ddq-packs:perform-checks");

  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const detail = await readProviderDDQChecklistTaskContext(
      client,
      context.corporation.id,
      packId,
      taskId,
    );
    const saved = await saveChecklistTaskFormResponseInTransaction(
      client,
      detail,
      input.values,
      true,
    );

    await updateProviderDDQChecklistTaskStatus(
      client,
      detail.checklist!.id,
      detail.task!.id,
      "completed",
    );
    await applyAutomaticChecklistStatus(
      client,
      detail.checklist!.id,
      detail.checklist!.status,
    );

    const response = await readChecklistTaskDetailResponse(
      client,
      context,
      packId,
      taskId,
      undefined,
      saved,
    );

    await client.query("COMMIT");
    return response;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function getOrCreateProviderDDQChecklist(
  context: CurrentUserContext,
  packId: number,
) {
  requirePermission(context, "ddq-packs:perform-checks");

  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const poolItem = await getProviderDDQPackPoolItem(
      client,
      context.corporation.id,
      packId,
    );
    if (!poolItem) {
      throw new ServiceError(404, "DDQ Pack not found in provider pool.");
    }

    const checklist = await createProviderDDQChecklist(client, poolItem.id);
    await createMissingProviderDDQChecklistTasks(client, checklist.id, packId);

    const result = await readProviderDDQChecklist(
      client,
      context.corporation.id,
      packId,
    );
    if (!result.pack || !result.checklist) {
      throw new ServiceError(404, "DDQ Checklist not found.");
    }

    await client.query("COMMIT");
    return toProviderDDQChecklistResponse(result);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function changeProviderDDQChecklistStatus(
  context: CurrentUserContext,
  packId: number,
  action: DDQChecklistStatusAction,
) {
  requirePermission(context, "ddq-packs:perform-checks");

  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const result = await readProviderDDQChecklist(
      client,
      context.corporation.id,
      packId,
    );
    if (!result.pack || !result.checklist) {
      throw new ServiceError(404, "DDQ Checklist not found.");
    }

    const nextStatus = transitionDDQChecklistStatus(
      result.checklist.status,
      action,
      "DDQ Checklist",
    );

    if (action === "complete") {
      const counts = await countProviderDDQChecklistTasksByStatus(
        client,
        result.checklist.id,
      );
      const total = totalChecklistTasks(counts);
      if (total === 0 || counts.completed !== total) {
        throw new ServiceError(
          400,
          "Cannot complete a DDQ Checklist until every task is completed.",
        );
      }
    }

    await updateProviderDDQChecklistStatus(client, result.checklist.id, nextStatus);

    const updated = await readProviderDDQChecklist(
      client,
      context.corporation.id,
      packId,
    );
    if (!updated.pack || !updated.checklist) {
      throw new ServiceError(404, "DDQ Checklist not found.");
    }

    await client.query("COMMIT");
    return toProviderDDQChecklistResponse(updated);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function changeProviderDDQChecklistTaskStatus(
  context: CurrentUserContext,
  packId: number,
  taskId: number,
  action: DDQChecklistStatusAction,
) {
  requirePermission(context, "ddq-packs:perform-checks");

  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const result = await readProviderDDQChecklist(
      client,
      context.corporation.id,
      packId,
    );
    if (!result.pack || !result.checklist) {
      throw new ServiceError(404, "DDQ Checklist not found.");
    }
    if (result.checklist.status === "withdrawn") {
      throw new ServiceError(
        400,
        "Restore a withdrawn DDQ Checklist before changing tasks.",
      );
    }

    const task = result.tasks.find((candidate) => candidate.id === taskId);
    if (!task) {
      throw new ServiceError(404, "DDQ Checklist Task not found.");
    }
    if (action === "complete" && isUploadTask(task.task_type)) {
      const uploadedEvidenceCount = await countUploadedChecklistTaskEvidence(
        client,
        task.id,
      );

      if (uploadedEvidenceCount === 0) {
        throw new ServiceError(
          400,
          "Upload evidence before completing this DDQ Checklist Task.",
        );
      }
    }
    if (action === "complete" && task.task_type === "form-completion") {
      const formResponse = await readChecklistTaskFormResponse(client, task.id);
      if (!formResponse || !formResponse.completed_at) {
        throw new ServiceError(
          400,
          "Complete the form before completing this DDQ Checklist Task.",
        );
      }
    }

    const nextStatus = transitionDDQChecklistStatus(
      task.status,
      action,
      "DDQ Checklist Task",
    );

    await updateProviderDDQChecklistTaskStatus(
      client,
      result.checklist.id,
      taskId,
      nextStatus,
    );

    await applyAutomaticChecklistStatus(client, result.checklist.id, result.checklist.status);

    const updated = await readProviderDDQChecklist(
      client,
      context.corporation.id,
      packId,
    );
    if (!updated.pack || !updated.checklist) {
      throw new ServiceError(404, "DDQ Checklist not found.");
    }

    await client.query("COMMIT");
    return toProviderDDQChecklistResponse(updated);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function decideProviderAccessRequest(
  context: CurrentUserContext,
  id: number,
  decision: "approve" | "reject",
) {
  const client = await createDbClient();

  try {
    const existingAccessRequest = (await listAccessRequestsForProvider(
      client,
      context.corporation.id,
    )).find((row) => row.id === id);

    if (!existingAccessRequest) {
      throw new ServiceError(404, "Access request not found.");
    }

    requireProviderAccessRequestApprovePermission(
      context,
      existingAccessRequest.requester_corporation_type,
    );

    const accessRequest =
      decision === "approve"
        ? await approveAccessRequest(client, id, context.corporation.id)
        : await rejectAccessRequest(client, id, context.corporation.id);

    if (!accessRequest) {
      throw new ServiceError(404, "Access request not found.");
    }

    return { accessRequest };
  } finally {
    await client.end();
  }
}

export async function getMyAccessRequests(context: CurrentUserContext) {
  const client = await createDbClient();

  try {
    const accessRequests = await listAccessRequestsForRequester(client, context.corporation.id);
    return { accessRequests };
  } finally {
    await client.end();
  }
}

export async function getAssociationDDQPacks(context: CurrentUserContext) {
  const client = await createDbClient();

  try {
    const packs = await listDDQPacksForAssociation(client, context.corporation.id);
    return { packs: packs.map(toDDQPackData) };
  } finally {
    await client.end();
  }
}

export async function getAssociationFormTemplates(context: CurrentUserContext) {
  const client = await createDbClient();

  try {
    const formTemplates = await listFormTemplatesForAssociation(
      client,
      context.corporation.id,
    );
    return { formTemplates };
  } finally {
    await client.end();
  }
}

export async function getAssociationFormTemplate(
  context: CurrentUserContext,
  templateId: number,
) {
  const client = await createDbClient();

  try {
    const formTemplate = await getFormTemplateForAssociation(
      client,
      context.corporation.id,
      templateId,
    );
    if (!formTemplate) throw new ServiceError(404, "Form template not found.");
    return { formTemplate };
  } finally {
    await client.end();
  }
}

export async function createAssociationFormTemplate(
  context: CurrentUserContext,
  input: {
    shortName: string;
    description: string;
    schema: unknown;
  },
) {
  const client = await createDbClient();

  try {
    const formTemplate = await createFormTemplateForAssociation(
      client,
      context.corporation.id,
      validateFormTemplateInput(input),
    );
    return { formTemplate };
  } finally {
    await client.end();
  }
}

export async function updateAssociationFormTemplate(
  context: CurrentUserContext,
  templateId: number,
  input: {
    shortName: string;
    description: string;
    schema: unknown;
  },
) {
  const client = await createDbClient();

  try {
    const formTemplate = await updateFormTemplateForAssociation(
      client,
      context.corporation.id,
      templateId,
      validateFormTemplateInput(input),
    );
    if (!formTemplate) throw new ServiceError(404, "Form template not found.");
    return { formTemplate };
  } finally {
    await client.end();
  }
}

export async function deleteAssociationFormTemplate(
  context: CurrentUserContext,
  templateId: number,
) {
  const client = await createDbClient();

  try {
    const deleted = await deleteFormTemplateForAssociation(
      client,
      context.corporation.id,
      templateId,
    );
    if (!deleted) throw new ServiceError(404, "Form template not found.");
    return { deleted: true };
  } finally {
    await client.end();
  }
}

export async function getAssociationDDQPack(
  context: CurrentUserContext,
  id: number,
) {
  const client = await createDbClient();

  try {
    const pack = await getDDQPackForAssociation(client, context.corporation.id, id);
    if (!pack) throw new ServiceError(404, "DDQ Pack not found.");
    return { pack: toDDQPackData(pack) };
  } finally {
    await client.end();
  }
}

export async function createAssociationDDQPack(
  context: CurrentUserContext,
  input: {
    name: string;
    validFrom: string;
    validTo: string;
  },
) {
  const client = await createDbClient();

  try {
    validateDDQPackInput(input);
    const pack = await createDDQPackForAssociation(
      client,
      context.corporation.id,
      input,
    );
    return { pack: toDDQPackData(pack) };
  } finally {
    await client.end();
  }
}

export async function updateAssociationDDQPack(
  context: CurrentUserContext,
  id: number,
  input: {
    name: string;
    validFrom: string;
    validTo: string;
  },
) {
  const client = await createDbClient();

  try {
    validateDDQPackInput(input);
    const pack = await updateDDQPackMetadataForAssociation(
      client,
      context.corporation.id,
      id,
      input,
    );
    if (!pack) throw new ServiceError(404, "DDQ Pack not found.");
    return { pack: toDDQPackData(pack) };
  } finally {
    await client.end();
  }
}

export async function saveAssociationDDQPackDraft(
  context: CurrentUserContext,
  packId: number,
  input: {
    pack: {
      name: string;
      validFrom: string;
      validTo: string;
    };
    items: DDQPackItemInput[];
  },
) {
  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    validateDDQPackInput(input.pack);
    const pack = await getDDQPackForAssociation(
      client,
      context.corporation.id,
      packId,
    );
    if (!pack) throw new ServiceError(404, "DDQ Pack not found.");

    const itemInputs = await Promise.all(
      input.items.map((item) =>
        normalizeDDQPackItemInput(client, context.corporation.id, item),
      ),
    );

    const updatedPack = await updateDDQPackMetadataForAssociation(
      client,
      context.corporation.id,
      packId,
      input.pack,
    );
    if (!updatedPack) throw new ServiceError(404, "DDQ Pack not found.");

    const replaced = await replaceDDQPackItemsForAssociation(
      client,
      context.corporation.id,
      packId,
      itemInputs,
    );
    if (!replaced) throw new ServiceError(404, "DDQ Pack not found.");

    const items = await listDDQPackItemsForAssociation(
      client,
      context.corporation.id,
      packId,
    );

    await client.query("COMMIT");
    return { pack: toDDQPackData(updatedPack), items };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function deleteAssociationDDQPack(
  context: CurrentUserContext,
  id: number,
) {
  const client = await createDbClient();

  try {
    const deleted = await deleteDDQPackForAssociation(
      client,
      context.corporation.id,
      id,
    );
    if (!deleted) throw new ServiceError(404, "DDQ Pack not found.");
    return { deleted: true };
  } finally {
    await client.end();
  }
}

export type DDQPackStatusAction = "publish" | "archive" | "restore";

const ddqPackTransitions: Record<
  DDQPackStatus,
  Partial<Record<DDQPackStatusAction, DDQPackStatus>>
> = {
  draft: {
    publish: "published",
  },
  published: {
    archive: "archived",
  },
  archived: {
    restore: "published",
  },
};

export async function changeAssociationDDQPackStatus(
  context: CurrentUserContext,
  id: number,
  action: DDQPackStatusAction,
) {
  const client = await createDbClient();

  try {
    const pack = await getDDQPackForAssociation(client, context.corporation.id, id);
    if (!pack) throw new ServiceError(404, "DDQ Pack not found.");

    const nextStatus = transitionDDQPackStatus(pack.status, action);
    if (nextStatus === "published") {
      await validatePublishableDDQPack(client, context.corporation.id, id);
    }

    const updatedPack = await updateDDQPackStatusForAssociation(
      client,
      context.corporation.id,
      id,
      nextStatus,
    );
    if (!updatedPack) throw new ServiceError(404, "DDQ Pack not found.");
    return { pack: toDDQPackData(updatedPack) };
  } finally {
    await client.end();
  }
}

export async function getAssociationDDQPackItems(
  context: CurrentUserContext,
  packId: number,
) {
  const client = await createDbClient();

  try {
    const pack = await getDDQPackForAssociation(
      client,
      context.corporation.id,
      packId,
    );
    if (!pack) throw new ServiceError(404, "DDQ Pack not found.");

    const items = await listDDQPackItemsForAssociation(
      client,
      context.corporation.id,
      packId,
    );
    return { pack: toDDQPackData(pack), items };
  } finally {
    await client.end();
  }
}

export async function createAssociationDDQPackItem(
  context: CurrentUserContext,
  packId: number,
  insertAfterItemId: number | null,
  input: DDQPackItemInput,
) {
  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const pack = await getDDQPackForAssociation(
      client,
      context.corporation.id,
      packId,
    );
    if (!pack) {
      throw new ServiceError(404, "DDQ Pack not found.");
    }

    const itemInput = await normalizeDDQPackItemInput(
      client,
      context.corporation.id,
      input,
    );
    const item = await createDDQPackItemForAssociation(
      client,
      context.corporation.id,
      packId,
      insertAfterItemId,
      itemInput,
    );
    if (!item) {
      throw new ServiceError(404, "Insert-after item not found.");
    }

    await client.query("COMMIT");
    return { item };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function updateAssociationDDQPackItem(
  context: CurrentUserContext,
  packId: number,
  itemId: number,
  input: DDQPackItemInput,
) {
  const client = await createDbClient();

  try {
    const pack = await getDDQPackForAssociation(
      client,
      context.corporation.id,
      packId,
    );
    if (!pack) {
      throw new ServiceError(404, "DDQ Pack not found.");
    }

    const itemInput = await normalizeDDQPackItemInput(
      client,
      context.corporation.id,
      input,
    );
    const item = await updateDDQPackItemForAssociation(
      client,
      context.corporation.id,
      packId,
      itemId,
      itemInput,
    );
    if (!item) throw new ServiceError(404, "DDQ Pack Item not found.");
    return { item };
  } finally {
    await client.end();
  }
}

export async function deleteAssociationDDQPackItem(
  context: CurrentUserContext,
  packId: number,
  itemId: number,
) {
  const client = await createDbClient();

  await client.query("BEGIN");

  try {
    const deleted = await deleteDDQPackItemForAssociation(
      client,
      context.corporation.id,
      packId,
      itemId,
    );
    if (!deleted) {
      throw new ServiceError(404, "DDQ Pack Item not found.");
    }

    await client.query("COMMIT");
    return { deleted: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

type DDQPackItemInput = {
  kind: DDQPackItemKind;
  taskType: DDQTaskType | null;
  title: string;
  config: Record<string, unknown>;
};

function transitionDDQPackStatus(
  status: DDQPackStatus,
  action: DDQPackStatusAction,
) {
  const nextStatus = ddqPackTransitions[status][action];
  if (!nextStatus) {
    throw new ServiceError(400, `Cannot ${action} a ${status} DDQ Pack.`);
  }

  return nextStatus;
}

function transitionDDQChecklistStatus(
  status: DDQChecklistStatus,
  action: DDQChecklistStatusAction,
  entityName: string,
) {
  const nextStatus = ddqChecklistTransitions[status][action];
  if (!nextStatus) {
    throw new ServiceError(400, `Cannot ${action} a ${status} ${entityName}.`);
  }

  return nextStatus;
}

function requirePermission(context: CurrentUserContext, permission: Permission) {
  if (!hasPermission(context, permission)) {
    throw new ServiceError(403, "Permission required.");
  }
}

function requireAnyPermission(
  context: CurrentUserContext,
  permissions: Permission[],
) {
  if (!permissions.some((permission) => hasPermission(context, permission))) {
    throw new ServiceError(403, "Permission required.");
  }
}

function hasProviderApplicationReadPermission(
  context: CurrentUserContext,
  type: ApplicationType,
) {
  return type === "AGENT"
    ? hasPermission(context, "agent-requests:read")
    : hasPermission(context, "stakeholder-requests:read");
}

function requireProviderApplicationApprovePermission(
  context: CurrentUserContext,
  type: ApplicationType,
) {
  requirePermission(
    context,
    type === "AGENT" ? "agent-requests:approve" : "stakeholder-requests:approve",
  );
}

function hasProviderAccessRequestReadPermission(
  context: CurrentUserContext,
  type: string,
) {
  if (type === "AGENT") return hasPermission(context, "agent-requests:read");
  if (type === "STAKEHOLDER") return hasPermission(context, "stakeholder-requests:read");
  return false;
}

function requireProviderAccessRequestApprovePermission(
  context: CurrentUserContext,
  type: string,
) {
  if (type === "AGENT") {
    requirePermission(context, "agent-requests:approve");
    return;
  }

  if (type === "STAKEHOLDER") {
    requirePermission(context, "stakeholder-requests:approve");
    return;
  }

  throw new ServiceError(403, "Permission required.");
}

function totalChecklistTasks(counts: Record<DDQChecklistStatus, number>) {
  return counts.active + counts.completed + counts.withdrawn;
}

async function applyAutomaticChecklistStatus(
  client: Awaited<ReturnType<typeof createDbClient>>,
  checklistId: number,
  currentChecklistStatus: DDQChecklistStatus,
) {
  const counts = await countProviderDDQChecklistTasksByStatus(client, checklistId);
  const total = totalChecklistTasks(counts);

  if (total > 0 && counts.completed === total) {
    await updateProviderDDQChecklistStatus(client, checklistId, "completed");
  } else if (currentChecklistStatus === "completed") {
    await updateProviderDDQChecklistStatus(client, checklistId, "active");
  }
}

async function readChecklistTaskDetailResponse(
  client: Awaited<ReturnType<typeof createDbClient>>,
  context: CurrentUserContext,
  packId: number,
  taskId: number,
  preferredEvidence?: ProviderDDQChecklistTaskEvidenceRow,
  preferredFormResponse?: ProviderDDQChecklistTaskFormResponseRow,
) {
  const detail = await readProviderDDQChecklistTaskContext(
    client,
    context.corporation.id,
    packId,
    taskId,
  );

  if (!detail.pack || !detail.checklist || !detail.task) {
    throw new ServiceError(404, "DDQ Checklist Task not found.");
  }

  const evidence =
    preferredEvidence ??
    await readLatestUploadedChecklistTaskEvidence(client, detail.task.id);
  const tags = evidence
    ? [
        ...await readChecklistTaskEvidenceTags(client, evidence.id),
        ...await readChecklistTaskAutomaticEvidenceTags(client, evidence.id),
      ]
    : [];
  const formResponse =
    detail.task.task_type === "form-completion"
      ? preferredFormResponse ??
        await readChecklistTaskFormResponse(client, detail.task.id)
      : null;

  return {
    pack: toDDQPackData(detail.pack),
    checklist: detail.checklist,
    task: detail.task,
    evidence: evidence ? toEvidenceData(evidence, tags) : null,
    formResponse: formResponse ? toFormResponseData(formResponse) : null,
  };
}

async function saveChecklistTaskFormResponseInTransaction(
  client: Awaited<ReturnType<typeof createDbClient>>,
  detail: ProviderDDQChecklistTaskContextRows,
  values: FormValues,
  complete: boolean,
) {
  if (!detail.pack || !detail.checklist || !detail.task) {
    throw new ServiceError(404, "DDQ Checklist Task not found.");
  }
  if (detail.checklist.status === "withdrawn") {
    throw new ServiceError(
      400,
      "Restore a withdrawn DDQ Checklist before changing form responses.",
    );
  }
  if (detail.task.task_type !== "form-completion") {
    throw new ServiceError(400, "This DDQ Checklist Task does not accept form responses.");
  }
  if (detail.task.status !== "active") {
    throw new ServiceError(400, "Reopen this DDQ Checklist Task before changing form responses.");
  }

  const baseDocument = validateFormDocument(detail.task.config.form);
  const formDocument = {
    ...baseDocument,
    values: normalizeFormValuesForDocument(baseDocument, values),
  };
  const validation = validateFormCompletion(formDocument);

  if (complete && !validation.complete) {
    throw new ServiceError(400, firstFormError(validation.errors));
  }

  return await upsertChecklistTaskFormResponse(client, {
    checklistTaskId: detail.task.id,
    formDocument,
    completedAt: complete ? new Date() : null,
  });
}

function toFormResponseData(response: ProviderDDQChecklistTaskFormResponseRow) {
  const validation = validateFormCompletion(response.form_document);

  return {
    ...response,
    complete: validation.complete,
    errors: validation.errors,
  };
}

type DDQPackData = Pick<
  DDQPackRow,
  "id" | "name" | "valid_from" | "valid_to" | "status" | "created_at"
>;

type ProviderDDQPackData = DDQPackData &
  Pick<
    ProviderDDQPackRow,
    "provider_ddq_pack_id" | "checklist_id" | "checklist_status"
  >;

type ProviderDDQChecklistData = {
  pack: DDQPackData;
  checklist: ProviderDDQChecklistRow;
  tasks: ProviderDDQChecklistTaskWithItemRow[];
};

function toDDQPackData(pack: DDQPackRow): DDQPackData {
  return {
    id: pack.id,
    name: pack.name,
    valid_from: pack.valid_from,
    valid_to: pack.valid_to,
    status: pack.status,
    created_at: pack.created_at,
  };
}

function toProviderDDQPackData(pack: ProviderDDQPackRow): ProviderDDQPackData {
  return {
    ...toDDQPackData(pack),
    provider_ddq_pack_id: pack.provider_ddq_pack_id,
    checklist_id: pack.checklist_id,
    checklist_status: pack.checklist_status,
  };
}

function toProviderDDQChecklistResponse(result: {
  pack: DDQPackRow | null;
  checklist: ProviderDDQChecklistRow | null;
  tasks: ProviderDDQChecklistTaskWithItemRow[];
}): ProviderDDQChecklistData {
  if (!result.pack || !result.checklist) {
    throw new ServiceError(404, "DDQ Checklist not found.");
  }

  return {
    pack: toDDQPackData(result.pack),
    checklist: result.checklist,
    tasks: result.tasks,
  };
}

function toEvidenceData(
  evidence: ProviderDDQChecklistTaskEvidenceRow,
  tags: ProviderDDQChecklistTaskEvidenceTagRow[],
) {
  return {
    ...evidence,
    url: evidenceObjectUrl(evidence.object_key),
    tags: tags.map((tag) => ({
      tag: tag.tag,
      source: tag.source,
    })),
  };
}

function validateEvidenceMutation(checklistStatus: DDQChecklistStatus) {
  if (checklistStatus === "withdrawn") {
    throw new ServiceError(
      400,
      "Restore a withdrawn DDQ Checklist before changing evidence.",
    );
  }
}

async function createUserIdentity(email: string) {
  if (isLocalMode()) {
    return localCognitoSub(email);
  }

  return await inviteCognitoUser(email);
}

async function assertAppUserEmailAvailable(client: Client, email: string) {
  const existingUser = await getAppUserByEmail(client, email);
  if (existingUser) {
    throw new ServiceError(409, "User email is already registered.");
  }
}

function validateEvidenceUploadTask(taskType: DDQTaskType | null) {
  if (!isUploadTask(taskType)) {
    throw new ServiceError(400, "This DDQ Checklist Task does not accept evidence uploads.");
  }
}

function validateEvidenceFile(
  input: {
    originalFilename: string;
    contentType: string;
    fileSizeBytes: number;
  },
  taskType: DDQTaskType | null,
) {
  if (!input.originalFilename.trim()) {
    throw new ServiceError(400, "Original filename is required.");
  }
  if (!input.contentType.trim()) {
    throw new ServiceError(400, "Content type is required.");
  }
  if (!Number.isInteger(input.fileSizeBytes) || input.fileSizeBytes < 1) {
    throw new ServiceError(400, "File size is required.");
  }
  if (input.fileSizeBytes > maxEvidenceFileSizeBytes) {
    throw new ServiceError(400, "File must be 10 MB or smaller.");
  }
  if (taskType === "photo-upload" && !input.contentType.startsWith("image/")) {
    throw new ServiceError(400, "Photo upload tasks only accept image files.");
  }
  if (taskType === "document-upload" && !isAllowedDocumentContentType(input.contentType)) {
    throw new ServiceError(400, "Document upload tasks only accept PDF or image files.");
  }
}

async function validateUploadedEvidenceObject(evidence: {
  object_key: string;
  content_type: string;
}) {
  const metadata = await headEvidenceObject(evidence.object_key);
  const contentLength = metadata.contentLength;

  if (
    typeof contentLength !== "number"
    || !Number.isInteger(contentLength)
    || contentLength < 1
  ) {
    throw new ServiceError(400, "Uploaded evidence file size is invalid.");
  }

  if (contentLength > maxEvidenceFileSizeBytes) {
    throw new ServiceError(400, "Uploaded evidence file must be 10 MB or smaller.");
  }

  const actualContentType = metadata.contentType?.trim() ?? "";
  if (!actualContentType) {
    throw new ServiceError(400, "Uploaded evidence content type is missing.");
  }

  if (actualContentType !== evidence.content_type) {
    throw new ServiceError(400, "Uploaded evidence content type does not match.");
  }

  validateEvidenceFile(
    {
      originalFilename: "uploaded-evidence",
      contentType: actualContentType,
      fileSizeBytes: contentLength,
    },
    inferUploadTaskTypeFromContentType(actualContentType),
  );
}

function inferUploadTaskTypeFromContentType(contentType: string): DDQTaskType {
  return contentType.startsWith("image/") ? "photo-upload" : "document-upload";
}

function normalizeTags(tags: string[]) {
  const normalizedTags = new Set<string>();

  for (const tag of tags) {
    const normalized = tag.trim().toLowerCase();
    if (normalized) normalizedTags.add(normalized);
  }

  return Array.from(normalizedTags).sort();
}

function isUploadTask(taskType: DDQTaskType | null) {
  return Boolean(taskType && ddqTaskDefinitions[taskType]?.acceptsEvidence);
}

function isAllowedDocumentContentType(contentType: string) {
  return contentType === "application/pdf" || contentType.startsWith("image/");
}

const maxEvidenceFileSizeBytes = 10 * 1024 * 1024;
const validDocumentTypes = new Set([
  "passport",
  "driving-license",
  "head-and-shoulders-photo",
  "other",
]);
const ddqTaskDefinitions: Record<
  DDQTaskType,
  {
    acceptsEvidence: boolean;
    normalizeConfig: (config: Record<string, unknown>) => Record<string, unknown>;
  }
> = {
  "document-upload": {
    acceptsEvidence: true,
    normalizeConfig(config) {
      const documentType = config.document_type;
      if (typeof documentType !== "string" || !validDocumentTypes.has(documentType)) {
        throw new ServiceError(400, "Document type is required.");
      }

      return { document_type: documentType };
    },
  },
  "form-completion": {
    acceptsEvidence: false,
    normalizeConfig(config) {
      const form = config.form;
      if (!form) {
        throw new ServiceError(400, "Form template is required.");
      }

      return { form: validateFormDocument(form) };
    },
  },
  "photo-upload": {
    acceptsEvidence: true,
    normalizeConfig() {
      return {};
    },
  },
};
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

async function normalizeDDQPackItemInput(
  client: Awaited<ReturnType<typeof createDbClient>>,
  associationCorporationId: number,
  input: DDQPackItemInput,
) {
  if (input.taskType !== "form-completion") {
    return validateDDQPackItemInput(input);
  }

  const title = input.title.trim();
  if (!title) throw new ServiceError(400, "Title is required.");
  if (input.kind !== "ddq-task") {
    throw new ServiceError(400, "Invalid DDQ Pack Item kind.");
  }

  if (input.config.form) {
    return {
      kind: input.kind,
      taskType: input.taskType,
      title,
      config: { form: validateFormDocument(input.config.form) },
    };
  }

  const templateId = input.config.form_template_id;
  if (!Number.isInteger(templateId) || Number(templateId) < 1) {
    throw new ServiceError(400, "Form template is required.");
  }

  const template = await getFormTemplateForAssociation(
    client,
    associationCorporationId,
    Number(templateId),
  );
  if (!template) throw new ServiceError(404, "Form template not found.");

  return {
    kind: input.kind,
    taskType: input.taskType,
    title,
    config: { form: formTemplateToDocument(template) },
  };
}

function validateDDQPackInput(input: {
  name: string;
  validFrom: string;
  validTo: string;
}) {
  if (!input.name.trim()) throw new ServiceError(400, "Name is required.");
  if (!input.validFrom) throw new ServiceError(400, "Valid from is required.");
  if (!input.validTo) throw new ServiceError(400, "Valid to is required.");
  if (!isValidISODate(input.validFrom) || !isValidISODate(input.validTo)) {
    throw new ServiceError(400, "Valid dates must use YYYY-MM-DD format.");
  }
  if (input.validTo < input.validFrom) {
    throw new ServiceError(400, "Valid to must be on or after valid from.");
  }
}

function validateFormTemplateInput(input: {
  shortName: string;
  description: string;
  schema: unknown;
}) {
  try {
    return parseFormTemplateInput(input);
  } catch (error) {
    if (error instanceof FormTemplateValidationError) {
      throw new ServiceError(400, error.message);
    }

    throw error;
  }
}

function formTemplateToDocument(template: FormTemplateDetailRow): FormDocument {
  return {
    kind: "form-document",
    version: 1,
    definition: {
      title: template.short_name.trim(),
      description: cleanOptionalString(template.description),
      items: template.schema_json.items.map(parseFormItem),
    },
    values: {},
  };
}

function validateFormDocument(input: unknown): FormDocument {
  if (!isRecord(input)) {
    throw new ServiceError(400, "Invalid form document.");
  }

  if (input.kind !== "form-document" || input.version !== 1) {
    throw new ServiceError(400, "Invalid form document.");
  }

  if (!isRecord(input.definition)) {
    throw new ServiceError(400, "Invalid form definition.");
  }

  const title = input.definition.title;
  if (typeof title !== "string" || !title.trim()) {
    throw new ServiceError(400, "Form title is required.");
  }

  const items = input.definition.items;
  if (!Array.isArray(items)) {
    throw new ServiceError(400, "Form items are required.");
  }

  return {
    kind: "form-document",
    version: 1,
    definition: {
      title: title.trim(),
      description: cleanOptionalString(input.definition.description),
      items: items.map(parseFormItem),
    },
    values: validateFormValues(input.values),
  };
}

function validateFormValues(input: unknown) {
  if (input === undefined) return {};
  if (!isRecord(input)) {
    throw new ServiceError(400, "Invalid form values.");
  }

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      if (
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "boolean"
      ) {
        throw new ServiceError(400, "Invalid form value.");
      }

      return [key, value];
    }),
  );
}

function normalizeFormValuesForDocument(
  document: FormDocument,
  values: FormValues,
): FormValues {
  const normalized: FormValues = {};
  const itemIds = new Set(document.definition.items.map((item) => item.id));

  for (const [key, value] of Object.entries(values)) {
    if (!itemIds.has(key)) continue;

    if (typeof value === "string") {
      normalized[key] = value.trim();
    } else if (typeof value === "boolean" || value === null) {
      normalized[key] = value;
    } else {
      throw new ServiceError(400, "Invalid form value.");
    }
  }

  return normalized;
}

function validateFormCompletion(document: FormDocument) {
  const errors: Record<string, string> = {};
  const values = document.values ?? {};

  for (const item of document.definition.items) {
    const value = values[item.id];
    const hasValue = hasFormItemValue(value);

    if (item.required && !hasValue) {
      errors[item.id] = "This field is required.";
      continue;
    }
    if (!hasValue) continue;

    if (item.type === "boolean") {
      if (typeof value !== "boolean") {
        errors[item.id] = "Enter yes or no.";
      }
      continue;
    }

    if (typeof value !== "string") {
      errors[item.id] = "Enter a valid value.";
      continue;
    }

    if (item.type === "date" && !isValidISODate(value)) {
      errors[item.id] = "Enter a valid date.";
    }
    if (
      (item.type === "select" || item.type === "radio") &&
      !item.options.includes(value)
    ) {
      errors[item.id] = "Choose one of the available options.";
    }
  }

  return {
    complete: Object.keys(errors).length === 0,
    errors,
  };
}

function hasFormItemValue(value: FormValue | undefined) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return typeof value === "boolean";
}

function firstFormError(errors: Record<string, string>) {
  return Object.values(errors)[0] ?? "Complete all required form fields.";
}

function cleanOptionalString(value: unknown) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function validatePublishableDDQPack(
  client: Awaited<ReturnType<typeof createDbClient>>,
  associationCorporationId: number,
  id: number,
) {
  const pack = await getDDQPackForAssociation(client, associationCorporationId, id);
  if (!pack) throw new ServiceError(404, "DDQ Pack not found.");

  const items = await listDDQPackItemsForAssociation(
    client,
    associationCorporationId,
    id,
  );
  for (const item of items) {
    validateDDQPackItemInput({
      kind: item.kind,
      taskType: item.task_type,
      title: item.title,
      config: item.config,
    });
  }
}

function isValidISODate(value: string) {
  if (!datePattern.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateDDQPackItemInput(input: DDQPackItemInput) {
  const title = input.title.trim();
  if (!title) throw new ServiceError(400, "Title is required.");

  if (input.kind === "checkpoint") {
    return {
      kind: input.kind,
      taskType: null,
      title,
      config: {},
    };
  }

  if (input.kind !== "ddq-task") {
    throw new ServiceError(400, "Invalid DDQ Pack Item kind.");
  }

  if (!input.taskType) throw new ServiceError(400, "Task type is required.");

  const definition = ddqTaskDefinitions[input.taskType];
  if (!definition) throw new ServiceError(400, "Invalid DDQ Pack Item task type.");

  return {
    kind: input.kind,
    taskType: input.taskType,
    title,
    config: definition.normalizeConfig(input.config),
  };
}
