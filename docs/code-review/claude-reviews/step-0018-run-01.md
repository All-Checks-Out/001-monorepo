# Claude Review: Step 0018, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T05:25:09.917Z
- Command: `pnpm run claude:review -- 0018`

## Review Step

### 0018 DDQ Pack Backend

Purpose: review association DDQ pack persistence, task semantics, assignment, and checklist generation.

Files:

- `services/onboarding-service/src/database/ddqPackRepository.ts`
- `services/onboarding-service/src/database/ddqChecklistRepository.ts`
- `services/onboarding-service/src/controllers/associationController.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`
- `docs/dev-plans-and-handovers/ddq-pack-form-completion-development-plan.md`
- `docs/dev-plans-and-handovers/provider-ddq-packs-tab-implementation-brief.md`

Focus:

- DDQ pack draft/publish/archive semantics
- task ordering and item constraints
- checklist generation correctness
- association/provider boundary checks
- form-completion task configuration

## Review Output

# Review 0018: DDQ Pack Backend

## Findings

### 1. `replaceDDQPackItemsForAssociation` does not validate that a published pack's items still satisfy publish constraints — silent draft-edit hole on already-published packs
`services/onboarding-service/src/database/ddqPackRepository.ts` (function `replaceDDQPackItemsForAssociation`) is called from `saveAssociationDDQPackDraft` in `onboardingService.ts` with no check on `pack.status`. The draft-save endpoint (`PUT /association/ddq-packs/:packId/draft`) lets an Association user delete and re-insert all items for a pack **regardless of its current status** — including a `published` pack. This means a pack that's already live and assigned to providers can have its tasks silently swapped out from under in-progress provider checklists, bypassing the "draft/publish/archive" lifecycle the rest of the code enforces (e.g. `transitionDDQPackStatus`, `validatePublishableDDQPack`).

A provider with an in-progress checklist referencing `ddq_pack_item_id` values would have those items deleted (`DELETE FROM ddq_pack_item WHERE pack_id = $1`), and `provider_ddq_checklist_task.ddq_pack_item_id` has presumably a FK — if `ON DELETE CASCADE`, providers silently lose in-progress checklist tasks; if no cascade, the delete would fail with an FK violation only when a checklist already exists, producing a confusing 500 instead of a clear validation error.

**Classification: blocking** — this is a data-integrity/product-safety gap: published packs should not be silently rewritten while providers are using them.

### 2. `createDDQPackItemForAssociation` / `updateDDQPackItemForAssociation` / `deleteDDQPackItemForAssociation` allow mutating items on a `published` pack
Same root issue as #1 but via the single-item CRUD endpoints (`POST/PATCH/DELETE /association/ddq-packs/:packId/items...`). None of `createAssociationDDQPackItem`, `updateAssociationDDQPackItem`, or `deleteAssociationDDQPackItem` in `onboardingService.ts` check `pack.status` before mutating. Only `changeAssociationDDQPackStatus`'s publish transition validates content; nothing prevents editing content **after** publish. Given `docs/dev-plans-and-handovers/ddq-pack-form-completion-development-plan.md` describes packs explicitly as draft/published/archived with provider checklists generated from published packs, this looks like a genuine gap rather than an intentional design choice.

**Classification: blocking** (same risk surface as #1, distinct call paths)

### 3. `deleteAssociationDDQPack` allows deleting a pack that providers have already added to their pool / generated checklists from
`deleteDDQPackForAssociation` (`ddqPackRepository.ts`) runs an unconditional `DELETE FROM ddq_pack WHERE association_corporation_id = $1 AND id = $2` with no check for existing `provider_ddq_pack` rows. `deleteAssociationDDQPack` in `onboardingService.ts` likewise has no such guard. If `provider_ddq_pack.ddq_pack_id` has `ON DELETE CASCADE` to `ddq_pack`, this would cascade-delete every provider's checklist for that pack — a serious, silent data-loss path for providers actively working through their DDQ. If there's no cascade, this delete would instead throw an FK error surfaced as a generic 500.

**Classification: blocking** — destructive operation with no application-level safeguard once a pack has live providers attached.

### 4. `saveAssociationDDQPackDraft` is not actually scoped to draft packs despite the function name
The function name `saveAssociationDDQPackDraft` and the route path `.../draft` imply this only operates on pack drafts, but there's no status check anywhere in the call chain (`onboardingService.ts`, `ddqPackRepository.ts`). Combined with finding #1, this is a naming/intent mismatch: the code allows full item replacement on a pack of any status. Either the name is misleading (it's really "replace all metadata+items" regardless of status), or the missing status guard is the actual bug. Worth resolving alongside #1 since the fix is likely the same guard.

**Classification: recommended** (closely tied to #1; listed separately because it's also a naming/clarity issue worth discussing on its own)

### 5. `addProviderDDQPack` re-fetches the pack with `getDDQPack` (no association scoping) — fine, but the "not draft" check duplicates an inconsistent rule across two call sites
In `onboardingService.ts`, `addProviderDDQPack` checks `if (!pack || pack.status === "draft")`, and `listAvailableProviderDDQPacks` (repository) filters `WHERE ddq_pack.status <> 'draft'`. Both correctly exclude `draft`, including `archived` packs as addable, matching the implementation brief ("non-draft packs ... published and archived"). This is **not a bug** — noting only because at a glance the asymmetric check (`pack.status === "draft"` vs `<> 'draft'`) could look suspicious; confirmed consistent. (Moved to notes — see Notes section, not a finding.)

### 6. `getProviderDDQPackItems` allows reading items of an `archived` pack but not validating provider has actually added it
`getProviderDDQPackItems(_context, packId)` in `onboardingService.ts` only checks `!pack || pack.status === "draft"` — it does **not** verify the requesting provider corporation has this pack in its pool (`provider_ddq_pack`). This means any authenticated provider user can read the item/task list of **any** published or archived pack belonging to **any** association, not just packs they've added. This contradicts the implementation brief's framing that the items endpoint is for browsing a provider's selectable/added packs, and is a tenant-boundary leak (cross-provider, though not cross-association-secret since packs are visible association-wide already via the "available" list). Since `listAvailableProviderDDQPacks` already exposes all non-draft packs to any provider for browsing purposes, this is low severity, but the controller comment/route naming (`/provider/ddq-packs/:packId/items`) implies it's scoped to "their" pack tree, when actually it's "any visible pack" — same exposure as the available-packs listing, so not a new leak, just worth flagging as not enforcing pool membership.

**Classification: optional** — current product behavior (browse any non-draft pack's items before adding) is arguably intended per the brief ("packs that are not already in the provider corporation's saved list"), so this is likely correct, but the lack of an explicit "previewing, not pool-scoped" justification next to the function makes the intent non-obvious for a future reader.

### 7. `updateDDQPackMetadataForAssociation` allows renaming/redating a `published` or `archived` pack with no status guard
`updateAssociationDDQPackController` → `updateAssociationDDQPack` (service) → `updateDDQPackMetadataForAssociation` (repository) has no status check either. An association user can change `name`, `valid_from`, `valid_to` on an already-published or archived pack at any time via `PATCH /association/ddq-packs/:id`. Since `valid_from`/`valid_to` drive the provider-facing "currently valid" filter (per `provider-ddq-packs-tab-implementation-brief.md`), retroactively changing these on a published pack changes provider-visible validity windows without any versioning or audit trail. This may be intentional (e.g. fixing a typo in dates), but given the lifecycle is explicitly draft → published → archived, allowing metadata mutation post-publish without restriction is inconsistent with treating `published` as a stable, providers-rely-on-it state.

**Classification: recommended**

### 8. `transitionDDQChecklistStatus`'s `reopen`/`restore` actions are missing a documented permission distinction between provider self-service "reopen" and irreversible workflow states
Not a defect by itself, but worth flagging: `changeProviderDDQChecklistStatus` and `changeProviderDDQChecklistTaskStatus` both gate solely on `ddq-packs:perform-checks`. There is no separate, stronger permission for `withdraw`/`restore` of an entire checklist vs. completing individual tasks — any user who can perform a single check can also withdraw the whole checklist or force-restore it. Given `docs/specs/user-permissions-spec.md` is out of scope for this step, this is just flagged for awareness, not a finding requiring code change here.

(Not listed as a numbered finding — moved to notes since it's a permission-granularity question outside this step's file set and likely belongs in the 0012 Permission Model review.)

### 9. `changeProviderDDQChecklistTaskStatus`'s `restore` action has no defined transition in `ddqChecklistTransitions`
Looking at the transition table:
```ts
const ddqChecklistTransitions: Record<DDQChecklistStatus, Partial<Record<DDQChecklistStatusAction, DDQChecklistStatus>>> = {
  active: { complete: "completed", withdraw: "withdrawn" },
  completed: { reopen: "active" },
  withdrawn: { restore: "active" },
};
```
This table is shared between **checklist-level** and **task-level** status transitions (`transitionDDQChecklistStatus` is called for both in `changeProviderDDQChecklistStatus` and `changeProviderDDQChecklistTaskStatus`). That's fine since both use the same `DDQChecklistStatus` enum (`active`/`completed`/`withdrawn`) for both checklist and task rows. No bug found here — confirmed correct on closer read. (Not a finding — moved to notes.)

### 10. Form-completion task `complete` action in `changeProviderDDQChecklistTaskStatus` re-validates completion (good), but `reopen` of a form-completion task does not clear `completed_at` on the stored form response
When a task is `reopen`ed via `changeProviderDDQChecklistTaskStatus` (action `"reopen"`, from `completed` → `active`), the task status flips back to `active`, but the associated `provider_ddq_checklist_task_form_response.completed_at` is never cleared (no call to any "uncomplete" repository function — only `upsertChecklistTaskFormResponse` with `completedAt: complete ? new Date() : null` is invoked from the save/complete service functions, not from the generic task-status-change path). This means after reopening a form-completion task, `formResponse.completed_at` remains set and `toFormResponseData`'s `validation.complete` will still independently compute `true`/`false` based on field values (not `completed_at`), so the **UI-facing `complete` flag is recomputed correctly** — but the stale `completed_at` timestamp itself stays non-null even though the task is back to `active`, which is misleading if anything reads `completed_at` directly as "this response was submitted as final" (e.g., for audit purposes, or to disambiguate "still editing" vs "was once completed but reopened").

**Classification: optional** — cosmetic/audit-trail inconsistency, not a functional bug since downstream completion checks recompute live from field validation rather than trusting the stored `completed_at`.

### 11. `createDDQPackItemForAssociation`'s position-shift logic has a TOCTOU race under concurrent inserts
`getInsertPosition` + `shiftItemPositions` + `INSERT` in `ddqPackRepository.ts` run as three separate, unguarded statements with no transaction wrapping at the repository level and no `SELECT ... FOR UPDATE`. The service layer (`createAssociationDDQPackItem` in `onboardingService.ts`) does wrap the call in `BEGIN`/`COMMIT`, which mitigates partial-failure rollback, but does **not** protect against two concurrent requests both reading the same `insertPosition`, both shifting, and ending up with duplicate `position` values or a gap, since Postgres's default `READ COMMITTED` isolation does not prevent this read-then-write race between two concurrent transactions. Given this is a low-traffic, single-association-editor workflow (one Association user editing one pack's items at a time in practice), the practical risk is low.

**Classification: probably not worth fixing** — theoretical race in a workflow that's realistically single-editor; flagging only for completeness.

## Notes (confirmed-good / intentional / explanatory)

- `addProviderDDQPack` and `listAvailableProviderDDQPacks` consistently and correctly exclude `draft` packs from provider visibility (`status === "draft"` vs `status <> 'draft'` checks line up).
- `provider_ddq_pack` uses `ON CONFLICT (provider_corporation_id, ddq_pack_id) DO NOTHING` plus a `RETURNING id` check in `addProviderDDQPack`, correctly turning duplicate-add attempts into a clean 400 rather than a constraint-violation 500.
- `createProviderDDQChecklist` (repository) uses `ON CONFLICT (provider_ddq_pack_id) DO UPDATE SET provider_ddq_pack_id = EXCLUDED.provider_ddq_pack_id` as an idempotent upsert-or-fetch pattern — a reasonable way to make checklist creation safely re-callable.
- `createMissingProviderDDQChecklistTasks` uses `ON CONFLICT (checklist_id, ddq_pack_item_id) DO NOTHING`, so re-running checklist creation after new pack items are added (not applicable post-publish per finding #1/#2, but defensively correct) won't duplicate tasks.
- `validatePublishableDDQPack` correctly re-validates every item via `validateDDQPackItemInput` before allowing `draft → published`, including requiring `form-completion` items to carry a `config.form` (good — closes a gap the dev plan called out as a known gap at the time it was written; this appears to have been implemented since).
- The `form-completion` task-type's server-side copy-on-publish/save semantics (`normalizeDDQPackItemInput`, `formTemplateToDocument`) correctly snapshot the form template at the time of the draft save rather than storing a live `form_template_id` reference, matching EPIC01's acceptance criteria in the dev plan ("editing the template later does not change the pack item").
- All Association DDQ pack/item endpoints correctly scope queries by `association_corporation_id`, preventing cross-association tampering (`getDDQPackForAssociation`, `updateDDQPackMetadataForAssociation`, etc. all parameterize on it).
- Permission checks in `associationController.ts` are consistently applied per-endpoint (`ddq-packs:read` vs `ddq-packs:edit`), and `requirePermission`/`requireAnyPermission` in the service layer correctly gate provider-side checklist mutation behind `ddq-packs:perform-checks`.
- Checklist status auto-recompute (`applyAutomaticChecklistStatus`) is invoked consistently after every task-status-affecting operation (manual status change, evidence upload completion, form completion), which avoids the checklist getting stuck in a stale aggregate state.
- Date validation (`isValidISODate`, `validDateRange` check `valid_to >= valid_from`) is applied consistently on both create and update of pack metadata.

## Test Gaps

- No automated test coverage is visible in the provided source for the DDQ pack draft/publish/archive lifecycle, the position-shift insert logic, or the provider-pool/checklist-generation flow. Given findings #1–#3 describe missing status guards around mutation of published packs, a regression test asserting "editing or deleting a published pack's items/pack record is rejected once a provider has added it" would have caught this before it shipped.
- No test coverage visible for `replaceDDQPackItemsForAssociation`'s full-replace-on-draft-save behavior interacting with an already-existing `provider_ddq_checklist_task` referencing a deleted `ddq_pack_item_id`.

## Review Limitations

- The actual SQL schema/migration defining `ddq_pack_item`, `provider_ddq_pack`, and `provider_ddq_checklist_task` foreign-key `ON DELETE` behavior was not included in the provided source excerpts, so findings #1 and #3 describe the risk in terms of "if cascade, X; if not, Y" rather than confirming the exact failure mode. This should be checked against the actual migration files before treating the precise failure mode as settled, though the underlying defect (missing application-level status guard) holds either way.
- `services/onboarding-service/src/services/permissions.ts` and `services/onboarding-service/src/database/onboardingTypes.ts` were referenced but not included in this step's excerpts, so permission-vocabulary and row-type details (e.g. exact `DDQChecklistStatus`/`DDQPackStatus` enum members) are taken on trust from usage in the included files.
- `docs/specs/form-designer-spec.md` (referenced by the dev plan) was not included in this step's excerpts, so the form-completion validation rules in `onboardingService.ts` could not be cross-checked against the canonical spec.

