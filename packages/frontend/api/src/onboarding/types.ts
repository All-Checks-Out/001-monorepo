import type { CorporationType, Permission } from "@shared/permissions";

export type AuthenticatedUser = {
  sub: string | null;
  email: string | null;
  emailVerified: boolean | null;
  localUserId?: number;
};

export type UserProfile = {
  id: number;
  cognito_sub: string;
  email: string;
  corporation_id: number;
  status: "invited" | "active" | "disabled";
  permissions: Permission[];
};

export type Corporation = {
  id: number;
  name: string;
  type: CorporationType;
  status: "pending" | "approved" | "rejected";
};

export type AppUser = UserProfile;

export type AppUserWithCorporation = AppUser & {
  corporation_name: string;
  corporation_type: CorporationType;
};

export type CorporationApplication = {
  id: number;
  name: string;
  type: Exclude<CorporationType, "ASSOCIATION">;
  applicant_email: string;
  provider_corporation_id: number | null;
  provider_corporation_name?: string | null;
  status: "pending" | "approved" | "rejected";
};

export type AccessRequest = {
  id: number;
  requester_corporation_id: number;
  provider_corporation_id: number;
  status: "pending" | "approved" | "rejected";
  requester_corporation_name?: string;
  requester_corporation_type?: CorporationType;
  provider_corporation_name?: string;
};

export type DDQPack = {
  id: number;
  name: string;
  valid_from: string;
  valid_to: string;
  status: DDQPackStatus;
  created_at: string;
};

export type DDQPackStatus = "draft" | "published" | "archived";
export type DDQChecklistStatus = "active" | "completed" | "withdrawn";
export type ChecklistEvidenceStatus =
  | "pending_upload"
  | "uploaded"
  | "replaced"
  | "failed";
export type ChecklistEvidenceTagSource = "manual" | "recognition";
export type ProviderDDQPack = DDQPack & {
  provider_ddq_pack_id: number;
  checklist_id: number | null;
  checklist_status: DDQChecklistStatus | null;
};
export type DDQPackItemKind = "ddq-task" | "checkpoint";
export type DDQTaskType = "document-upload" | "form-completion" | "photo-upload";
export type DDQDocumentType =
  | "passport"
  | "driving-license"
  | "head-and-shoulders-photo"
  | "other";

export type DDQDocumentUploadConfig = {
  document_type: DDQDocumentType;
};

type DDQPackItemBase = {
  id: number;
  pack_id: number;
  position: number;
  title: string;
  created_at: string;
};

export type DDQCheckpointItem = DDQPackItemBase & {
  kind: "checkpoint";
  task_type: null;
  config: Record<string, unknown>;
};

export type DDQTaskItem = DDQPackItemBase & {
  kind: "ddq-task";
  task_type: DDQTaskType;
  config: Record<string, unknown>;
};

export type DDQPackItem = DDQCheckpointItem | DDQTaskItem;

export type FormItemType =
  | "text"
  | "textarea"
  | "date"
  | "phone"
  | "select"
  | "radio"
  | "boolean";

export type FormTemplateSchema = {
  version: 1;
  items: FormItem[];
};

export type FormDocument = {
  kind: "form-document";
  version: 1;
  definition: FormDefinition;
  values?: FormValues;
};

export type FormDefinition = {
  title: string;
  description?: string;
  items: FormItem[];
};

export type FormValues = Record<string, FormValue>;
export type FormValue = string | boolean | null;

export type DDQFormCompletionConfig = {
  form: FormDocument;
};

export type FormItemBase = {
  id: string;
  label: string;
  helpText?: string;
  required: boolean;
};

export type FormItem =
  | (FormItemBase & { type: "text"; placeholder?: string })
  | (FormItemBase & { type: "textarea"; placeholder?: string })
  | (FormItemBase & { type: "date" })
  | (FormItemBase & { type: "phone"; placeholder?: string })
  | (FormItemBase & { type: "select"; options: string[] })
  | (FormItemBase & { type: "radio"; options: string[] })
  | (FormItemBase & { type: "boolean" });

export type FormTemplateSummary = {
  id: number;
  association_corporation_id: number;
  short_name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type FormTemplateDetail = FormTemplateSummary & {
  schema_json: FormTemplateSchema;
};

export type ProviderDDQChecklist = {
  id: number;
  provider_ddq_pack_id: number;
  status: DDQChecklistStatus;
  created_at: string;
  updated_at: string;
};

export type ProviderDDQChecklistTask = {
  id: number;
  checklist_id: number;
  ddq_pack_item_id: number;
  status: DDQChecklistStatus;
  position: number;
  kind: DDQPackItemKind;
  task_type: DDQTaskType | null;
  title: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProviderDDQChecklistTaskEvidenceTag = {
  tag: string;
  source: ChecklistEvidenceTagSource;
};

export type ProviderDDQChecklistTaskEvidence = {
  id: number;
  checklist_task_id: number;
  uploaded_by_app_user_id: number;
  object_key: string;
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  status: ChecklistEvidenceStatus;
  created_at: string;
  uploaded_at: string | null;
  replaced_at: string | null;
  url: string;
  tags: ProviderDDQChecklistTaskEvidenceTag[];
};

export type ProviderDDQChecklistTaskFormResponse = {
  id: number;
  checklist_task_id: number;
  form_document: FormDocument;
  complete: boolean;
  errors: Record<string, string>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type DDQPackItemPayload = {
  kind: DDQPackItemKind;
  task_type: DDQTaskType | null;
  title: string;
  config: Record<string, unknown>;
};
