# Claude Review: Step 0007, Run 02

- Current git branch: `main`
- Reviewed at: 2026-06-30T06:40:36.427Z
- Command: `pnpm run claude:review -- 0007`

## Review Step

### 0007 Backend DDQ, Forms, Evidence, Document Analysis, And Events

Purpose: review backend DDQ/form-template/checklist/evidence/document-analysis behaviour and cross-service event boundaries.

Runner note: this is a larger review step. Use at least `CLAUDE_REVIEW_TIMEOUT_MS=600000` when running this step, and raise `CLAUDE_REVIEW_MAX_SOURCE_BYTES` if Claude reports that relevant source was truncated.

Files:

- `services/onboarding-service/src/database/ddqPackRepository.ts`
- `services/onboarding-service/src/database/ddqChecklistRepository.ts`
- `services/onboarding-service/src/database/ddqChecklistEvidenceRepository.ts`
- `services/onboarding-service/src/database/ddqChecklistFormResponseRepository.ts`
- `services/onboarding-service/src/database/formTemplateRepository.ts`
- `services/onboarding-service/src/services/evidenceStorage.ts`
- `services/onboarding-service/src/services/formTemplateValidation.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/controllers/associationController.ts`
- `services/onboarding-service/src/controllers/providerController.ts`
- `services/onboarding-service/src/events/`
- `services/onboarding-service/src/consumers/`
- `packages/backend/events/`
- `services/document-analysis-service/`
- `docs/specs/file-upload-evidence-spec.md`
- `docs/specs/auto-tagging-spec.md`
- `docs/specs/form-designer-spec.md`
- `docs/dev-plans-and-handovers/ddq-pack-form-completion-development-plan.md`
- `docs/dev-plans-and-handovers/provider-ddq-packs-tab-implementation-brief.md`

Focus:

- form-template schema validation and lifecycle semantics
- DDQ pack draft/publish/archive and task ordering semantics
- checklist generation and provider/association boundary checks
- evidence upload authorization, metadata integrity, and storage boundaries
- form response validation and ownership
- event schema stability, idempotency, retries, and failure visibility
- document-analysis ownership and tag suggestion persistence

## Review Output

# Step 0007 Review: Backend DDQ, Forms, Evidence, Document Analysis, And Events

## Findings

### 1. S3 ObjectCreated consumer trusts client-supplied `contentType` without re-deriving evidence type — evidence row can be marked completed for a task type it doesn't match
`onboardingService.ts` `validateUploadedEvidenceObject()` (called from `completeChecklistTaskEvidenceUploadFromObjectKey`) re-validates the uploaded object's size and content type against the *original* `evidence.content_type` recorded at upload-URL-creation time, then calls `validateEvidenceFile` using `inferUploadTaskTypeFromContentType(actualContentType)` — a type inferred purely from content type, not the task's actual `task_type`. This means a `document-upload` task could be uploaded as `image/jpeg` and treated as if it were a `photo-upload` for the purpose of file-size/type re-validation, since the function never looks at `evidence.task_status`/the real task type from `EvidenceContextRow`. The original task-type check (`validateEvidenceUploadTask`) only ran once, at `createProviderDDQChecklistTaskEvidenceUploadUrl` time, before the actual upload — bypassable by uploading a different file than what was declared. Practically: someone could request an upload URL for a `document-upload` task declaring `application/pdf`, then PUT an arbitrary file with a different `Content-Type` to S3, and the post-hoc HEAD-based re-validation (`headEvidenceObject`) compares against `evidence.content_type` from the DB row (the originally declared type), not what was actually uploaded — so a mismatch is caught (`actualContentType !== evidence.content_type` throws) but the *task-type-correctness* check is never re-derived from the real `task_type`, only re-derived from content type. This is a minor defense-in-depth gap rather than an authz bypass, but it weakens the integrity guarantee the spec calls for ("Validate content type and size before creating the upload URL").
**Classification: optional**

### 2. `validateUploadedEvidenceObject` throwing inside `completeChecklistTaskEvidenceUploadFromObjectKey` rolls back and silently drops the event with no retry/visibility
In `services/onboarding-service/src/consumers/s3ObjectCreatedConsumer.ts`, the handler calls `completeChecklistTaskEvidenceUploadFromObjectKey` directly with no try/catch. If `validateUploadedEvidenceObject` throws (e.g., HEAD content-length missing, size over limit, content-type mismatch), the error propagates up through the Lambda handler. Depending on how this Lambda is wired to EventBridge (direct invoke vs. SQS), an uncaught throw from a direct EventBridge target normally retries per EventBridge's default retry policy (or DLQ if configured) — but the spec's "no DLQs" minimal-implementation philosophy applies to the *document-analysis* service, not necessarily described for this consumer. There's no logging of the validation failure reason here (unlike the `console.warn` for a missing key), so an upload that fails post-hoc validation will leave the evidence row stuck in `pending_upload` forever with no operator-visible signal beyond default Lambda/EventBridge retry/failure metrics.
**Classification: recommended** — add at minimum a caught/logged failure path (e.g., `console.error` before rethrow, or mark evidence `failed`) so a stuck `pending_upload` row is diagnosable; the `failed` status already exists in the evidence status enum but nothing in this codebase ever sets it.

### 3. `markChecklistTaskEvidenceUploaded` matches by `checklist_task_id` AND `id`, but `readChecklistTaskEvidenceContextByObjectKey` looked up by `object_key` alone — fine, but the function silently no-ops (returns null) on partial state without distinguishing "already uploaded" from "evidence not found"
In `completeChecklistTaskEvidenceUploadFromObjectKey`, if `evidence.status === 'uploaded'` already, `uploadedEvidence = evidence` (idempotent re-delivery handled). But if `markChecklistTaskEvidenceUploaded` returns null (e.g., status was `replaced` or `failed`, not `pending_upload`), the function does `await client.query("COMMIT"); return null;` — silently succeeding with no signal that the S3 event matched a *replaced* or *failed* evidence row. This is fine for idempotent redelivery of the *same* uploaded event, but if S3 redelivers an ObjectCreated event for an object that was later superseded (replaced), the function quietly does nothing rather than logging that an unexpected state was hit. Low risk given replace-then-re-upload is rare, but worth at least a log line for diagnosability.
**Classification: optional**

### 4. `EVIDENCE_BUCKET_NAME` is read from `process.env` at multiple call sites instead of validated once at startup
`evidenceStorage.ts`, `onboardingService.ts` (`createProviderDDQChecklistTaskEvidenceUploadUrlService`, `completeChecklistTaskEvidenceUploadFromObjectKey`) each independently check `if (!bucketName) throw new Error(...)` after already having created the S3 presigned URL / done other work. In `createProviderDDQChecklistTaskEvidenceUploadUrl`, the presigned URL is generated via `createEvidenceUploadUrl` (which itself throws if `EVIDENCE_BUCKET_NAME` is missing) *before* the transaction begins — so the env var is effectively checked twice (once inside `createEvidenceUploadUrl`, once again directly in the service function for the event publish). This isn't a bug, but it's a sign the bucket name should be resolved once and threaded through, rather than re-read via `process.env` in three separate places with three separate redundant null checks. Not a functional defect since behavior is correct (fails closed), just a minor consistency/maintainability note.
**Classification: probably not worth fixing**

### 5. `replaceChecklistTaskEvidenceTags` issues one `INSERT` per tag inside a loop rather than a batch insert
`ddqChecklistEvidenceRepository.ts` `replaceChecklistTaskEvidenceTags` loops over `tags` and does one `client.query` insert per tag. With the 10MB file-size cap and tags being free-text user input, there's no upper bound enforced on the number of tags a user can submit (`evidenceUploadUrlBodySchema` only requires `tags: z.array(z.string()).default([])` — no `.max()`). A user could submit thousands of tag strings in one request, causing thousands of sequential awaited inserts inside one open transaction. This is a minor resource/latency concern, not a security hole (tags are scoped to the user's own corporation's evidence), but worth a `.max()` bound on the tags array for basic input hygiene.
**Classification: optional**

### 6. `formTemplateValidation.ts` `formItemBaseShape.required` uses `z.boolean("Form item required flag is required.")` — passing a string as the second positional arg to `z.boolean()` is the Zod v4 error-customization API; confirm this matches the Zod version pinned
This is a correctness check, not a clear defect — Zod v4 supports `z.boolean({ error: "..." })` or the shorthand string form depending on minor version. If the installed Zod version is pre-v4 or a v4 version where this shorthand isn't supported the way it's used here (same pattern is used for `z.literal(1, "Invalid form template schema.")` and `z.array(z.string(), "...")`), this would either silently not produce the custom message or fail type-checking. Given `formTemplateValidation.ts` and `providerController.ts`/`associationController.ts` all use plain Zod schemas elsewhere without this pattern (e.g., `z.string().trim().min(1, "Short name is required.")` uses the standard message-as-second-arg form for `.min()`, which is long-standing API), this specific top-level-schema-message shorthand for `z.boolean()`, `z.literal()`, and `z.array()` is newer Zod v4 syntax. Worth a quick confirmation that `pnpm -C services/onboarding-service type-check` passes with the current Zod pin — if it does, this is a non-issue.
**Classification: optional** (defer to type-check verification; flagged because it's easy to silently get wrong across a Zod major version bump)

### 7. `ddq_pack_item` `config` for `form-completion` items can in principle exceed what `validateFormDocument` enforces on `definition.items` — no `.max()` bound on form item count or string lengths
`formTemplateValidation.ts` and `validateFormDocument` in `onboardingService.ts` both accept arbitrary-length `items` arrays and arbitrary-length labels/help text/options with only `.trim().min(1, ...)` lower bounds — no upper bound on string length or array length. A malicious or buggy Association user could submit a form template (or DDQ pack item form-completion config) with an enormous `items` array or multi-megabyte label strings, which would be persisted into `JSONB` and re-validated/re-serialized on every read (`formTemplateToDocument`, `parseFormItem` map over `items` on every checklist task read). This is low severity since form templates/DDQ packs are Association-admin-authored, not externally facing, but it's inconsistent with the evidence upload path's explicit 10MB cap.
**Classification: probably not worth fixing** — authoring is permission-gated to Association `forms:edit`/`ddq-packs:edit` users, so this is an internal trust boundary, not an external attack surface.

## Notes / Confirmed-Good Observations (not findings)

- **Tenant boundary enforcement is consistently correct.** Every DDQ pack/checklist/evidence/form-response read and write path threads `associationCorporationId` or `providerCorporationId` through the SQL `WHERE` clause or an `EXISTS` subquery (e.g., `getDDQPackForAssociation`, `readProviderDDQChecklist`, `readProviderDDQChecklistTaskContext`, `readChecklistTaskEvidenceContextByObjectKey` joined back to `provider_ddq_pack.provider_corporation_id`). This is the most important property for this review step and it holds up well across the reviewed files.
- **Draft-pack leakage is correctly blocked** in both `getDDQPack`/`addProviderDDQPackRepository` (`addProviderDDQPack` service checks `pack.status === "draft"` before allowing add) and `listAvailableProviderDDQPacks` (`WHERE ddq_pack.status <> 'draft'`).
- **Checklist/task status state machines** (`ddqPackTransitions`, `ddqChecklistTransitions`) are small, explicit, table-driven, and reject invalid transitions with clear `ServiceError(400, ...)` messages — good pattern, easy for Richard to audit.
- **Evidence completion gating is enforced correctly**: `changeProviderDDQChecklistTaskStatus` blocks `complete` for upload tasks without an `uploaded` evidence row, and blocks `complete` for `form-completion` tasks without `completed_at` on the form response — this closes the loophole the spec calls out explicitly ("the backend must enforce that document-upload and photo-upload tasks cannot transition to completed unless at least one uploaded evidence row exists").
- **Withdrawn-checklist mutation guard** (`validateEvidenceMutation`, the `result.checklist.status === "withdrawn"` checks in `changeProviderDDQChecklistTaskStatus` and `saveChecklistTaskFormResponseInTransaction`) is applied consistently across evidence, tags, and form-response mutation paths.
- **Form-template-to-pack-item copy-not-reference rule from `form-designer-spec.md` is correctly implemented.** `normalizeDDQPackItemInput` copies the template into `config.form` via `formTemplateToDocument` and never persists `form_template_id`; `validateFormDocument` is structurally permissive but requires `kind`/`version`/`title`/`items` shape, satisfying "earlier persisted form documents remain readable" since it doesn't hard-fail on unknown future-version documents beyond `version !== 1`.
- **Document-analysis service schema isolation is respected.** `services/document-analysis-service/src/database/db.ts` sets `search_path TO document_analysis, public` and all repository queries in `documentRepository.ts` operate only on `document_analysis.*`-schema tables (`document_projection`, `analysis_job`, `analysis_tag`, `analysis_event_inbox`), matching the auto-tagging spec's hard boundary rule. No cross-service join or onboarding-table access was found in the reviewed files.
- **Idempotency via inbox table works as the spec intends.** `insertEventInbox` uses `ON CONFLICT (event_id) DO NOTHING ... RETURNING true AS inserted`, and the consumer short-circuits (`if (!inserted) { commit; return; }`) before doing any Rekognition call or tag write — correctly prevents duplicate-tag insertion on event redelivery.
- **SQS batch item failures are correctly reported** in `evidenceEventConsumer.ts` (`batchItemFailures.push({ itemIdentifier: record.messageId })`), enabling partial-batch retry without redelivering already-succeeded items, consistent with `reportBatchItemFailures: true` in the CDK stack.
- **Event schema versioning (`version: 1`) is present on all three event types** (`EvidenceUploadRequestedEvent`, `EvidenceObjectCreatedEvent`, `DocumentAnalysisCompletedEvent`) in `packages/backend/events/src/index.ts`, giving a documented hook for future schema evolution.
- **`isLocalMode()` correctly short-circuits event publishing** in `publishEvidenceEvent`, so local development doesn't require a real EventBridge bus — consistent with the "local development without AWS access" design goal.
- **Form value validation/sanitization is reasonably tight**: `validateFormValues` rejects non-string/non-boolean/non-null values; `normalizeFormValuesForDocument` drops keys not present in the document's `definition.items`, preventing arbitrary key injection into stored form responses.
- **`isAllowedDocumentContentType`/`validateEvidenceFile` task-type-specific content-type restrictions** (image-only for `photo-upload`, PDF-or-image for `document-upload`) match the spec.

## Test Gaps

- No test files were included in or referenced by the reviewed file set for this step (`ddqPackRepository.ts`, `onboardingService.ts`, `evidenceEventConsumer.ts`, `tagSuggestions.ts`, etc.). Given the size and branching complexity of `onboardingService.ts` (status transitions, evidence validation, form-document merge/validation), this is a significant area for unit test coverage, particularly:
  - `transitionDDQPackStatus` / `transitionDDQChecklistStatus` table-driven transition rejection cases.
  - `validateFormCompletion` / `normalizeFormValuesForDocument` edge cases (missing required fields, wrong types, options mismatch, unknown keys).
  - `validateEvidenceFile` boundary cases (exactly 10MB, zero bytes, non-image content type for `photo-upload`).
  - The idempotent-redelivery path in `completeChecklistTaskEvidenceUploadFromObjectKey` (already-uploaded evidence, replaced evidence, missing evidence).
  - `normalizeTags` dedup/sort/lowercasing behavior.
- No test coverage visible for `evidenceEventConsumer.ts`'s `parseDetail` envelope-unwrapping fallback logic (`envelope.detail ?? JSON.parse(body)`), which silently re-parses the body a second time if `detail` is absent — this dual-parse fallback is unusual enough to warrant an explicit test for both EventBridge-wrapped and raw-detail message shapes.

## Review Limitations

- Database migration files (e.g., `V8__Create_provider_ddq_checklists.sql`, `V9__Create_checklist_task_evidence.sql`, the migration adding `provider_ddq_checklist_task_form_response`) were not included in the provided source excerpts, so constraint-level guarantees (foreign keys, unique constraints, check constraints) were inferred from the spec documents and repository query shapes rather than verified directly against migration SQL.
- `services/onboarding-service/src/routes/onboardingRoutes.ts` was listed as in-scope but not included in the excerpts, so route-to-permission wiring could only be verified indirectly through the controller-level `requireAssociationUserWithPermission`/`requireProviderUser` calls, not the route table itself.
- `services/onboarding-service/database/sql/` Flyway migration ordering/repeatability is out of scope per the step's own file list (covered by step 0008) and was not assessed here.
- The CDK stack for `onboarding-service`'s own evidence bucket/CORS/CloudFront construct (referenced in `file-upload-evidence-spec.md` as `evidenceConstruct.ts`) was not included in this step's file list, so the S3 bucket security posture (public access block, CORS config, OAC) could not be directly verified — only the document-analysis-service CDK stack (which imports the bucket by name) was in scope.
- `onboardingTypes.ts` was referenced extensively but not included in the excerpts, so some row-type shapes were taken on faith from usage rather than verified against their declarations.

