# DDQ Pack Form Completion System Specification

## Purpose

This document is the long-term specification for reusable Association form
templates, DDQ pack form-completion tasks, and Provider form-completion task
execution.

Frontend route ownership, remote mount points, and global navigation ownership
follow [Module Federation Architecture](../architecture/module-federation.md).
That architecture document is canonical if route ownership guidance here ever
appears stale.

It supersedes the earlier form-template-only specification. The system is built
around one central rule:

```text
A DDQ pack item must own the form definition it needs at execution time.
```

Associations may maintain reusable form templates, but a DDQ pack item must not
store a reference to a template. When an Association creates a form-completion
task from a template, the backend copies the template's form definition into
the DDQ pack item. Later template edits or deletion must not affect existing
DDQ packs or Provider checklist tasks.

## Product Goals

- Association users can design reusable form templates.
- Association users can add form-completion tasks to DDQ packs by selecting a
  form template.
- The pack item stores an independent copy of the form definition.
- Provider users can complete form-completion tasks over multiple visits.
- Partial form responses are saved and can be resumed.
- A form-completion checklist task is completed when all mandatory fields have
  valid response data.
- Earlier persisted form documents remain readable as the form document language
  grows.
- The implementation stays small, explicit, and easy for a new developer to
  understand.

## Domain Language

Use these terms consistently:

- `Form Template`: a reusable Association-owned design-time form.
- `Form Document`: a self-contained JSON document containing a form definition
  and optionally response values.
- `DDQ Pack`: the Association-authored due diligence pack.
- `DDQ Pack Item`: one ordered item inside a DDQ pack.
- `Form Completion Task`: a DDQ pack item with `task_type =
  "form-completion"`.
- `Provider DDQ Pool Item`: one row in `provider_ddq_pack`; this means a
  provider has added a DDQ pack to its pool.
- `Checklist`: the Provider execution instance for exactly one Provider DDQ
  Pool Item.
- `Checklist Task`: the Provider execution state for exactly one DDQ pack item.
- `Form Response`: Provider-entered values for a form-completion checklist task.

## Applications

### `apps/form-design`

`apps/form-design` is the Association-facing route app for template management.

Route base:

```text
/form-design
```

Responsibilities:

- List Association form templates.
- Create, edit, and delete templates.
- Provide the deterministic form designer.
- Persist template metadata and schema through the onboarding API.

Routes:

```text
/form-design/association/forms
/form-design/association/forms/new
/form-design/association/forms/:templateId/designer
```

### `apps/core`

`apps/core` owns the DDQ pack editor and the Provider checklist workspace.

Relevant routes:

```text
/core/association/ddq-packs/:packId
/core/provider/ddq-packs
/core/provider/ddq-packs/:packId/checklist
/core/provider/ddq-packs/:packId/checklist/tasks/:taskId
```

The Provider form-completion UI may live in `apps/core` initially. A future
`apps/form-display` route app is allowed if the form runtime becomes large
enough to justify a separate microfrontend, but it is not required for the
first implementation.

## Permissions

Association template permissions:

```ts
type AssociationPermission =
  | "forms:read"
  | "forms:edit"
  | "ddq-packs:read"
  | "ddq-packs:edit";
```

Rules:

- `forms:read` can list and read form templates.
- `forms:edit` can create, update, and delete form templates.
- `ddq-packs:read` can view DDQ packs.
- `ddq-packs:edit` can edit DDQ pack draft contents, including adding
  form-completion tasks.

Provider checklist permissions:

```ts
type ProviderPermission =
  | "ddq-packs:add-new"
  | "ddq-packs:perform-checks"
  | "ddq-packs:review-checks"
  | "ddq-packs:approve-checks";
```

Rules:

- `ddq-packs:add-new` controls adding DDQ packs to the Provider pool.
- `ddq-packs:perform-checks` can create checklists, save form responses, upload
  evidence, and change checklist task status.
- `ddq-packs:review-checks` can view checklists and task details read-only.
- `ddq-packs:approve-checks` can view checklists and task details read-only for
  this phase.
- Backend authorization is authoritative. Frontend checks are usability only.

## Form Document Model

The durable form unit is `FormDocument`. It can represent:

- a blank form definition,
- a partially completed form,
- a fully completed form.

Recommended TypeScript model:

```ts
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
```

`values` is keyed by `FormItem.id`.

Blank form:

```json
{
  "kind": "form-document",
  "version": 1,
  "definition": {
    "title": "Directors Declaration",
    "items": []
  },
  "values": {}
}
```

Partially completed form:

```json
{
  "kind": "form-document",
  "version": 1,
  "definition": {
    "title": "Directors Declaration",
    "items": [
      { "id": "director_name", "type": "text", "label": "Director name", "required": true },
      { "id": "appointment_date", "type": "date", "label": "Appointment date", "required": true }
    ]
  },
  "values": {
    "director_name": "Ada Lovelace"
  }
}
```

Fully completed form:

```json
{
  "kind": "form-document",
  "version": 1,
  "definition": {
    "title": "Directors Declaration",
    "items": [
      { "id": "director_name", "type": "text", "label": "Director name", "required": true },
      { "id": "appointment_date", "type": "date", "label": "Appointment date", "required": true }
    ]
  },
  "values": {
    "director_name": "Ada Lovelace",
    "appointment_date": "2026-06-23"
  }
}
```

## Form Item Model

The initial form language is deliberately small.

```ts
export type FormItemType =
  | "text"
  | "textarea"
  | "date"
  | "phone"
  | "select"
  | "radio"
  | "boolean";

export type FormItemBase = {
  id: string;
  type: FormItemType;
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
```

Value rules:

- `text`, `textarea`, `phone`, `select`, `radio`, and `date` values are strings.
- `boolean` values are booleans.
- Missing keys, empty strings, and `null` are incomplete for required fields.
- Optional fields may be missing, empty, or `null`.
- `select` and `radio` values must be one of the configured `options`.
- `date` values must use `YYYY-MM-DD`.

## Compatibility And Versioning

Readers must support every previous `FormDocument.version`. Writers only write
the latest version.

All form rendering and validation should pass through a small normalizer:

```ts
export function normalizeFormDocument(input: unknown): FormDocument {
  const document = parseFormDocument(input);

  if (document.version === 1) {
    return document;
  }

  throw new Error("Unsupported form document version.");
}
```

When version 2 is introduced:

```ts
export function normalizeFormDocument(input: unknown): LatestFormDocument {
  const document = parseFormDocument(input);

  if (document.version === 1) return upgradeV1ToLatest(document);
  if (document.version === 2) return document;

  throw new Error("Unsupported form document version.");
}
```

Design rules for future versions:

- Add fields rather than changing the meaning of existing fields.
- Keep `id`, `type`, `label`, and `required` stable for existing item types.
- Prefer optional properties for new capabilities.
- Do not rely on template IDs to interpret copied pack item forms.
- Avoid database check constraints that hard-code one schema version.

## Persisted Data Model

### `form_templates`

Existing table:

```sql
CREATE TABLE IF NOT EXISTS form_templates (
    id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    association_corporation_id INT NOT NULL,
    short_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    schema_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`schema_json` currently stores the design-time form definition:

```ts
export type FormTemplateSchema = {
  version: 1;
  items: FormItem[];
};
```

Recommended forward-compatible adjustment:

- Keep the table.
- Keep `schema_json JSONB`.
- Do not add references from DDQ pack items to this table.
- Avoid a hard database check that only allows `version = 1`; validate shape in
  service code instead.

### `ddq_pack_item`

Existing table:

```sql
CREATE TABLE IF NOT EXISTS ddq_pack_item (
    id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    pack_id INT NOT NULL,
    position INT NOT NULL,
    kind VARCHAR(32) NOT NULL,
    task_type VARCHAR(64),
    title VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

For `task_type = "form-completion"`, persisted `config` must contain a copied
form document:

```ts
export type DDQFormCompletionConfig = {
  form: FormDocument;
};
```

Example:

```json
{
  "form": {
    "kind": "form-document",
    "version": 1,
    "definition": {
      "title": "Directors Declaration",
      "description": "Required director details",
      "items": []
    },
    "values": {}
  }
}
```

It must not contain the source `form_template_id` after persistence.

### Provider Form Responses

Provider-entered response data should be persisted separately from the DDQ pack
item. The pack item contains the Association-authored blank copied form. The
Provider response belongs to a checklist task.

Recommended new table:

```sql
CREATE TABLE IF NOT EXISTS provider_ddq_checklist_task_form_response (
    id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    checklist_task_id INT NOT NULL UNIQUE,
    form_document JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL,
    CONSTRAINT provider_ddq_checklist_task_form_response_task_fk
        FOREIGN KEY (checklist_task_id)
        REFERENCES provider_ddq_checklist_task(id)
        ON DELETE CASCADE
);
```

The response table stores a `FormDocument` with the same `definition` copied
from the DDQ pack item and `values` filled by the Provider.

Rationale:

- The DDQ pack item remains the reusable pack definition.
- Provider response data is isolated per provider checklist task.
- Partial saves are simple: update `form_document.values`.
- Completion checks are deterministic: validate `form_document` against its own
  definition.

## Association Form Template Designer

The form designer is deterministic. It is not an LLM-based designer.

Template list route:

```text
/form-design/association/forms
```

Required behavior:

- Show templates owned by the current Association corporation.
- Show columns for short name, description, created date, edit, and delete.
- Add opens `/form-design/association/forms/new`.
- Edit opens `/form-design/association/forms/:templateId/designer`.
- Delete requires confirmation.
- Loading, error, empty, read-only, and no-permission states must be clear.

Designer routes:

```text
/form-design/association/forms/new
/form-design/association/forms/:templateId/designer
```

Required behavior:

- Edit short name and description.
- Add supported field types.
- Configure label, required flag, help text, placeholder, and options where
  applicable.
- Show a live preview.
- Guard unsaved edits when closing or navigating away.
- Persist through the existing form-template API.

## Association DDQ Pack Editor

Route:

```text
/core/association/ddq-packs/:packId
```

The DDQ pack editor uses one coherent draft model:

```text
Nothing on this page is permanent until Save Pack is clicked.
```

Frontend state should contain:

```ts
type PackDraftState = {
  pack: DDQPackPayload;
  items: DraftPackItem[];
};
```

All metadata and item edits update the local draft. `Save Pack` persists the
full draft through:

```text
PUT /auth/association/ddq-packs/:packId/draft
```

Request:

```ts
export type SaveDDQPackDraftPayload = {
  pack: {
    name: string;
    valid_from: string;
    valid_to: string;
  };
  items: DDQPackItemPayload[];
};
```

Positions are derived from array order.

### Adding A Form Completion Task

When the selected item type is `form-completion`, the UI must make the required
form selection explicit.

Required UI:

- Task title input.
- Required form-template dropdown.
- Helper text:

```text
The selected template will be copied into this DDQ pack item. Later edits or deletion of the template will not affect this task.
```

The dropdown is populated from:

```text
GET /auth/association/form-templates
```

The frontend may keep `selected_form_template_id` in local draft UI state, but
that field is an instruction to the backend, not durable pack item data.

Recommended draft payload for a newly added form-completion item:

```json
{
  "kind": "ddq-task",
  "task_type": "form-completion",
  "title": "Complete directors declaration",
  "config": {
    "form_template_id": 12
  }
}
```

The backend must replace this with:

```json
{
  "kind": "ddq-task",
  "task_type": "form-completion",
  "title": "Complete directors declaration",
  "config": {
    "form": {
      "kind": "form-document",
      "version": 1,
      "definition": {
        "title": "Directors Declaration",
        "description": "Required director details",
        "items": []
      },
      "values": {}
    }
  }
}
```

Existing form-completion tasks should retain their copied `config.form` when
edited unless the user explicitly chooses a different template.

## Backend Form Copying Rule

Template copying must happen server-side.

Service behavior when normalizing a form-completion pack item:

1. If `config.form` is already a valid `FormDocument`, preserve and normalize
   it.
2. Else if `config.form_template_id` is a positive integer, read that template
   for the current Association corporation.
3. Convert the template to a blank `FormDocument`.
4. Persist only `{ form: copiedDocument }`.
5. If neither a valid `form` nor a valid `form_template_id` is provided, reject
   the item with a 400 error.

Recommended conversion:

```ts
export function formTemplateToDocument(template: FormTemplateDetail): FormDocument {
  return {
    kind: "form-document",
    version: 1,
    definition: {
      title: template.short_name,
      description: template.description || undefined,
      items: template.schema_json.items,
    },
    values: {},
  };
}
```

The Association corporation constraint is important. Do not fetch a template by
template ID alone.

## Provider Checklist Execution

A checklist belongs to one Provider DDQ Pool Item, not directly to `ddq_pack`.
This prevents execution state from leaking across providers.

Existing status model:

```ts
export type DDQChecklistStatus = "active" | "completed" | "withdrawn";

export type DDQChecklistStatusAction =
  | "complete"
  | "withdraw"
  | "restore"
  | "reopen";
```

Status semantics:

- `active`: still in progress or needs action.
- `completed`: execution is complete.
- `withdrawn`: intentionally abandoned, waived, or no longer pursued.

Checklist-level rules:

- If every task is `completed`, automatically transition the checklist to
  `completed`.
- If the checklist is `completed` and any task moves away from `completed`,
  automatically transition the checklist to `active`.
- If the checklist is `withdrawn`, do not automatically complete it.
- `withdraw` sets the checklist to `withdrawn` without changing task statuses.
- `restore` sets the checklist to `active` and leaves task statuses untouched.
- `complete` is allowed only when every task is `completed`.
- `reopen` sets the checklist to `active` and leaves task statuses untouched.

## Provider Form Completion Task Execution

Provider users open a form-completion task from:

```text
/core/provider/ddq-packs/:packId/checklist/tasks/:taskId
```

For upload tasks, this route shows evidence upload/review. For
form-completion tasks, it shows a form response workspace.

Required behavior:

- Read the copied blank form from `task.config.form`.
- Read an existing response from
  `provider_ddq_checklist_task_form_response` if present.
- If no response exists, initialize one from `task.config.form`.
- Render the form fields from `form_document.definition.items`.
- Save partial responses without completing the task.
- Preserve entered data across visits.
- Show validation errors for required fields and invalid values.
- Enable `Mark complete` only when all required fields are valid.
- When completion succeeds, save the latest response and mark the checklist task
  `completed`.
- If a completed response is edited later, reopen the task or require an
  explicit `Reopen` action before editing. Prefer explicit `Reopen` for clarity.

Partial save endpoint:

```text
PUT /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId/form-response
```

Complete endpoint:

```text
POST /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId/form-response/complete
```

Recommended request for both:

```ts
export type SaveChecklistTaskFormResponsePayload = {
  values: FormValues;
};
```

Recommended response:

```ts
export type ProviderDDQChecklistTaskFormResponse = {
  id: number;
  checklist_task_id: number;
  form_document: FormDocument;
  complete: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type ProviderDDQChecklistTaskDetailResponse = {
  pack: DDQPack;
  checklist: ProviderDDQChecklist;
  task: ProviderDDQChecklistTask;
  evidence: ProviderDDQChecklistTaskEvidence | null;
  formResponse?: ProviderDDQChecklistTaskFormResponse | null;
};
```

Server save behavior:

1. Require `ddq-packs:perform-checks`.
2. Resolve the checklist task for the current Provider corporation, pack, and
   task ID.
3. Reject if the checklist is withdrawn.
4. Reject if the task is not `task_type = "form-completion"`.
5. Normalize `task.config.form`.
6. Merge submitted `values` into a response document based on the copied form.
7. Validate value types and option/date constraints.
8. Upsert `provider_ddq_checklist_task_form_response`.
9. Return the saved response and task detail.

Server complete behavior:

1. Run the save behavior.
2. Validate all required fields.
3. If valid, set response `completed_at = NOW()`.
4. Transition checklist task to `completed`.
5. Recompute checklist status.
6. Return the updated task detail.

## Validation Helpers

Recommended helper functions:

```ts
export function emptyFormDocumentFromTask(task: ProviderDDQChecklistTask): FormDocument;

export function mergeFormValues(
  document: FormDocument,
  values: FormValues,
): FormDocument;

export function validateFormValues(document: FormDocument): {
  complete: boolean;
  errors: Record<string, string>;
};
```

Completion means:

```ts
const complete = definition.items.every((item) => {
  if (!item.required) return true;
  return hasValidValue(item, values[item.id]);
});
```

## API Summary

Association form templates:

```text
GET    /auth/association/form-templates
POST   /auth/association/form-templates
GET    /auth/association/form-templates/:id
PUT    /auth/association/form-templates/:id
DELETE /auth/association/form-templates/:id
```

Association DDQ pack draft:

```text
GET /auth/association/ddq-packs/:packId/items
PUT /auth/association/ddq-packs/:packId/draft
```

Provider checklist:

```text
GET  /auth/provider/ddq-packs/:packId/checklist
POST /auth/provider/ddq-packs/:packId/checklist
POST /auth/provider/ddq-packs/:packId/checklist/status
POST /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId/status
GET  /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId
```

Provider form response:

```text
PUT  /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId/form-response
POST /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId/form-response/complete
```

## Non-Goals For The Initial Version

- Full JSON Schema authoring.
- LLM-generated forms.
- Conditional logic.
- Repeatable sections.
- Cross-field validation.
- Template publishing/versioning.
- Form template references from DDQ pack items.
- Provider responses stored inside `ddq_pack_item.config`.
