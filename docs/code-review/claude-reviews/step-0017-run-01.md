# Claude Review: Step 0017, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T05:06:52.922Z
- Command: `pnpm run claude:review -- 0017`

## Review Step

### 0017 Form Template Backend

Purpose: review form-template persistence, validation, routes, and lifecycle semantics.

Files:

- `services/onboarding-service/src/database/formTemplateRepository.ts`
- `services/onboarding-service/src/controllers/associationController.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`
- `docs/specs/form-designer-spec.md`

Focus:

- form schema validation
- draft/save/publish semantics
- versioning and compatibility
- association ownership

## Review Output

# Step 0017 Review: Form Template Backend

## Findings

### 1. `formTemplateSchema` in `associationController.ts` silently strips unknown form item properties, diverging from `validateFormItem` in `onboardingService.ts` — recommended

`associationController.ts` defines its own `formTemplateSchema` (a Zod discriminated union) to validate the request body before it ever reaches `onboardingService.ts`. Separately, `onboardingService.ts`'s `validateFormItem` re-validates and re-normalizes the same shape from scratch (trimming, checking `formItemTypes`, filtering empty options, etc.).

These two validators are independent implementations of the same rule. They already disagree in one place: the Zod schema requires `required: z.boolean()` (good — matches `validateFormItem`), but the Zod schema has no `.strict()` on `formItemBaseSchema`/the discriminated union variants, so a client can send extra unknown fields that flow through to `validateFormTemplateInput` → `validateFormItem`, which then drops them when constructing `base`. That part is safe today, but the duplication itself is the risk: the two schemas are already drifting (e.g. Zod's `formTemplateSchema` requires `version: z.literal(1)` while `validateFormTemplateSchema` in the service checks `schema.version !== 1` — consistent now, but nothing enforces they stay consistent as the form item language grows per the spec's versioning section).

Having both a Zod schema at the controller boundary and a hand-written validator in the service means every future form-item-type addition (the spec explicitly plans for schema growth) must be updated in two places, and a developer fixing one will likely miss the other. Recommend either (a) deriving the Zod schema from a single source of truth shared with `validateFormItem`, or (b) dropping the Zod `formTemplateSchema`/`formItemBaseSchema` entirely and letting `parseBody` validate only the outer envelope (`short_name`, `description`, `schema_json` as `unknown`), with `onboardingService.ts`'s `validateFormTemplateInput`/`validateFormItem` remaining the single source of truth for item-level validation (it already throws `ServiceError(400, ...)` with good messages, which `handleError` will turn into a 400 anyway).

### 2. `formTemplateRepository.ts` has no application-level concurrency guard on update — optional

`updateFormTemplateForAssociation` (services/onboarding-service/src/database/formTemplateRepository.ts:88-118) performs a blind `UPDATE ... SET ... WHERE association_corporation_id = $1 AND id = $2`, with no `updated_at`/version check. Two concurrent association editors saving the same template will silently last-write-wins with no conflict signal. Given the form designer's spec explicitly calls for "Guard unsaved edits when closing or navigating away" at the UI layer, but nothing protects against two different sessions (e.g. two admin tabs, or stale local-storage draft) overwriting each other's saved changes. This is a low-traffic internal admin tool, so probably acceptable, but flagging since it's a real data-loss scenario with no detection.

### 3. Form template deletion has no DDQ pack item usage check or warning — recommended

`deleteFormTemplateForAssociation` (formTemplateRepository.ts:120-134) and the calling service function `deleteAssociationFormTemplate` (onboardingService.ts) unconditionally delete the template row. Per the spec, this is intentional — DDQ pack items copy the form document at creation time and don't reference the template afterward, so deleting a template is supposed to be safe for already-created pack items. That part is correctly implemented (no FK from `ddq_pack_item` to `form_templates`).

However, there is no UX signal in the API response that copy-time isolation is what's happening. A deletion returns `{ deleted: true }` with nothing indicating to the frontend whether the template is currently in use as a source for any draft pack items that haven't yet been published (still in-progress `config.form_template_id` selections, if the frontend keeps that until save). This is a minor UX-clarity point rather than a backend defect, since the backend design matches the spec exactly — listing it as recommended only in case the frontend doesn't already warn the user (out of scope for this backend-only review, included for completeness since associations may delete a template a colleague is mid-way through selecting in the DDQ pack draft UI).

### 4. `normalizeDDQPackItemInput` allows switching `task_type` away from `"form-completion"` while leaving a stale `form` document if the kind/task_type combination changes inconsistently — probably not worth fixing

In `onboardingService.ts`, `normalizeDDQPackItemInput` branches strictly on `input.taskType !== "form-completion"` vs `=== "form-completion"`. If a draft pack item is edited from a form-completion task to, say, a `document-upload` task, the new branch correctly runs `validateDDQPackItemInput`, which calls `ddqTaskDefinitions["document-upload"].normalizeConfig(input.config)` — this only reads `config.document_type` and ignores any leftover `config.form`, so the stale form document is silently dropped rather than carried over. This is actually correct behavior (no defect), confirmed via the code path — listing only to note it was checked, not a finding.

## Notes (confirmed-good / intentional, not findings)

- **Association ownership boundary is correctly enforced everywhere.** Every read/update/delete in `formTemplateRepository.ts` scopes by `association_corporation_id` in the `WHERE` clause, and `onboardingService.ts` always passes `context.corporation.id` — there is no path to read or mutate another association's templates.
- **Template-to-pack-item copy isolation matches the spec exactly.** `normalizeDDQPackItemInput` (onboardingService.ts) implements the spec's required server-side copy rule: if `config.form` is present it's validated and preserved as-is (supporting "retain copied form when edited"); otherwise `config.form_template_id` is resolved via `getFormTemplateForAssociation` scoped to the *current* association (not a global template lookup), converted via `formTemplateToDocument`, and only `{ form: copiedDocument }` is persisted — `form_template_id` never reaches storage. This is the central spec invariant and it is correctly implemented.
- **Draft/publish semantics for DDQ packs (not templates themselves, but the consumer) are correctly modeled** via `ddqPackTransitions`/`transitionDDQPackStatus`, and `validatePublishableDDQPack` re-validates every item (including form-completion items' copied `form` document) before allowing `draft → published`. Templates themselves have no draft/publish lifecycle (by design — they're directly read/write, consistent with the spec, which only describes draft semantics for DDQ packs and form responses, not templates).
- **Form schema validation (`validateFormItem`, `validateFormDocument`, `validateFormTemplateSchema`) is thorough**: type-checks `id`/`label`/`required`, enforces non-empty trimmed options arrays for `select`/`radio`, and rejects unknown item types. Matches the spec's `FormItem` union.
- **Versioning**: both schema (`schema.version !== 1`) and document (`input.version !== 1`) validation reject anything but version 1, consistent with the spec's stated initial-version scope; no premature speculative version-2 handling was added, which is correct per the spec's actual guidance (add handling when v2 is introduced).
- **Route wiring** in `onboardingRoutes.ts` for all five form-template endpoints (`GET`/`POST` list+create, `GET`/`PUT`/`DELETE` by id) matches the spec's API summary exactly and all are under `protectedRoutes` (auth-required), consistent with association-only ownership.
- **Permission checks** (`forms:read`, `forms:edit`) are applied per-controller via `requireAssociationUserWithPermission`, matching the spec's permission table.

## Test Gaps

- No test coverage observed in the provided excerpts for `formTemplateRepository.ts` CRUD functions, the `formTemplateBodySchema`/`validateFormTemplateInput` validation boundary, or the template→pack-item copy path (`normalizeDDQPackItemInput` with `form_template_id`). Given this copy-on-create rule is the spec's "one central rule," it is the highest-value missing test: a test asserting that editing/deleting a template after a pack item copy does not affect the already-created pack item's `config.form`.
- No test observed for concurrent/duplicate `short_name` templates within one association (the schema allows duplicate `short_name` values with no uniqueness constraint — not flagged as a finding since nothing in the spec requires uniqueness, but worth a deliberate test or explicit non-goal note if duplicates are intentional).

## Review Limitations

- `getFormTemplateForAssociation`'s SQL and `formTemplateToDocument`'s conversion were reviewed only against the excerpts provided; the `form_templates` table DDL itself was not in the provided database schema files for this step (only referenced in the spec doc), so constraint-level guarantees (e.g. `NOT NULL`, JSONB structure enforcement) could not be independently verified beyond what the spec documents.
- The frontend form-designer code that produces these payloads (`apps/form-design/*`) is out of scope for this step and was not reviewed here.

