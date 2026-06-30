# Claude Review: Step 0009, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-29T20:35:34.299Z
- Command: `pnpm run claude:review -- 0009`

## Review Step

### 0009 Provider DDQ, Evidence, And Form Completion Frontend

Purpose: review provider-facing checklist, evidence, document, and form-completion workflows.

Files:

- `apps/core/src/pages/ProviderDDQPacks.tsx`
- `apps/core/src/pages/ProviderDDQChecklist.tsx`
- `apps/core/src/pages/ProviderDDQChecklistTaskPage.tsx`
- `apps/core/src/pages/EvidencePreview.tsx`
- `apps/core/src/pages/EvidenceReview.tsx`
- `apps/core/src/pages/DocumentPanel.tsx`
- `apps/core/src/pages/TagEditor.tsx`
- `apps/core/src/pages/FormCompletionWorkspace.tsx`
- `apps/core/src/pages/FormField.tsx`
- `apps/core/src/pages/FormFieldControl.tsx`
- `apps/core/src/pages/ProgressMeter.tsx`
- `apps/core/src/pages/ReadOnlyNotice.tsx`
- `docs/specs/file-upload-evidence-spec.md`
- `docs/specs/auto-tagging-spec.md`

Focus:

- checklist task state and read-only behaviour
- file/evidence upload UX assumptions
- document preview and tagging flow
- form field validation and persistence
- accidental edits after completion/submission

## Review Output

# Review: Step 0009 — Provider DDQ, Evidence, And Form Completion Frontend

## Findings

### 1. Client-side file validation can be bypassed; no server-side size/type re-check visible from this slice — `blocking` (verify in 0019)
`ProviderDDQChecklistTaskPage.tsx` `validateFile()` (lines ~26–42) checks `file.size`, `file.type`, and task type entirely in the browser. The spec (`file-upload-evidence-spec.md`) explicitly requires the backend to "Store and validate content type and size before creating the upload URL" and reject uploads for checkpoint/form-completion tasks. This file only proves the frontend check exists; it does not prove backend enforcement. Since `file.type` is attacker-controlled (trivially spoofable), and the upload-url request sends `content_type`/`file_size_bytes` as client-supplied fields, if the backend trusts these values without independent validation, a malicious provider user could upload arbitrarily large or mistyped files. This is flagged here because the frontend treats these checks as sufficient gating (disables the Upload button), giving false confidence. Should be confirmed against `services/onboarding-service/src/controllers/providerController.ts` in step 0019, but worth flagging now since the UX text and button-disable logic imply the validation is the safety boundary.

### 2. `uploadDisabled` does not block upload while the checklist/task is no longer active — `recommended`
`ProviderDDQChecklistTaskPage.tsx`: `canMutateEvidence` (and thus `uploadDisabled`) is computed once at render time from `checklist?.status` and `task?.status` captured in `state`. If another reviewer/approver withdraws the checklist or task in another tab/session while this user has a file selected, the local `state` will not reflect that until `load()` re-runs (only on mount/param change). The Upload button could remain enabled (since `canMutateEvidence` reads stale `state`), and the POST would only fail server-side. This isn't a security hole (assuming backend re-checks), but produces a confusing UX failure with a generic error message rather than a clear "checklist was withdrawn" notice. Consider re-fetching state after returning to the tab, or showing a clearer error distinguishing stale-state conflicts.

### 3. Tag editor allows duplicate "Save tags" button to fire concurrent saves if double-clicked rapidly — `optional`
`saveTags()` in `ProviderDDQChecklistTaskPage.tsx` sets `savingTags` to disable the button, but the disabled state update happens after the click handler runs, not synchronously before the async call starts in a way that prevents a fast double-click from firing two requests (the `setSavingTags(true)` is the first line, so this is actually guarded correctly — re-checked, this is fine). No finding here; removing as a non-issue.

### 4. `formDocumentForState` silently falls back to task config form when no saved response exists, but `formDirty` comparison can mask an already-existing identical response — `optional`
`initialFormValues()` merges `state.formResponse?.form_document.values` if present, else falls back to `formDocumentFromTaskConfig(state.task)?.values`. This is intentional and fine. However, `sameFormValues` (line ~125) uses `JSON.stringify` after sorting keys — this works for primitives (string/boolean) per `FormValue`, so no real defect here given the current `FormValue` type is narrow. Not flagging as a defect; noting as confirmed-good in Notes.

### 5. `EvidenceReview` "Open original" link opens the CloudFront/S3 URL directly with `target="_blank"` and no `noopener` risk is already mitigated by `rel="noreferrer"` — confirmed good, not a finding.

### 6. Checklist-level "Complete checklist" button is disabled only via `counts.completed !== counts.total`, but `counts` includes withdrawn tasks as a separate bucket without excluding them from `total` — `recommended`
`countTasks()` in `ProviderDDQChecklist.tsx` (lines ~370–384) computes `total = tasks.length`, and increments `active`/`completed`/`withdrawn` per task. The "Complete checklist" action is disabled unless `counts.completed === counts.total`. This means a checklist containing any withdrawn task can never be completed, since withdrawn tasks are counted in `total` but never in `completed`. If withdrawing a task is meant to remove it from the completion requirement (which seems to be the intent, given withdrawal exists as an escape hatch), this is a logic bug that silently blocks checklist completion forever once any task is withdrawn. Worth confirming intended semantics with Richard — if withdrawn tasks should not block completion, `total` should exclude withdrawn, or completion check should be `active === 0 && total > 0`.

### 7. Document-upload task "Mark task complete" status action is incorrectly available based only on `task_type`, contradicting the spec's stated backend rule — `recommended` (frontend gating only, but worth fixing for consistency)
In `ProviderDDQChecklist.tsx`, `taskStatusActions()` (lines ~330–345) excludes the generic "complete" action only `if (!isUploadTask(task) && task.task_type !== "form-completion")`. This correctly hides direct "Mark complete" for upload and form tasks from the checklist table — good, matches spec intent ("do not let users mark these tasks complete without evidence"). This is actually correctly implemented; re-classify as confirmed-good, not a finding. (Removing from findings — see Notes.)

### 8. `FormFieldControl.tsx` boolean control allows the user to clear a previously-set false value but the `<select>` re-render can lose distinction between "unset" and "false" string comparison edge case — `probably not worth fixing`
`value={typeof value === "boolean" ? String(value) : ""}` — if `value` is `false`, this renders `"false"`, which is correctly selected. No real defect, included only to confirm it was checked.

### 9. `FormCompletionWorkspace` "Mark complete" button has no confirmation, unlike checklist-level "withdraw" actions — `optional`
Other irreversible/important actions in this step (`changeChecklistStatus`, `changeTaskStatus` in `ProviderDDQChecklist.tsx`) use `window.confirm` for `withdraw`. `completeFormResponse()` in `ProviderDDQChecklistTaskPage.tsx` has no confirmation despite being a terminal action that (per `ReadOnlyNotice`) makes the form read-only until reopened. Given the UX philosophy calls for "clear destructive confirmations" for state changes that lock out editing, a lightweight confirm or at least a clearer button label affordance (already present via "Mark complete" wording) is arguably sufficient — flagging as optional only, since this is a completion, not a deletion.

### 10. `ProviderDDQChecklistTaskPage.tsx`: dirty-state guard on breadcrumbs prevents navigation but does not protect the React Router `taskId`/`packId` URL param change or browser back button — `optional`
The breadcrumb "DDQ Packs" / pack-name links are disabled while `isDirty`, which is a good touch matching spec guidance. However, the browser back/forward buttons and any other route entry point (e.g., typing a new URL, or a future link added elsewhere) are not guarded — `isDirty` state is purely visual on these two breadcrumb links. This is a narrow gap; full route-leave guarding (e.g., `usePrompt`/blocker) isn't implemented. Given file upload state is local-only (not auto-saved), losing it via back-button is a minor data-loss risk, not corruption.

### 11. `evidence/upload-url` flow note: `uploadProviderDDQChecklistTaskEvidence` resets `tags` from `result.evidence` after upload but spec says S3 ObjectCreated is the completion signal — confirmed consistent with spec, not a finding.

## Notes (confirmed-good / non-findings)

- Permission gating throughout (`canPerformChecklist`, `canViewChecklist`) is consistently checked both for button visibility and for disabling mutation actions, matching the "frontend hiding is usability only" model — backend enforcement is out of scope for this step.
- Withdraw actions on both checklist and task level correctly use `window.confirm` with task/checklist name interpolated — good correlation with spec's "clear destructive confirmations" guidance.
- Object URL preview handling (`URL.createObjectURL` / `URL.revokeObjectURL` in a `useEffect` cleanup) in `ProviderDDQChecklistTaskPage.tsx` is correctly implemented and matches the spec's explicit guidance.
- `ReadOnlyNotice` cleanly explains why mutation is blocked (permission vs. checklist withdrawn vs. task not active), which is good UX clarity per the design philosophy.
- Row actions in `ProviderDDQChecklist.tsx` are icon-only with `aria-label` and `title`, matching the spec's explicit UI requirement.
- `FormCompletionWorkspace` correctly separates "Save progress" (draft) from "Mark complete" (commit), consistent with the repo's draft/command separation guidance.
- Item 7 above (task-type-based exclusion of generic "complete" action for upload/form tasks) is correctly implemented per spec intent — confirmed good, not a defect.

## Test Gaps

- No frontend tests are included in this step's file set for any of the reviewed components (checklist task state transitions, file validation, tag normalization, form value validation). Given the complexity of dirty-state tracking and status-transition gating logic (especially the `countTasks`/"Complete checklist" logic flagged in Finding 6), unit tests around `countTasks`, `checklistStatusActions`, and `validateFormDocumentValues` would catch regressions cheaply.
- No test coverage evident for the file-type/size validation logic in `validateFile`, which is the only client-side defense most users will encounter before any backend check.

## Review Limitations

- This step does not include `services/onboarding-service/src/controllers/providerController.ts` or the evidence repository, so Finding 1 (server-side validation) could not be directly confirmed and is flagged based on spec text plus the frontend's apparent reliance on client validation; treat it as a flag to verify in step 0019, not a confirmed backend defect.
- `@frontend/api/onboarding/types.ts` and `client.ts` were not included in the provided excerpts, so the exact shape of `uploadProviderDDQChecklistTaskEvidence` and whether it sends `content_type`/`file_size_bytes` to the backend could not be verified directly from source; this is inferred from the spec document only.

