# DDQ Pack Form Completion Development Plan

## Purpose

This plan describes the missing work to implement the system specified in
[DDQ Pack Form Completion System Specification](../specs/form-designer-spec.md).

Frontend route ownership, remote mount points, and global navigation ownership
follow [Module Federation Architecture](../architecture/module-federation.md).
That architecture document is canonical for shell/core/form-design ownership.

The work is split into two major epics:

- `EPIC01`: Association DDQ pack editor changes.
- `EPIC02`: Provider form-completion task execution.

Each epic should be delivered in small, testable slices. Keep the code simple:
prefer the existing repository patterns, small validation helpers, and explicit
types over broad abstractions.

## Current Implementation Snapshot

Already present:

- Association form template CRUD and designer in `apps/form-design`.
- `form_templates` table and backend CRUD endpoints.
- DDQ pack draft save endpoint:
  `PUT /auth/association/ddq-packs/:packId/draft`.
- DDQ pack item type `form-completion`.
- Provider checklist creation and task status workflow.
- Provider task detail route used for upload task execution/review.

Known gaps:

- Form-completion pack items do not require or store a copied form document.
- `form-completion` backend config normalization currently returns `{}`.
- The Association pack item UI does not show a required form-template picker.
- Provider checklist tasks do not persist form responses.
- Provider task detail UI does not render or save form-completion task data.
- Completing a form-completion task is not tied to required field validation.

## EPIC01: Association DDQ Pack Editor

### Goal

Allow Association users to create and edit DDQ pack form-completion tasks by
selecting a form template, while persisting an independent copied form document
inside `ddq_pack_item.config`.

### EPIC01 Acceptance Criteria

- When adding a form-completion task, the UI clearly requires a form template.
- The template dropdown lists the current Association's form templates.
- Saving the pack copies the selected template definition into the pack item.
- Persisted form-completion item config contains `config.form`.
- Persisted form-completion item config does not contain `form_template_id`.
- Editing the template later does not change the pack item.
- Deleting the template later does not break the pack item.
- Existing form-completion items display the copied form title in the details
  column.
- Publishing a pack fails if any form-completion item lacks a valid copied form.
- Type checks pass for changed packages.

### EPIC01 Data Types

Add shared types in `packages/frontend/api/src/onboarding/types.ts` or a nearby
shared module:

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

export type DDQFormCompletionConfig = {
  form: FormDocument;
};
```

Add a temporary draft-only UI field in `apps/core` if useful:

```ts
type ItemFormState = {
  kind: DDQPackItemKind;
  task_type: DDQTaskType;
  title: string;
  document_type: DDQDocumentType;
  form_template_id: number | "";
};
```

Do not persist `form_template_id` after backend normalization.

### EPIC01 Backend Tasks

1. Add form document validation helpers.

   Suggested location:

   ```text
   services/onboarding-service/src/services/formDocuments.ts
   ```

   Keep this file small and dependency-light.

   Required functions:

   ```ts
   export function validateFormDocument(input: unknown): FormDocument;
   export function formTemplateToDocument(template: FormTemplateDetailRow): FormDocument;
   export function validateFormValues(document: FormDocument): FormValidationResult;
   ```

2. Update `ddqTaskDefinitions["form-completion"]`.

   Current behavior in `services/onboarding-service/src/services/onboardingService.ts`
   discards config. Replace it with validation/copy support.

   Because template copy requires a database lookup, refactor validation so
   form-completion normalization can be async or can run in a pre-normalization
   step during DDQ pack draft save.

   Recommended simple approach:

   ```ts
   async function normalizeDDQPackItemInput(
     client: Client,
     associationCorporationId: number,
     input: DDQPackItemInput,
   ): Promise<NormalizedDDQPackItemInput>
   ```

3. Thread Association context into draft save.

   `saveAssociationDDQPackDraftController` already has current Association user
   context. Pass it into the service so the service can fetch templates scoped
   to `context.corporation.id`.

   Recommended signature:

   ```ts
   export async function saveAssociationDDQPackDraft(
     context: CurrentUserContext,
     packId: number,
     input: SaveAssociationDDQPackDraftInput,
   )
   ```

4. Copy templates server-side.

   Behavior:

   - If `task_type !== "form-completion"`, existing normalization rules apply.
   - If `config.form` is a valid `FormDocument`, preserve it.
   - If `config.form_template_id` is a positive integer, fetch the template with
     `getFormTemplateForAssociation(client, context.corporation.id, id)`.
   - If not found, return 404 or 400 with a clear message.
   - Convert with `formTemplateToDocument`.
   - Persist only `{ form }`.

5. Update publish validation.

   `validatePublishableDDQPack` should reject form-completion items without a
   valid copied form document.

6. Consider loosening database version checks.

   Existing migration `V11__Create_form_templates.sql` has a hard
   `schema_json->>'version' = '1'` check. Since the project has no production
   data, prefer replacing this in a new migration or rebuilding from an edited
   migration according to the project's current migration workflow.

   Durable target: service-level validation owns schema version support.

### EPIC01 Frontend API Tasks

1. Export form document types.
2. Add type guards or helper functions if needed:

   ```ts
   export function isFormCompletionConfig(
     config: Record<string, unknown>,
   ): config is DDQFormCompletionConfig;
   ```

3. Reuse existing `listAssociationFormTemplates`.

No new frontend API endpoint is required for EPIC01 if the draft save endpoint
accepts `config.form_template_id` as an instruction.

### EPIC01 `apps/core` UI Tasks

File:

```text
apps/core/src/pages/AssociationDDQPackContent.tsx
```

Tasks:

1. Load form templates for editors.

   Load templates when the user can edit DDQ packs. It is acceptable to load
   them lazily when opening a form-completion item form.

2. Extend item form state.

   Add `form_template_id` to the item form state.

3. Add form-completion UI.

   When `form.task_type === "form-completion"` show:

   - template dropdown,
   - clear helper text,
   - loading/error/empty template states.

4. Validate item form.

   `isItemValid` should require:

   - title for every item,
   - document type for document-upload,
   - template selection or existing copied form for form-completion.

5. Convert form to draft item.

   For a new form-completion task:

   ```ts
   config: { form_template_id: Number(form.form_template_id) }
   ```

   For editing an existing form-completion task without changing template:

   ```ts
   config: existing.config
   ```

   If a future UI lets the user replace the form, send the new
   `form_template_id`.

6. Display copied form details.

   In the details column:

   - document-upload: existing document type display,
   - form-completion: copied form title from `config.form.definition.title`,
   - photo-upload: `-`.

7. Dirty comparison.

   Include `form_template_id` and copied form config in `comparableForm` and
   draft comparison rules carefully so existing copied forms do not look dirty
   just because their template ID is not known.

### EPIC01 Suggested Tests And Verification

Backend:

```text
pnpm -C services/onboarding-service type-check
```

Frontend:

```text
pnpm -C packages/frontend/api type-check
pnpm -C apps/core type-check
```

Manual verification:

- Create a form template with at least one required field.
- Open `/core/association/ddq-packs/10`.
- Add a form-completion task.
- Confirm the UI requires a template.
- Save the pack.
- Inspect the item response or database and confirm `config.form` exists.
- Delete the template.
- Reload the pack and confirm the task still displays the copied form title.
- Publish validation rejects any malformed form-completion item.

## EPIC02: Provider Form Completion

### Goal

Allow Provider users to complete form-completion checklist tasks over multiple
visits, saving partial responses and marking tasks complete only when all
mandatory fields are valid.

### EPIC02 Acceptance Criteria

- A Provider can open a form-completion task from the checklist.
- The task page renders fields from the copied DDQ pack item form document.
- The Provider can save a partial response.
- Reloading the page shows the saved partial response.
- Required field validation is shown clearly.
- The task cannot be marked complete until all mandatory fields are valid.
- Completing the form saves the latest values, sets `completed_at`, marks the
  checklist task `completed`, and recomputes checklist status.
- Review-only users can view form responses but cannot edit or save.
- A withdrawn checklist blocks form response mutation.
- Type checks pass for changed packages.

### EPIC02 Database Tasks

Add migration after the current checklist/evidence migrations:

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

CREATE INDEX IF NOT EXISTS idx_provider_ddq_checklist_task_form_response_task
    ON provider_ddq_checklist_task_form_response(checklist_task_id);
```

Repository file:

```text
services/onboarding-service/src/database/ddqChecklistFormResponseRepository.ts
```

Repository operations:

```ts
export async function readChecklistTaskFormResponse(client, checklistTaskId);
export async function upsertChecklistTaskFormResponse(client, input);
export async function markChecklistTaskFormResponseCompleted(client, checklistTaskId);
```

### EPIC02 Backend Types

In `services/onboarding-service/src/database/onboardingTypes.ts`:

```ts
export type ProviderDDQChecklistTaskFormResponseRow = {
  id: number;
  checklist_task_id: number;
  form_document: FormDocument;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};
```

In `packages/frontend/api/src/onboarding/types.ts`:

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
```

Extend task detail response:

```ts
export type ProviderDDQChecklistTaskDetailResponse = {
  pack: DDQPack;
  checklist: ProviderDDQChecklist;
  task: ProviderDDQChecklistTask;
  evidence: ProviderDDQChecklistTaskEvidence | null;
  formResponse: ProviderDDQChecklistTaskFormResponse | null;
};
```

`evidence` remains for upload tasks. `formResponse` is for form-completion
tasks.

### EPIC02 Backend API Tasks

Add endpoints:

```text
PUT  /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId/form-response
POST /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId/form-response/complete
```

Request:

```ts
export type SaveChecklistTaskFormResponsePayload = {
  values: FormValues;
};
```

Controller tasks:

- Parse `packId` and `taskId`.
- Validate body with zod.
- Require Provider context.
- Call service functions.

Service functions:

```ts
export async function saveProviderDDQChecklistTaskFormResponse(
  context: CurrentUserContext,
  packId: number,
  taskId: number,
  input: { values: FormValues },
);

export async function completeProviderDDQChecklistTaskFormResponse(
  context: CurrentUserContext,
  packId: number,
  taskId: number,
  input: { values: FormValues },
);
```

Save behavior:

1. Require `provider-ddq-packs:perform-checks`.
2. Resolve task with existing `readProviderDDQChecklistTaskContext`.
3. Ensure task belongs to current Provider corporation and pack.
4. Reject if checklist is withdrawn.
5. Reject unless `task.task_type === "form-completion"`.
6. Normalize `task.config.form`.
7. Merge submitted values into a response `FormDocument`.
8. Validate field value types/options/date formats.
9. Upsert response.
10. Return updated task detail.

Complete behavior:

1. Run save behavior in the same transaction.
2. Validate required fields.
3. If incomplete, return 400 with validation errors.
4. Mark response completed.
5. Transition task to `completed`.
6. Recompute checklist completion status.
7. Return updated task detail.

Read behavior:

- Extend existing `getProviderDDQChecklistTask` so form-completion tasks include
  `formResponse`.
- If no response exists, return `formResponse: null`; frontend initializes from
  `task.config.form`.

### EPIC02 Frontend API Tasks

In `packages/frontend/api/src/onboarding/client.ts` add:

```ts
export type SaveChecklistTaskFormResponsePayload = {
  values: FormValues;
};

export const saveProviderDDQChecklistTaskFormResponse = async (
  packId: number,
  taskId: number,
  payload: SaveChecklistTaskFormResponsePayload,
) => { ... };

export const completeProviderDDQChecklistTaskFormResponse = async (
  packId: number,
  taskId: number,
  payload: SaveChecklistTaskFormResponsePayload,
) => { ... };
```

### EPIC02 `apps/core` UI Tasks

File:

```text
apps/core/src/pages/ProviderDDQChecklistTask.tsx
```

Tasks:

1. Branch by task type.

   Existing upload UI should remain for document/photo upload tasks. Add a
   form-completion branch:

   ```ts
   if (task.task_type === "form-completion") {
     return <FormCompletionWorkspace ... />;
   }
   ```

2. Build `FormCompletionWorkspace`.

   Inputs:

   - `task.config.form`,
   - optional `state.formResponse.form_document`,
   - checklist/task status,
   - permissions.

   State:

   ```ts
   type FormDraftState = {
     values: FormValues;
     errors: Record<string, string>;
     dirty: boolean;
   };
   ```

3. Render field controls.

   Use existing shared UI primitives:

   - text/date/phone: `Input`,
   - textarea: `Textarea`,
   - select/radio: existing select/radio pattern,
   - boolean: checkbox or yes/no select.

4. Save partial response.

   Add `Save progress` action. It is enabled when dirty and user can perform
   checks.

5. Complete response.

   Add `Mark complete` action. It validates locally first, then calls the
   complete endpoint.

6. Preserve navigation guard.

   Dirty form responses should guard breadcrumbs/navigation similarly to upload
   tasks.

7. Read-only mode.

   Users with review/approve permissions can view saved or blank form data but
   controls are disabled and no save/complete actions are shown.

8. Checklist page task actions.

   In `apps/core/src/pages/ProviderDDQChecklist.tsx`, active form-completion
   tasks should open the task detail route. The row action label/title should
   be `Complete form` or `Review form` depending on status/permission.

### EPIC02 Validation Rules

Client-side validation is for usability. Server-side validation is
authoritative.

Required field completion:

```ts
function hasRequiredValue(item: FormItem, value: FormValue | undefined) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  return false;
}
```

Type rules:

- `boolean` requires boolean when present.
- `date` requires `YYYY-MM-DD` when present and non-empty.
- `select` and `radio` require one configured option when present and non-empty.
- String field values should be trimmed before persistence unless product needs
  exact whitespace preservation.

### EPIC02 Suggested Tests And Verification

Backend:

```text
pnpm -C services/onboarding-service type-check
```

Frontend:

```text
pnpm -C packages/frontend/api type-check
pnpm -C apps/core type-check
```

Manual verification:

- Association creates a template with two required fields and one optional
  field.
- Association adds it to a DDQ pack as a form-completion task.
- Provider adds the DDQ pack to its pool and creates a checklist.
- Provider opens the form task.
- Provider enters one required value and saves progress.
- Provider leaves and returns; the partial value is still present.
- Provider attempts completion with missing required data; completion is
  blocked.
- Provider fills all required data and completes.
- Checklist task changes to `completed`.
- If all tasks are complete, checklist changes to `completed`.
- Review-only Provider user can view the form response and cannot edit it.

## Implementation Order

Recommended sequence:

1. Add shared form document types and backend validation helpers.
2. Implement EPIC01 backend normalization and template copy.
3. Implement EPIC01 Association pack editor UI.
4. Verify template deletion does not affect copied pack item forms.
5. Add EPIC02 database table and repository.
6. Add EPIC02 backend save/complete endpoints.
7. Extend Provider task detail response with `formResponse`.
8. Implement Provider form workspace UI.
9. Wire checklist row action labels for form tasks.
10. Run type checks and complete manual end-to-end verification.

## Files Most Likely To Change

Backend:

```text
services/onboarding-service/database/sql/V14__Create_checklist_task_form_responses.sql
services/onboarding-service/src/controllers/associationController.ts
services/onboarding-service/src/controllers/providerController.ts
services/onboarding-service/src/database/ddqChecklistFormResponseRepository.ts
services/onboarding-service/src/database/formTemplateRepository.ts
services/onboarding-service/src/database/onboardingTypes.ts
services/onboarding-service/src/routes/onboardingRoutes.ts
services/onboarding-service/src/services/formDocuments.ts
services/onboarding-service/src/services/onboardingService.ts
```

Frontend shared:

```text
packages/frontend/api/src/onboarding/types.ts
packages/frontend/api/src/onboarding/client.ts
```

Frontend apps:

```text
apps/core/src/pages/AssociationDDQPackContent.tsx
apps/core/src/pages/ProviderDDQChecklist.tsx
apps/core/src/pages/ProviderDDQChecklistTaskPage.tsx
apps/form-design/src/FormDesignRouteContent.tsx
```

`apps/form-design` should need little or no work for these epics unless the
form template schema changes.
