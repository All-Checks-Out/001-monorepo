import {
  AUTH_STORAGE_KEYS,
  ID_TOKEN_STORAGE_KEY,
  LOCAL_USER_STORAGE_KEY,
} from "@frontend/auth/session/storage";
import { decodeIdToken } from "@frontend/auth/cognito/oauth";
import { config } from "../runtime/config";
import type {
  AccessRequest,
  AppUser,
  AppUserWithCorporation,
  Corporation,
  CorporationApplication,
  DDQDocumentType,
  DDQPack,
  DDQPackItem,
  DDQPackItemPayload,
  DDQTaskType,
  FormValues,
  FormTemplateDetail,
  FormTemplateSchema,
  FormTemplateSummary,
  ProviderDDQChecklist,
  ProviderDDQChecklistBranchSelection,
  ProviderDDQChecklistTask,
  ProviderDDQChecklistTaskEvidence,
  ProviderDDQChecklistTaskFormResponse,
  ProviderDDQPack,
  Subject,
  SubjectPayload,
  SubjectType,
} from "./types";
import type { CorporationType, Permission } from "@shared/permissions";

export const checkOnboardingServiceHealth = async () => {
  const response = await fetch(`${config.onboardingServiceBaseUrl}/public/health`);

  if (!response.ok) {
    return false;
  }

  const body = await response.text();
  return body.trim() === "Healthy!";
};

type RootSetupStatusResponse = {
  configured: boolean;
};

export const getRootSetupStatus = async () => {
  return publicJson<RootSetupStatusResponse>(
    "/public/root-user",
    "Could not read root setup status.",
  );
};

type CreateRootUserResponse = {
  user: AppUser;
  corporation: Corporation;
};

export const createRootUser = async (email: string) => {
  return publicJson<CreateRootUserResponse>(
    "/public/root-user",
    "Could not create root user.",
    jsonPost({ email }),
  );
};

type ResetDemoDataResponse = {
  deletedUsers: number;
};

export const fullFactoryResetDemoData = async () => {
  return publicJson<ResetDemoDataResponse>(
    "/public/data/full-factory-reset",
    "Could not perform full factory reset.",
    { method: "POST" },
  );
};

type ReseedDemoDatabaseResponse = {
  corporations: number;
  users: number;
  corporationApplications: number;
  corporationAccessRequests: number;
  ddqPacks: number;
  formTemplates: number;
  providerDDQPacks: number;
  providerDDQChecklists: number;
  subjects: number;
};

type SeededFactoryResetDemoDataResponse = ReseedDemoDatabaseResponse & {
  deletedUsers: number;
};

export const seededFactoryResetDemoData = async () => {
  return publicJson<SeededFactoryResetDemoDataResponse>(
    "/public/data/seeded-factory-reset",
    "Could not perform seeded factory reset.",
    { method: "POST" },
  );
};

export const recreateSampleData = async () => {
  return publicJson<ReseedDemoDatabaseResponse>(
    "/public/data/recreate-sample-data",
    "Could not recreate sample data.",
    { method: "POST" },
  );
};

type GetMeResponse = {
  user: AppUser;
  corporation: Corporation;
};

type LocalDevUser = AppUserWithCorporation;

type LocalDevUsersResponse = {
  users: LocalDevUser[];
};

type LocalStoredUser = {
  sub: string | null;
  email: string | null;
  emailVerified: boolean | null;
  localUserId?: number;
};

export const listLocalDevUsers = async () => {
  return publicJson<LocalDevUsersResponse>(
    "/local-dev/users",
    "Could not read local users.",
  );
};

export const getMe = async () => {
  return authJson<GetMeResponse>(
    "/auth/me",
    "Could not read your profile.",
  );
};

type GetMyUsersResponse = {
  users: AppUser[];
};

export const getMyUsers = async () => {
  return authJson<GetMyUsersResponse>(
    "/auth/my-users",
    "Could not read users.",
  );
};

type InviteMyUserResponse = {
  user: AppUser;
};

export const inviteMyUser = async (email: string) => {
  return authJson<InviteMyUserResponse>(
    "/auth/my-users/invites",
    "Could not invite user.",
    jsonPost({ email }),
  );
};

type UpdateMyUserPermissionsResponse = {
  user: AppUser;
};

export const updateMyCorporationUserPermissions = async (
  userId: number,
  permissions: Permission[],
) => {
  return authJson<UpdateMyUserPermissionsResponse>(
    `/auth/my-users/${encodeURIComponent(userId)}/permissions`,
    "Could not update user permissions.",
    jsonRequest("PUT", { permissions }),
  );
};

type CreateCorporationApplicationResponse = {
  application: CorporationApplication;
};

export const createCorporationApplication = async (
  name: string,
  type: Exclude<CorporationType, "ASSOCIATION">,
  applicantEmail: string,
  providerCorporationId?: number | null,
) => {
  return publicJson<CreateCorporationApplicationResponse>(
    "/public/corporation-applications",
    "Could not submit corporation application.",
    jsonPost({
      name,
      type,
      applicant_email: applicantEmail,
      provider_corporation_id: providerCorporationId ?? null,
    }),
  );
};

type ListProvidersResponse = {
  providers: Pick<Corporation, "id" | "name">[];
};

export const listProviders = async () => {
  const result = await publicJson<ListProvidersResponse>(
    "/public/providers",
    "Could not read providers.",
  );
  return result.providers;
};

type CreateAccessRequestResponse = {
  accessRequest: AccessRequest;
};

export const createAccessRequest = async (
  requesterCorporationId: number,
  providerCorporationId: number,
) => {
  return publicJson<CreateAccessRequestResponse>(
    "/public/access-requests",
    "Could not submit access request.",
    jsonPost({
      requester_corporation_id: requesterCorporationId,
      provider_corporation_id: providerCorporationId,
    }),
  );
};

type ListCorporationApplicationsResponse = {
  applications: CorporationApplication[];
};

export const listCorporationApplications = async () => {
  return authJson<ListCorporationApplicationsResponse>(
    "/auth/association/corporation-applications",
    "Could not read corporation applications.",
  );
};

type ApproveCorporationApplicationResponse = {
  application: CorporationApplication;
  corporation: Corporation;
  user: AppUser;
};

export const approveCorporationApplication = async (id: number) => {
  return authJson<ApproveCorporationApplicationResponse>(
    `/auth/association/corporation-applications/${encodeURIComponent(id)}/approve`,
    "Could not approve corporation application.",
    { method: "POST" },
  );
};

type RejectCorporationApplicationResponse = {
  application: CorporationApplication;
};

export const rejectCorporationApplication = async (id: number) => {
  return authJson<RejectCorporationApplicationResponse>(
    `/auth/association/corporation-applications/${encodeURIComponent(id)}/reject`,
    "Could not reject corporation application.",
    { method: "POST" },
  );
};

type ListProviderCorporationApplicationsResponse = {
  applications: CorporationApplication[];
};

export const listProviderCorporationApplications = async () => {
  return authJson<ListProviderCorporationApplicationsResponse>(
    "/auth/provider/corporation-applications",
    "Could not read corporation applications.",
  );
};

type ApproveProviderCorporationApplicationResponse = {
  application: CorporationApplication;
  corporation: Corporation;
  user: AppUser;
  accessRequest: AccessRequest | null;
};

export const approveProviderCorporationApplication = async (id: number) => {
  return authJson<ApproveProviderCorporationApplicationResponse>(
    `/auth/provider/corporation-applications/${encodeURIComponent(id)}/approve`,
    "Could not approve corporation application.",
    { method: "POST" },
  );
};

type RejectProviderCorporationApplicationResponse = {
  application: CorporationApplication;
};

export const rejectProviderCorporationApplication = async (id: number) => {
  return authJson<RejectProviderCorporationApplicationResponse>(
    `/auth/provider/corporation-applications/${encodeURIComponent(id)}/reject`,
    "Could not reject corporation application.",
    { method: "POST" },
  );
};

type ListCorporationsResponse = {
  corporations: Corporation[];
};

export const listCorporations = async () => {
  return authJson<ListCorporationsResponse>(
    "/auth/association/corporations",
    "Could not read corporations.",
  );
};

type ListAssociationUsersResponse = {
  users: AppUserWithCorporation[];
};

export const listAssociationUsers = async () => {
  return authJson<ListAssociationUsersResponse>(
    "/auth/association/users",
    "Could not read users.",
  );
};

type ListAccessRequestsResponse = {
  accessRequests: AccessRequest[];
};

export const listAccessRequests = async () => {
  return authJson<ListAccessRequestsResponse>(
    "/auth/association/access-requests",
    "Could not read access requests.",
  );
};

type ApproveAccessRequestResponse = {
  accessRequest: AccessRequest;
};

export const approveAccessRequest = async (id: number) => {
  return authJson<ApproveAccessRequestResponse>(
    `/auth/association/access-requests/${encodeURIComponent(id)}/approve`,
    "Could not approve access request.",
    { method: "POST" },
  );
};

type RejectAccessRequestResponse = {
  accessRequest: AccessRequest;
};

export const rejectAccessRequest = async (id: number) => {
  return authJson<RejectAccessRequestResponse>(
    `/auth/association/access-requests/${encodeURIComponent(id)}/reject`,
    "Could not reject access request.",
    { method: "POST" },
  );
};

type ListProviderAccessRequestsResponse = {
  accessRequests: AccessRequest[];
};

export const listProviderAccessRequests = async () => {
  return authJson<ListProviderAccessRequestsResponse>(
    "/auth/provider/access-requests",
    "Could not read access requests.",
  );
};

type ApproveProviderAccessRequestResponse = {
  accessRequest: AccessRequest;
};

export const approveProviderAccessRequest = async (id: number) => {
  return authJson<ApproveProviderAccessRequestResponse>(
    `/auth/provider/access-requests/${encodeURIComponent(id)}/approve`,
    "Could not approve access request.",
    { method: "POST" },
  );
};

type RejectProviderAccessRequestResponse = {
  accessRequest: AccessRequest;
};

export const rejectProviderAccessRequest = async (id: number) => {
  return authJson<RejectProviderAccessRequestResponse>(
    `/auth/provider/access-requests/${encodeURIComponent(id)}/reject`,
    "Could not reject access request.",
    { method: "POST" },
  );
};

type ListMyAccessRequestsResponse = {
  accessRequests: AccessRequest[];
};

export const listMyAccessRequests = async () => {
  return authJson<ListMyAccessRequestsResponse>(
    "/auth/my-access-requests",
    "Could not read access requests.",
  );
};

type ListDDQPacksResponse = {
  packs: DDQPack[];
};

type ListFormTemplatesResponse = {
  formTemplates: FormTemplateSummary[];
};

type FormTemplateResponse = {
  formTemplate: FormTemplateDetail;
};

type ListProviderDDQPacksResponse = {
  packs: ProviderDDQPack[];
};

type ListSubjectTypesResponse = {
  subjectTypes: SubjectType[];
};

type ListProviderSubjectsResponse = {
  subjects: Subject[];
};

type SubjectResponse = {
  subject: Subject;
};

export type ProviderSubjectFilters = {
  subjectTypeKey?: string;
  q?: string;
  includeArchived?: boolean;
};

export type DDQPackPayload = {
  name: string;
  valid_from: string;
  valid_to: string;
};

export type SaveDDQPackDraftPayload = {
  pack: DDQPackPayload;
  items: DDQPackItemPayload[];
};

export type DDQPackStatusAction = "publish" | "archive" | "restore";

export const listDDQPacks = async () => {
  return authJson<ListDDQPacksResponse>(
    "/auth/association/ddq-packs",
    "Could not read DDQ Packs.",
  );
};

type DDQPackResponse = {
  pack: DDQPack;
};

export const getDDQPack = async (id: number) => {
  return authJson<DDQPackResponse>(
    `/auth/association/ddq-packs/${encodeURIComponent(id)}`,
    "Could not read DDQ Pack.",
  );
};

export const createDDQPack = async (payload: DDQPackPayload) => {
  return authJson<DDQPackResponse>(
    "/auth/association/ddq-packs",
    "Could not create DDQ Pack.",
    jsonPost(payload),
  );
};

export const updateDDQPack = async (id: number, payload: DDQPackPayload) => {
  return authJson<DDQPackResponse>(
    `/auth/association/ddq-packs/${encodeURIComponent(id)}`,
    "Could not update DDQ Pack.",
    jsonRequest("PATCH", payload),
  );
};

export const changeDDQPackStatus = async (
  id: number,
  action: DDQPackStatusAction,
) => {
  return authJson<DDQPackResponse>(
    `/auth/association/ddq-packs/${encodeURIComponent(id)}/status`,
    "Could not update DDQ Pack status.",
    jsonPost({ action }),
  );
};

export const deleteDDQPack = async (id: number) => {
  return authJson<{ deleted: true }>(
    `/auth/association/ddq-packs/${encodeURIComponent(id)}`,
    "Could not delete DDQ Pack.",
    { method: "DELETE" },
  );
};

export type FormTemplatePayload = {
  short_name: string;
  description: string;
  schema_json: FormTemplateSchema;
};

export const listAssociationFormTemplates = async () => {
  return authJson<ListFormTemplatesResponse>(
    "/auth/association/form-templates",
    "Could not read form templates.",
  );
};

export const getAssociationFormTemplate = async (id: number) => {
  return authJson<FormTemplateResponse>(
    `/auth/association/form-templates/${encodeURIComponent(id)}`,
    "Could not read form template.",
  );
};

export const createAssociationFormTemplate = async (
  payload: FormTemplatePayload,
) => {
  return authJson<FormTemplateResponse>(
    "/auth/association/form-templates",
    "Could not create form template.",
    jsonPost(payload),
  );
};

export const updateAssociationFormTemplate = async (
  id: number,
  payload: FormTemplatePayload,
) => {
  return authJson<FormTemplateResponse>(
    `/auth/association/form-templates/${encodeURIComponent(id)}`,
    "Could not update form template.",
    jsonRequest("PUT", payload),
  );
};

export const deleteAssociationFormTemplate = async (id: number) => {
  return authJson<{ deleted: true }>(
    `/auth/association/form-templates/${encodeURIComponent(id)}`,
    "Could not delete form template.",
    { method: "DELETE" },
  );
};

type ListDDQPackItemsResponse = {
  pack: DDQPack;
  items: DDQPackItem[];
};

export const listDDQPackItems = async (packId: number) => {
  return authJson<ListDDQPackItemsResponse>(
    `/auth/association/ddq-packs/${encodeURIComponent(packId)}/items`,
    "Could not read DDQ Pack Items.",
  );
};

export const saveDDQPackDraft = async (
  packId: number,
  payload: SaveDDQPackDraftPayload,
) => {
  return authJson<ListDDQPackItemsResponse>(
    `/auth/association/ddq-packs/${encodeURIComponent(packId)}/draft`,
    "Could not save DDQ Pack draft.",
    jsonRequest("PUT", payload),
  );
};

export const listProviderDDQPacks = async () => {
  return authJson<ListProviderDDQPacksResponse>(
    "/auth/provider/ddq-packs",
    "Could not read DDQ Packs.",
  );
};

export const listSubjectTypes = async () => {
  return authJson<ListSubjectTypesResponse>(
    "/auth/subject-types",
    "Could not read Subject types.",
  );
};

export const listProviderSubjects = async (
  filters: ProviderSubjectFilters = {},
) => {
  const searchParams = new URLSearchParams();

  if (filters.subjectTypeKey) {
    searchParams.set("subject_type_key", filters.subjectTypeKey);
  }
  if (filters.q) {
    searchParams.set("q", filters.q);
  }
  if (filters.includeArchived) {
    searchParams.set("include_archived", "true");
  }

  const query = searchParams.toString();
  return authJson<ListProviderSubjectsResponse>(
    `/auth/provider/subjects${query ? `?${query}` : ""}`,
    "Could not read Subjects.",
  );
};

export const getProviderSubject = async (subjectId: number) => {
  return authJson<SubjectResponse>(
    `/auth/provider/subjects/${encodeURIComponent(subjectId)}`,
    "Could not read Subject.",
  );
};

export const createProviderSubject = async (payload: SubjectPayload) => {
  return authJson<SubjectResponse>(
    "/auth/provider/subjects",
    "Could not create Subject.",
    jsonPost(payload),
  );
};

export const updateProviderSubject = async (
  subjectId: number,
  payload: SubjectPayload,
) => {
  return authJson<SubjectResponse>(
    `/auth/provider/subjects/${encodeURIComponent(subjectId)}`,
    "Could not update Subject.",
    jsonRequest("PUT", payload),
  );
};

export const archiveProviderSubject = async (subjectId: number) => {
  return authJson<SubjectResponse>(
    `/auth/provider/subjects/${encodeURIComponent(subjectId)}/archive`,
    "Could not archive Subject.",
    { method: "POST" },
  );
};

export const listAvailableProviderDDQPacks = async () => {
  return authJson<ListDDQPacksResponse>(
    "/auth/provider/ddq-packs/available",
    "Could not read available DDQ Packs.",
  );
};

export const addProviderDDQPack = async (ddqPackId: number) => {
  return authJson<DDQPackResponse>(
    "/auth/provider/ddq-packs",
    "Could not add DDQ Pack.",
    jsonPost({ ddq_pack_id: ddqPackId }),
  );
};

export const listProviderDDQPackItems = async (packId: number) => {
  return authJson<ListDDQPackItemsResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/items`,
    "Could not read DDQ Pack Items.",
  );
};

type ProviderDDQChecklistResponse = {
  pack: DDQPack;
  checklist: ProviderDDQChecklist;
  tasks: ProviderDDQChecklistTask[];
  branchSelections: ProviderDDQChecklistBranchSelection[];
};

export type ProviderDDQChecklistTaskDetailResponse = {
  pack: DDQPack;
  checklist: ProviderDDQChecklist;
  task: ProviderDDQChecklistTask;
  evidence: ProviderDDQChecklistTaskEvidence | null;
  formResponse: ProviderDDQChecklistTaskFormResponse | null;
};

export type SaveChecklistTaskFormResponsePayload = {
  values: FormValues;
};

export type ProviderDDQChecklistTaskEvidenceUploadPayload = {
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  tags: string[];
};

type ProviderDDQChecklistTaskEvidenceUploadUrlResponse = {
  evidence: ProviderDDQChecklistTaskEvidence;
  upload_url: string;
};

export type DDQChecklistStatusAction =
  | "complete"
  | "withdraw"
  | "restore"
  | "reopen";

export const getProviderDDQChecklist = async (packId: number) => {
  return authJson<ProviderDDQChecklistResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/checklist`,
    "Could not read DDQ Checklist.",
  );
};

export const createProviderDDQChecklist = async (packId: number) => {
  return authJson<ProviderDDQChecklistResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/checklist`,
    "Could not create DDQ Checklist.",
    { method: "POST" },
  );
};

export const changeProviderDDQChecklistStatus = async (
  packId: number,
  action: DDQChecklistStatusAction,
) => {
  return authJson<ProviderDDQChecklistResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/checklist/status`,
    "Could not update DDQ Checklist status.",
    jsonPost({ action }),
  );
};

export const changeProviderDDQChecklistTaskStatus = async (
  packId: number,
  taskId: number,
  action: DDQChecklistStatusAction,
) => {
  return authJson<ProviderDDQChecklistResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/checklist/tasks/${encodeURIComponent(taskId)}/status`,
    "Could not update DDQ Checklist Task status.",
    jsonPost({ action }),
  );
};

export const selectProviderDDQChecklistBranchOption = async (
  packId: number,
  branchTaskId: number,
  optionId: string,
) => {
  return authJson<ProviderDDQChecklistResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/checklist/branches/${encodeURIComponent(branchTaskId)}/selection`,
    "Could not update branch selection.",
    jsonRequest("PUT", { option_id: optionId }),
  );
};

export const getProviderDDQChecklistTask = async (
  packId: number,
  taskId: number,
) => {
  return authJson<ProviderDDQChecklistTaskDetailResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/checklist/tasks/${encodeURIComponent(taskId)}`,
    "Could not read DDQ Checklist Task.",
  );
};

export const saveProviderDDQChecklistTaskFormResponse = async (
  packId: number,
  taskId: number,
  payload: SaveChecklistTaskFormResponsePayload,
) => {
  return authJson<ProviderDDQChecklistTaskDetailResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/checklist/tasks/${encodeURIComponent(taskId)}/form-response`,
    "Could not save form response.",
    jsonRequest("PUT", payload),
  );
};

export const completeProviderDDQChecklistTaskFormResponse = async (
  packId: number,
  taskId: number,
  payload: SaveChecklistTaskFormResponsePayload,
) => {
  return authJson<ProviderDDQChecklistTaskDetailResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/checklist/tasks/${encodeURIComponent(taskId)}/form-response/complete`,
    "Could not complete form response.",
    jsonPost(payload),
  );
};

export const createProviderDDQChecklistTaskEvidenceUploadUrl = async (
  packId: number,
  taskId: number,
  payload: ProviderDDQChecklistTaskEvidenceUploadPayload,
) => {
  return authJson<ProviderDDQChecklistTaskEvidenceUploadUrlResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/checklist/tasks/${encodeURIComponent(taskId)}/evidence/upload-url`,
    "Could not create evidence upload URL.",
    jsonPost(payload),
  );
};

export const updateProviderDDQChecklistTaskEvidenceTags = async (
  packId: number,
  taskId: number,
  evidenceId: number,
  tags: string[],
) => {
  return authJson<ProviderDDQChecklistTaskDetailResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/checklist/tasks/${encodeURIComponent(taskId)}/evidence/${encodeURIComponent(evidenceId)}/tags`,
    "Could not update checklist task evidence tags.",
    jsonRequest("PUT", { tags }),
  );
};

const completeLocalDevEvidenceUpload = async (objectKey: string) => {
  await publicJson<{ evidence: ProviderDDQChecklistTaskEvidence | null }>(
    "/local-dev/evidence-uploads/complete",
    "Could not complete local evidence upload.",
    jsonPost({ object_key: objectKey }),
  );
};

export const uploadProviderDDQChecklistTaskEvidence = async (
  packId: number,
  taskId: number,
  file: File,
  tags: string[],
) => {
  const uploadDetails = await createProviderDDQChecklistTaskEvidenceUploadUrl(
    packId,
    taskId,
    {
      original_filename: file.name,
      content_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      tags,
    },
  );

  const uploadResponse = await fetch(uploadDetails.upload_url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Could not upload checklist task evidence.");
  }

  if (config.isLocal) {
    await completeLocalDevEvidenceUpload(uploadDetails.evidence.object_key);
  }

  return {
    evidence: uploadDetails.evidence,
    upload_url: uploadDetails.upload_url,
  };
};

export type CreateDDQPackItemPayload = DDQPackItemPayload & {
  insert_after_item_id: number | null;
};

export const createDDQPackItem = async (
  packId: number,
  payload: CreateDDQPackItemPayload,
) => {
  return authJson<{ item: DDQPackItem }>(
    `/auth/association/ddq-packs/${encodeURIComponent(packId)}/items`,
    "Could not create DDQ Pack Item.",
    jsonPost(payload),
  );
};

export const updateDDQPackItem = async (
  packId: number,
  itemId: number,
  payload: DDQPackItemPayload,
) => {
  return authJson<{ item: DDQPackItem }>(
    `/auth/association/ddq-packs/${encodeURIComponent(packId)}/items/${encodeURIComponent(itemId)}`,
    "Could not update DDQ Pack Item.",
    jsonRequest("PATCH", payload),
  );
};

export const deleteDDQPackItem = async (packId: number, itemId: number) => {
  return authJson<{ deleted: true }>(
    `/auth/association/ddq-packs/${encodeURIComponent(packId)}/items/${encodeURIComponent(itemId)}`,
    "Could not delete DDQ Pack Item.",
    { method: "DELETE" },
  );
};

export const DDQ_DOCUMENT_TYPES: {
  value: DDQDocumentType;
  label: string;
}[] = [
  { value: "passport", label: "Passport" },
  { value: "driving-license", label: "Driving license" },
  { value: "head-and-shoulders-photo", label: "Head-and-shoulders photo" },
  { value: "other", label: "Other" },
];

export type DDQTaskDefinition = {
  type: DDQTaskType;
  label: string;
  defaultConfig: Record<string, unknown>;
};

export const DDQ_TASK_DEFINITIONS: DDQTaskDefinition[] = [
  {
    type: "document-upload",
    label: "Document upload",
    defaultConfig: { document_type: "passport" },
  },
  { type: "form-completion", label: "Form completion", defaultConfig: {} },
  { type: "photo-upload", label: "Photo upload", defaultConfig: {} },
];

async function publicJson<T>(
  path: string,
  errorMessage: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${config.onboardingServiceBaseUrl}${path}`, init);

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, errorMessage));
  }

  return await response.json() as T;
}

async function authJson<T>(
  path: string,
  errorMessage: string,
  init: RequestInit = {},
) {
  const response = await fetchWithAuth(path, init);

  if (response.status === 401) {
    clearStoredAuth();
  }

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response, errorMessage));
  }

  return await response.json() as T;
}

async function responseErrorMessage(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function jsonPost(body: unknown): RequestInit {
  return jsonRequest("POST", body);
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function fetchWithAuth(path: string, init: RequestInit = {}) {
  if (config.isLocal) {
    const localUser = getLocalStoredUser();
    const localUserId = getLocalUserId(localUser);

    if (!localUserId) {
      throw new Error("You must select a local user.");
    }

    return await fetch(`${config.onboardingServiceBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
        "x-local-user-id": String(localUserId),
      },
    });
  }

  const idToken = window.localStorage.getItem(ID_TOKEN_STORAGE_KEY);

  if (!idToken || !decodeIdToken(idToken)) {
    clearStoredAuth();
    throw new Error("You must be logged in.");
  }

  return await fetch(`${config.onboardingServiceBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      Authorization: idToken,
    },
  });
}

function getLocalStoredUser() {
  const raw = window.localStorage.getItem(LOCAL_USER_STORAGE_KEY);
  if (!raw) return null;

  return JSON.parse(raw) as LocalStoredUser;
}

function getLocalUserId(localUser: LocalStoredUser | null) {
  if (!localUser) return null;
  const localUserId = localUser.localUserId;
  if (
    typeof localUserId === "number" &&
    Number.isInteger(localUserId) &&
    localUserId > 0
  ) {
    return localUserId;
  }
  return null;
}

function clearStoredAuth() {
  AUTH_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}
