# Claude Review: Step 0005, Run 02

- Current git branch: `main`
- Reviewed at: 2026-06-30T06:17:07.251Z
- Command: `pnpm run claude:review -- 0005`

## Review Step

### 0005 Frontend Product Workflows And API Contract

Purpose: review the user-facing frontend workflows and their shared API contract end to end.

Runner note: this is a larger review step. Use at least `CLAUDE_REVIEW_TIMEOUT_MS=600000` when running this step, and raise `CLAUDE_REVIEW_MAX_SOURCE_BYTES` if Claude reports that relevant source was truncated.

Files:

- `packages/frontend/api/`
- `services/onboarding-service/src/controllers/http.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`
- `services/onboarding-service/src/database/onboardingTypes.ts`
- `apps/core/src/pages/`
- `apps/core/src/tables/`
- `apps/core/src/utils/`
- `apps/form-design/src/pages/`
- `apps/form-design/src/components/`
- `docs/specs/user-permissions-spec.md`
- `docs/specs/file-upload-evidence-spec.md`
- `docs/specs/auto-tagging-spec.md`
- `docs/specs/form-designer-spec.md`

Focus:

- public setup, callback, profile, and registration-facing flows
- users, provider directory, setup requests, and access requests
- association DDQ pack authoring and publishing
- provider checklist, evidence, tagging, and form-completion workflows
- form-designer draft/edit/publish workflows
- frontend/backend DTO drift
- permission-gated UI versus backend enforcement assumptions
- route constants, local navigation, error states, and destructive-action clarity

## Review Output

# Step 0005 Review: Frontend Product Workflows And API Contract

## Findings

### 1. `DDQ_TASK_DEFINITIONS` hardcodes a closed task-type list while `DDQTaskType` is `string` — config UI silently mishandles unknown task types
**Classification: recommended**

`packages/frontend/api/src/onboarding/types.ts` defines `DDQTaskType = string` (open type), but `packages/frontend/api/src/onboarding/client.ts` ships a fixed `DDQ_TASK_DEFINITIONS` array (`document-upload`, `form-completion`, `photo-upload`). `apps/core/src/pages/AssociationDDQPackContent.tsx` uses `getTaskDefinition()` (returns `undefined` for unknown types) and falls back to raw `item.task_type` for the badge label, but `taskTypeOptions`/`addItemOptions` only ever offer the three known types. If the backend ever returns/accepts a task type outside this list (the type system permits it), the pack editor cannot represent or re-save that item correctly — `nextFormForItemType` and `formToConfig` assume the value is one of the three known constants. This is a real type/contract mismatch: the backend type (`DDQTaskType = string` in `onboardingTypes.ts`) implies openness that the frontend does not actually support.

### 2. `ProviderDDQChecklistTaskPage` permission-gates by `canPerformChecklist` only, not task ownership state, when computing `formDirty`/`tagsDirty` against stale `state`
**Classification: optional**

Not a real defect on inspection — kept for completeness then downgraded. Skip; folded into limitations.

### 3. Evidence upload flow allows tags/file selection while `evidence` exists from a previous upload, but `uploadDisabled` doesn't check `tagsDirty` consistency — uploading replaces tags silently
**Classification: optional**
(Downgrading — covered by existing UX `Unsaved evidence` indicator; not pursuing as standalone finding.)

### 4. `apps/core/src/pages/Home.tsx` — root-setup screen renders the failure message in `text-destructive` even though it is a success/info message
**Classification: recommended**

`apps/core/src/pages/Home.tsx`, the `rootSetupMessage` (success path, e.g. `"An invitation email has been sent to..."`) is styled with `text-sm font-medium text-destructive` (line ~109-113), while `rootSetupError` (genuine errors) uses the same destructive style just below it. A successful "please check your invitation email" confirmation rendered as a destructive/error-red message is confusing UX and inconsistent with the `Status` component pattern used everywhere else in this codebase (`apps/core/src/components/Status.tsx`, used via `<Status message=... error=... />` in nearly every other page) which differentiates success (muted/emerald) from error (destructive) styling. This page reimplements its own inline status text instead of reusing `Status`, and gets the color wrong for the success case.

### 5. `AssociationDDQPackContent.tsx`: `formToConfig` silently drops a previously-copied form document when switching to a different `form_template_id`
**Classification: probably not worth fixing**

When editing a `form-completion` item and a `form_template_id` is selected, `formToConfig` returns `{ form_template_id }`, discarding the prior `existing.config.form` copy. This matches the documented spec behavior (backend re-copies on save), but means a user who selects a template, then changes their mind back to "Keep copied form," after already picking a new template id once, has no way to revert without reloading — the UI option `value=""` is only available before a new template id is chosen, and once chosen there's no "revert to existing copy" affordance in the dropdown. Minor UX gap, not a defect against current architecture.

### 6. `apps/core/src/pages/AssociationDDQPackContent.tsx` — `isItemValid` does not validate `form_template_id` selection independent of any previously copied form, allowing "Add Item" with no template selected if `formDocumentTitle` is non-empty from stale state
**Classification: probably not worth fixing**

In the "add" flow (new item), `itemBeingEdited` is `null` (since `mode === "add"` only matches `draft.items[index]` for edit/view), so `formDocumentTitle(itemBeingEdited?.config)` is always `""` for new items — meaning new form-completion items genuinely require `form_template_id` to be valid. This is actually correct behavior on closer reading; not a defect.

### 7. `packages/frontend/api/src/onboarding/client.ts` — `fetchWithAuth` local-dev path silently builds requests with no CSRF/anti-forgery consideration, and trusts a client-supplied `x-local-user-id` header end-to-end
**Classification: probably not worth fixing**

This is an intentional, documented local-dev-only auth shortcut (per architecture docs, local dev path is allowed to differ from deployed Cognito auth) and is out of scope to re-litigate per the review guide ("do not suggest changing product behaviour unless... insecure" — but this is explicitly the existing, accepted local dev pattern). Listed only as a note, not a real finding — moved to limitations/notes.

### 8. `DDQPackItemPayload`/`config: Record<string, unknown>` provides no compile-time safety between `task_type` and the shape of `config` across the whole pack-authoring and checklist-execution flow
**Classification: optional**

`config: Record<string, unknown>` is used uniformly in `DDQPackItem`, `ProviderDDQChecklistTask`, `DDQPackItemPayload` (`packages/frontend/api/src/onboarding/types.ts`) and the matching backend rows (`services/onboarding-service/src/database/onboardingTypes.ts`). All consumers (`AssociationDDQPackContent.tsx`, `ProviderDDQChecklist.tsx`, `ProviderDDQChecklistTaskPage.tsx`, `TaskSummary.tsx`, `TasksTable.tsx`) independently re-implement ad hoc type guards (`documentTypeFromConfig`, `formDocumentTitle`, `isFormDocument`, etc.) to recover structure from `config`. This is duplicated, slightly differing logic in at least 4 files (e.g., `formDocumentTitle` appears near-identically in `AssociationDDQPackContent.tsx`, `ProviderDDQChecklist.tsx`, and `ProviderDDQChecklistTaskPage.tsx` calls a similar but distinctly-named helper). A small shared discriminated-union or shared helper in `@frontend/api` would reduce drift risk, but this is a maintainability improvement, not a defect — and the review guide cautions against introducing shared abstractions without near-term need. Worth a future pass, not blocking.

### 9. `apps/core/src/pages/ProviderDDQChecklistTaskPage.tsx` — duplicate `formDocumentTitle`/`isFormDocument` helper logic diverges slightly from `AssociationDDQPackContent.tsx` and `ProviderDDQChecklist.tsx`/`TaskSummary.tsx`
**Classification: recommended**

There are at least three independent re-implementations of "extract form document title from `config`" logic:
- `AssociationDDQPackContent.tsx`: `formDocumentTitle(config)`
- `ProviderDDQChecklist.tsx`: `formDocumentTitle(config)` (separate local copy, same logic)
- `TaskSummary.tsx`: does **not** implement `formDocumentTitle` — only checks `document_type`, meaning the `TaskSummary` component used at the top of `ProviderDDQChecklistTaskPage.tsx` never displays the form title for a form-completion task review header, while `ProviderDDQChecklist.tsx`'s `displayTaskConfig` does. This is an actual inconsistency: a Provider reviewing a form-completion task from the checklist table (`ProviderDDQChecklist.tsx`) sees the form title in the "Config" column, but the per-task detail page (`TaskSummary.tsx`, rendered at top of `ProviderDDQChecklistTaskPage.tsx`) shows nothing for form-completion tasks (`displayTaskConfig` in `TaskSummary.tsx` returns `""` for anything other than `checkpoint`/`document-upload`). This is a small but real UX gap/inconsistency between two views of the same task.

### 10. `apps/core/src/pages/ProviderDDQChecklistTaskPage.tsx` — file upload validation duplicate of backend constraints with potential drift (`maxEvidenceFileSizeBytes`)
**Classification: optional**

`maxEvidenceFileSizeBytes = 10 * 1024 * 1024` is a frontend-only constant matching the spec's suggested default ("Suggested default: 10 MB"). There's no shared constant with the backend (not in the provided `services/onboarding-service` excerpts for this step, but the `file-upload-evidence-spec.md` says "Suggested default" — implying this is configurable/non-binding). If backend enforcement differs, users could upload a file that passes frontend validation but is rejected server-side, or vice versa producing a confusing failure after the (successful) presigned URL step. This is worth checking against backend code in a future step (0007 covers evidence/upload backend) but not actionable here without that code.

### 11. `AssociationDDQPacks.tsx` create-pack form: no max-length/format validation on `name`, `valid_from`/`valid_to` ordering (`valid_from <= valid_to`) before allowing "Create Pack"
**Classification: recommended**

`isCreateValid` in `apps/core/src/pages/AssociationDDQPacks.tsx` only checks `form.name.trim() && form.valid_from && form.valid_to` — it does not verify `valid_from <= valid_to`. A user can create (and the equivalent draft-save flow in `AssociationDDQPackContent.tsx`'s `isPackValid` has the identical gap) a DDQ Pack with an inverted date range, which is silently accepted by the client and likely also unvalidated server-side based on the `DDQPackPayload` type (plain strings, no documented ordering constraint in the API contract). This is a low-friction, easily-introduced authoring mistake with confusing downstream consequences (`isCurrentlyValid` in `ProviderDDQPacks.tsx` filters `pack.valid_from <= todayKey && pack.valid_to >= todayKey`, so an inverted range would simply make published packs permanently invisible to providers with no error explaining why). Recommend client-side validation at minimum (`valid_from <= valid_to`), ideally confirmed against backend enforcement in step 0007/0006.

### 12. `ProviderDDQChecklistTaskPage.tsx` — `isFormDocument` type guard duplicated from `AssociationDDQPackContent.tsx`'s implicit form-document detection logic, with no shared `@frontend/api` export
**Classification: optional**

Same root cause as finding 8/9 — `isFormDocument` exists only in `ProviderDDQChecklistTaskPage.tsx`; nowhere else validates the structural shape this rigorously. Worth consolidating into `@frontend/api/onboarding/types` (or a small validation helper module) eventually, but no near-term defect.

### 13. `apps/form-design/src/pages/FormTemplateDesigner.tsx` — `createStableItemId()` fallback (`Math.random()`-based) used when `crypto.randomUUID` unavailable could theoretically collide
**Classification: probably not worth fixing**

The fallback ID generator (`item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`) is a reasonable fallback for environments lacking `crypto.randomUUID`; collision risk is negligible in practice for form-builder item IDs created interactively. Not worth flagging further.

### 14. `apps/form-design/src/pages/AssociationFormsPage.tsx` — delete confirmation uses `window.confirm`, consistent with rest of repo, but message text could be misleading about scope
**Classification: probably not worth fixing**

The confirm message ("Existing DDQ pack tasks keep their copied form definitions...") is actually a good, clear, destructive-action message per the UX guide's bar for explicit consequence text. No issue.

## Notes / Confirmed-Good Observations

- The "DDQ pack item owns a copy of the form, not a reference" architecture from `form-designer-spec.md` is consistently respected in the frontend: `AssociationDDQPackContent.tsx` passes `form_template_id` only when newly selected and otherwise preserves `existing.config` form data; the API payload shape (`DDQPackItemPayload`) matches the documented contract.
- Draft-based editing with explicit `Save Pack` / `Discard changes` and `beforeunload` guards in `AssociationDDQPackContent.tsx` and `FormTemplateDesigner.tsx` follows the UX philosophy's "explicit draft/save/discard" guidance well.
- Permission-gated UI (`hasPermission` checks for `ddq-packs:edit`, `forms:edit`, `users:invite`, `user-permissions:change`, etc.) is applied consistently across `AssociationDDQPacks.tsx`, `AssociationFormsPage.tsx`, `UsersPage.tsx`, `FormTemplateDesigner.tsx`, matching `user-permissions-spec.md`'s frontend visibility rules.
- `UsersPage.tsx` correctly disables self-permission-editing (`user.id !== currentUser?.id`) per spec ("must not change their own permissions").
- `client.ts`'s `authJson` clearing stored auth on a 401 response is a sensible, centralized session-expiry handling pattern, applied uniformly across all `auth*` calls.
- Icon-only row actions with `aria-label`/`title` in `ProviderDDQChecklist.tsx` and `ProviderPacksTable.tsx` follow `file-upload-evidence-spec.md`'s explicit UX requirement for icon buttons with accessible labels.
- The breadcrumb dirty-state guarding pattern (disabling navigation when unsaved changes exist, e.g., `ProviderDDQChecklistTaskPage.tsx`, `AssociationDDQPackContent.tsx`) is applied consistently and matches the spec's guidance on guarding navigation during draft edits.
- `getEffectivePermissions`/`hasPermission` wrappers in `apps/core/src/utils/permissions.ts` correctly delegate to `@shared/permissions`, with no local permission-vocabulary drift visible in this excerpt.

## Test Gaps

- No frontend test files were included in the reviewed file set for this step; it's not possible to confirm whether `AssociationDDQPackContent.tsx`'s extensive draft-merging logic (`formToDraftItem`, `formToConfig`, `comparableDraft`) has any unit test coverage. Given its complexity (multiple nested helper functions handling task-type transitions, config preservation, and dirty-state comparison), this is a high-value candidate for targeted unit tests, particularly around the "switch task type" and "preserve copied form on edit" behaviors.
- No visible test coverage for `ProviderDDQChecklistTaskPage.tsx`'s form validation (`validateFormDocumentValues`, `hasFormValue`) or evidence upload file validation (`validateFile`) — these are pure functions well-suited to unit testing and currently appear untested based on provided files.
- No test coverage evident for date-range validation gaps noted in finding 11.

## Review Limitations

- Backend route handlers (`associationController.ts`, `providerController.ts`, `sharedController.ts`, `publicController.ts`, `setupController.ts`) referenced by `onboardingRoutes.ts` were not included in the provided source for this step, so DTO/validation drift between frontend payload shapes and actual backend zod schemas could not be directly verified (e.g., whether `valid_from <= valid_to` is enforced server-side, or whether file size/content-type limits match `maxEvidenceFileSizeBytes`). These are flagged for follow-up in steps 0006/0007 which include the relevant backend files.
- `apps/core/src/components/`, `apps/core/src/context/`, `apps/core/src/CoreRouteContent.tsx`, and `apps/core/src/constants/routes.ts` were not included in this step's excerpts, so route-constant correctness and permission-gating at the route level (vs. component level) could not be fully verified.
- `apps/form-design/src/pages/` excerpts did not include any DDQ-pack-facing or provider-facing pages (none exist in that app per architecture — form-design is template-authoring only), consistent with documented app boundaries.
- The `services/onboarding-service/src/controllers/*.ts` files imported by `onboardingRoutes.ts` were not in scope for this step's excerpts, limiting verification of finding 1 (open vs. closed task-type contract) against actual backend validation (e.g., whether the backend's zod schema for `task_type` restricts to the same three values).

