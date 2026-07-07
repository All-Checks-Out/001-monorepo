export type { CorporationType, Permission } from "@shared/permissions";
export type {
  SubjectPropertySelection,
  SubjectScalarValue,
  SubjectValues,
} from "@shared/subjects";
import type { CorporationType, Permission } from "@shared/permissions";
import type {
  SubjectPropertySelection,
  SubjectScalarValue,
  SubjectValues,
} from "@shared/subjects";

export type ApplicationType = Exclude<CorporationType, "ASSOCIATION">;
export type RequestStatus = "pending" | "approved" | "rejected";
export type DDQPackItemKind = "ddq-task" | "checkpoint" | "branch";
export type DDQTaskType = "document-upload" | "form-completion" | "photo-upload";
export type DDQPackStatus = "draft" | "published" | "archived";
export type DDQChecklistStatus = "active" | "completed" | "withdrawn";
export type ChecklistEvidenceStatus =
  | "pending_upload"
  | "uploaded"
  | "replaced"
  | "failed";
export type ChecklistEvidenceTagSource = "manual" | "recognition";
export type CorporationRow = {
  id: number;
  name: string;
  type: CorporationType;
  status: RequestStatus;
};

export type AppUserRow = {
  id: number;
  corporation_id: number;
  cognito_sub: string;
  email: string;
  status: "invited" | "active" | "disabled";
  permissions: Permission[];
};

export type CorporationApplicationRow = {
  id: number;
  name: string;
  type: ApplicationType;
  applicant_email: string;
  provider_corporation_id: number | null;
  provider_corporation_name?: string | null;
  status: RequestStatus;
};

export type CorporationAccessRequestRow = {
  id: number;
  requester_corporation_id: number;
  provider_corporation_id: number;
  status: RequestStatus;
};

export type AccessRequestWithCorporationsRow = CorporationAccessRequestRow & {
  requester_corporation_name: string;
  requester_corporation_type: CorporationType;
  provider_corporation_name: string;
};

export type AppUserWithCorporationRow = AppUserRow & {
  corporation_name: string;
  corporation_type: CorporationType;
};

export type CurrentUserRow = AppUserRow & {
  corporation_name: string;
  corporation_type: CorporationType;
  corporation_status: RequestStatus;
};

export type DDQPackRow = {
  id: number;
  association_corporation_id: number;
  name: string;
  valid_from: string;
  valid_to: string;
  status: DDQPackStatus;
  created_at: string;
};

export type ProviderDDQPackRow = DDQPackRow & {
  provider_ddq_pack_id: number;
  checklist_id: number | null;
  checklist_status: DDQChecklistStatus | null;
};

export type DDQPackItemRow = {
  id: number;
  pack_id: number;
  position: number;
  kind: DDQPackItemKind;
  task_type: DDQTaskType | null;
  title: string;
  config: Record<string, unknown>;
  parent_branch_item_id: number | null;
  parent_branch_option_id: string | null;
  created_at: string;
};

export type ProviderDDQChecklistRow = {
  id: number;
  provider_ddq_pack_id: number;
  status: DDQChecklistStatus;
  created_at: string;
  updated_at: string;
};

export type ProviderDDQChecklistTaskRow = {
  id: number;
  checklist_id: number;
  ddq_pack_item_id: number;
  status: DDQChecklistStatus;
  created_at: string;
  updated_at: string;
};

export type ProviderDDQChecklistTaskWithItemRow = ProviderDDQChecklistTaskRow & {
  position: number;
  kind: DDQPackItemKind;
  task_type: DDQTaskType | null;
  title: string;
  config: Record<string, unknown>;
  parent_branch_item_id: number | null;
  parent_branch_option_id: string | null;
};

export type ProviderDDQChecklistBranchSelectionRow = {
  id: number;
  checklist_id: number;
  branch_pack_item_id: number;
  selected_option_id: string;
  created_at: string;
  updated_at: string;
};

export type ProviderDDQChecklistTaskEvidenceRow = {
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
};

export type ProviderDDQChecklistTaskEvidenceTagRow = {
  evidence_id: number;
  tag: string;
  source: ChecklistEvidenceTagSource;
  created_at: string;
};

export type ProviderDDQChecklistTaskFormResponseRow = {
  id: number;
  checklist_task_id: number;
  form_document: FormDocument;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type SubjectRow = {
  id: number;
  provider_corporation_id: number;
  subject_type_key: string;
  display_name: string;
  values_json: SubjectValues;
  created_by_app_user_id: number | null;
  updated_by_app_user_id: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FormItemType =
  | "text"
  | "textarea"
  | "date"
  | "phone"
  | "select"
  | "radio"
  | "boolean"
  | "subject";

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
export type FormSubjectEntryValue = SubjectValues;
export type FormValue = SubjectScalarValue | FormSubjectEntryValue[];

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
  | (FormItemBase & { type: "boolean" })
  | (FormItemBase & {
      type: "subject";
      subjectTypeKey: string;
      repeatable: boolean;
      selectedProperties: SubjectPropertySelection[];
    });

export type FormTemplateSummaryRow = {
  id: number;
  association_corporation_id: number;
  short_name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export type FormTemplateDetailRow = FormTemplateSummaryRow & {
  schema_json: FormTemplateSchema;
};
