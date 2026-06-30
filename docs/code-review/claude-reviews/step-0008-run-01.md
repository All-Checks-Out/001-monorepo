# Claude Review: Step 0008, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-29T20:28:48.240Z
- Command: `pnpm run claude:review -- 0008`

## Review Step

### 0008 Association DDQ Frontend

Purpose: review association-facing DDQ pack management and task authoring behaviour.

Files:

- `apps/core/src/pages/AssociationDDQPacks.tsx`
- `apps/core/src/pages/AssociationDDQPackContent.tsx`
- `apps/core/src/pages/AssociationSystemData.tsx`
- `apps/core/src/pages/ProviderPacksTable.tsx`
- `apps/core/src/pages/TasksTable.tsx`
- `apps/core/src/pages/InsertionRow.tsx`
- `apps/core/src/pages/TaskSummary.tsx`
- `apps/core/src/utils/ddqPackStatus.ts`

Focus:

- draft/publish/archive behaviour
- task ordering and insertion
- destructive/immediate command clarity
- assignment state assumptions
- data loss and stale update risks

## Review Output

# Review: Step 0008 — Association DDQ Frontend

## Findings

**1. Publish/archive/restore actions fire immediately on confirm with no draft review step — `AssociationDDQPacks.tsx:106-131`**
`changePackStatus` calls `changeDDQPackStatus` directly after a single `window.confirm`. Publishing makes the pack "available immediately" per the confirm text itself, but there is no check that the pack's draft items have actually been saved (`isPackDirty`/`hasActiveEdits` from the edit page is a separate component instance — a user could open the pack, make edits, navigate back without saving, then publish a stale/older server-side draft from the list page). Because `AssociationDDQPacks` and `AssociationDDQPackContent` are different routes/components with independent state, there is no cross-page guard preventing "publish a pack whose draft you just edited but didn't save." Classification: **recommended** — the data-loss risk is real but mitigated by the fact that publish operates on server state, not local draft state, so the actual published content is never wrong, only potentially "stale relative to what the user thinks they changed."

**2. No optimistic-concurrency / stale-overwrite protection on `savePackDraft` — `AssociationDDQPackContent.tsx:171-185`**
`savePackDraft` always calls `saveDDQPackDraft(numericPackId, draftToPayload(draft))`, fully overwriting server state with the local draft. If two association staff edit the same pack concurrently (or one user has two tabs open), the second save silently clobbers the first with no version check or warning. There's no `updated_at`/version field threaded through `DDQPackPayload`/`SaveDDQPackDraftPayload` to detect this. Classification: **recommended** — plausible multi-editor scenario for association staff, silent data loss with no error surfaced.

**3. `beforeunload` guard does not cover in-app navigation away via breadcrumb/router — `AssociationDDQPackContent.tsx:264-275` vs `leavePage` `:251-259`**
The `beforeunload` listener only protects against external tab close/refresh. In-app navigation through `leavePage` (the "DDQ Packs" breadcrumb) correctly confirms via `window.confirm`. However, other in-app exits — e.g. clicking the shell's sidebar to navigate to a different app/page, or browser back/forward — are not intercepted, since React Router navigation doesn't trigger `beforeunload` and there's no `usePrompt`/blocker on the router. A user with unsaved pack or item-form edits can lose work by clicking elsewhere in the app. Classification: **recommended** — this is a real, easily reachable data-loss path (any other nav link in the shell sidebar) beyond what the explicit "Discard unsaved pack changes and leave?" intends to cover.

**4. Form-completion item validity bypasses templates-still-loading state — `AssociationDDQPackContent.tsx:222-232`**
`isItemValid` requires `form.form_template_id || formDocumentTitle(itemBeingEdited?.config)` for form-completion tasks, but does not factor in `formTemplatesLoading`. If templates are still loading when the dropdown is rendered, the "Select form template" placeholder is the only option and `form_template_id` is `""`; `canApplyItemForm` will correctly stay `false` for new items lacking a template id, so this is actually safe in practice — no concrete defect found here on closer trace. Not a finding (see Notes).

**5. `nextNewItemId` counter not reset when reloading from `load()` — `AssociationDDQPackContent.tsx:98, 175-182`**
`nextNewItemId.current` is a `useRef` that increments only on `formToDraftItem` calls and is never reset on `load()`/`savePackDraft()`. This is harmless (client-side-only id used to key new draft rows before persistence) but worth noting: after a save, newly-saved items get `persisted-${id}` clientIds while `nextNewItemId` keeps climbing — no bug, just a minor "doesn't reset" observation. Classification: **probably not worth fixing**.

**6. Status badge filter values use capitalized strings while internal code paths use lowercase — `AssociationDDQPacks.tsx:213-225` vs `ddqPackStatus.ts:13-15`**
The `DataTable` filter options use `"Published" | "Draft" | "Archived"` (capitalized, matching `displayPackStatus()` output used as the `status` accessor for filtering), while `pack.status` itself (raw data) is lowercase (`"draft" | "published" | "archived"` per `ddqPackStatus.ts`). This works correctly today only because the `status` column's `accessorFn: displayPackStatus` transforms the value before the filter compares against it — but it's an implicit coupling: if a developer changes the `status` column to read `row.original.status` directly (a very natural-looking refactor) the filter silently breaks (matches nothing). Classification: **optional** — works today, but fragile/non-obvious coupling between display-formatting and filter-value definitions worth a comment or shared constant.

**7. `removeItem` deletes from local draft with only a `window.confirm`, no distinction between unsaved-add and persisted-item removal — `AssociationDDQPackContent.tsx:195-207`**
Removing a freshly-added (unsaved) item and removing a previously-published, already-completed-by-provider task use the same generic confirm text ("Remove {title} from this draft?"). If a task already has provider progress against it (e.g., a provider has uploaded evidence for a `document-upload` task in a checklist generated from a now-edited pack), there is no warning here about downstream checklist impact — though that may be intentionally out of scope for the pack draft editor itself, since checklists are presumably snapshotted at generation time (per the focus note "assignment state assumptions"). Flagging as **optional**: confirm whether removing/editing an item on a *previously published* pack draft can affect already-issued provider checklists; if checklists copy item config at generation time (consistent with the explicit copy-semantics text for form-completion tasks), this is not a real risk, but the UI gives no indication either way to the association user, which could cause hesitation/confusion rather than a defect.

**8. Inconsistent confirm-dialog UX: native `window.confirm` for destructive pack-status changes and item removal — `AssociationDDQPackContent.tsx:200`, `AssociationDDQPacks.tsx:113-118`**
Both destructive flows use raw browser `window.confirm` rather than a styled `Dialog` (the codebase already has `Dialog` primitives in use, e.g. `AssociationSystemData.tsx`). This is consistent within this file-set but is a UX inconsistency against the rest of the app's shadcn-based design system for destructive actions. Classification: **optional**.

## Notes (confirmed-good / intentional, not findings)

- Draft/publish/archive/restore state machine in `ddqPackStatus.ts` is a clean, total function over the three pack statuses with no missing transition.
- `AssociationDDQPackContent` correctly clones state (`cloneDraftState`) to avoid baseline/draft aliasing, and uses `comparableDraft`/`comparableForm` JSON-based dirty-checking, which is a reasonable lightweight approach at this scale.
- Form-completion task config explicitly documents copy-on-select semantics in the UI ("definition will be copied... later template edits or deletion will not affect this task"), which is a good, explicit design choice avoiding hidden coupling to form-design's templates.
- `readOnly` mode correctly disables all mutation paths (item add/edit/delete, pack field edits) and the "view item" flow reuses the same form rendering in a disabled state — reasonable code reuse without over-abstracting.
- Permission gating (`canEditDDQPacks`) is checked both for UI visibility and combined with `readOnly` deriving from URL `mode=read-only` param — consistent with the rest of the app's permission-gating pattern reviewed in step 0007.
- `InsertionRow` is an appropriately small, focused, reused component (used at every gap and the top of the list) — correctly extracted per the component-boundary guidance.

## Test Gaps

- No tests are present in this file set for: pack create/draft validity (`isCreateValid`), status-transition gating (`statusActionForPack`), item add/edit/remove draft mutation logic (`formToDraftItem`, `applyItemForm`), or dirty-state detection (`comparableDraft`/`comparableForm`). These are pure-enough functions (especially in `ddqPackStatus.ts` and the draft-transform helpers in `AssociationDDQPackContent.tsx`) that would benefit from unit tests given how central they are to data-loss prevention claims made by this review (Findings 1–3).

## Review Limitations

- `DDQPackPayload`, `SaveDDQPackDraftPayload`, and other `@frontend/api/onboarding/types`/`client` definitions were not included in the provided excerpts, so exact request/response shapes (e.g., whether a version/`updated_at` field exists for concurrency checks) could not be directly confirmed; Finding 2 is based on the absence of any such field being referenced in the reviewed component code.
- Checklist generation/snapshot behavior referenced in Finding 7 is inferred from the form-completion copy-semantics text in this file; the actual checklist generation code (`ddqChecklistRepository.ts`, step 0018/0019 scope) was not part of this bounded review.

