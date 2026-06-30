# Claude Review: Step 0019, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T05:29:43.229Z
- Command: `pnpm run claude:review -- 0019`

## Review Step

### 0019 Checklist, Evidence, And Form Response Backend

Purpose: review provider checklist persistence, evidence metadata, file storage, and form response storage.

Files:

- `services/onboarding-service/src/database/ddqChecklistRepository.ts`
- `services/onboarding-service/src/database/ddqChecklistEvidenceRepository.ts`
- `services/onboarding-service/src/database/ddqChecklistFormResponseRepository.ts`
- `services/onboarding-service/src/services/evidenceStorage.ts`
- `services/onboarding-service/src/controllers/providerController.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `docs/specs/file-upload-evidence-spec.md`

Focus:

- upload authorization and storage boundaries
- evidence metadata integrity
- checklist task status transitions
- form response validation and ownership
- deletion/replacement semantics

## Review Output

# Step 0019 Review: Checklist, Evidence, And Form Response Backend

## Findings

### 1. `markChecklistTaskEvidenceUploaded` silently no-ops on its own previously-uploaded row, causing `markOtherChecklistTaskEvidenceReplaced` to mark the *current* evidence as replaced
**Blocking**
`services/onboarding-service/src/services/onboardingService.ts` — `completeChecklistTaskEvidenceUploadFromObjectKey`:

```ts
const uploadedEvidence =
  evidence.status === "uploaded"
    ? evidence
    : await markChecklistTaskEvidenceUploaded(client, evidence.checklist_task_id, evidence.id);
```

If the S3 ObjectCreated consumer is invoked twice for the same key (S3 "at-least-once" delivery, or a retry), the second invocation sees `evidence.status === "uploaded"` and reuses the existing row as `uploadedEvidence`. Execution then proceeds to:

```ts
await markOtherChecklistTaskEvidenceReplaced(client, evidence.checklist_task_id, evidence.id);
```

`markOtherChecklistTaskEvidenceReplaced` (`ddqChecklistEvidenceRepository.ts`) only excludes the current evidence id (`id <> $2`), so this is actually safe for the *same* row — re-read shows this specific path is idempotent for that row. However, the deeper issue is: nothing prevents the consumer from being invoked for an **older, already-replaced** object key after a newer upload has occurred (e.g., delayed S3 event ordering). In that case `readChecklistTaskEvidenceContextByObjectKey` returns the stale (now `replaced`) row, `markChecklistTaskEvidenceUploaded` fails its `WHERE status = 'pending_upload'` guard (correctly returns null), and the function exits early via `if (!uploadedEvidence) return null`. That part is fine. But if the *stale* row is still `pending_upload` (upload retried twice from the client, producing two presigned URLs for two different object keys for the same logical upload — not currently possible since each call generates a new UUID) this isn't reachable either. **Net: re-analysis shows this specific scenario is handled correctly.** Downgrading this finding — see note below in Notes section instead of Findings. (Retracted; see Notes.)

### 2. No content-type/extension verification at S3 — client controls `Content-Type` header on `PUT`, server only validates it for upload-URL creation
**Recommended**
`createProviderDDQChecklistTaskEvidenceUploadUrl` (`onboardingService.ts`) validates `input.contentType` against the task type (`validateEvidenceFile`) and bakes that `ContentType` into the presigned `PutObjectCommand` (`evidenceStorage.ts`). However, S3 presigned URLs generated this way typically only enforce the `Content-Type` *header* if the signature explicitly constrains it — and per the spec, the browser sets `headers: { "Content-Type": file.type }` itself. A malicious or buggy client could supply a different `file.type` than what was declared to the upload-url endpoint, or upload arbitrary binary content with a mismatched extension, since there is no server-side verification of the actual uploaded bytes (no magic-byte/MIME sniffing in `s3ObjectCreatedConsumer` or elsewhere in this excerpt). This is a known weakness of pure presigned-URL upload patterns; the spec doesn't call for stronger validation, but for evidence intended to be previewed and reviewed (PDFs/images), an attacker-controlled corporation could upload non-image/non-PDF content disguised with an allowed `Content-Type`, leading to CloudFront serving unexpected content types to other users opening "Open original" links. Consider verifying `Content-Length`/actual object content-type via a `HeadObject` call in the consumer before marking evidence `uploaded`, or accept this as a known limitation given the threat model (same-corporation evidence, not public).

### 3. `maxEvidenceFileSizeBytes` is enforced only against the client-declared `file_size_bytes`, never against the actual uploaded object size
**Recommended**
`validateEvidenceFile` in `onboardingService.ts` checks `input.fileSizeBytes > maxEvidenceFileSizeBytes` (10 MB) before issuing the presigned URL, but the presigned `PutObjectCommand` in `evidenceStorage.ts` has no `ContentLength` constraint, and `completeChecklistTaskEvidenceUploadFromObjectKey` never re-checks the actual S3 object size after upload. A client can declare a small `file_size_bytes` to pass validation, then upload an arbitrarily large file directly to S3 via the presigned URL (presigned PUT URLs don't enforce size unless a policy/condition is attached). This is a real storage-cost/DoS-adjacent risk worth flagging, though it's not destructive data corruption. Consider adding `ContentLength` to the presigned command or a bucket policy / S3 condition limiting object size.

### 4. `evidenceObjectUrl` builds CloudFront URLs from a raw UUID object key — confirmed safe, but `encodeURIComponent` on a UUID is effectively a no-op; not a defect, just worth noting object keys are otherwise unguessable (good)
No action — moved to Notes.

### 5. `readChecklistTaskEvidenceContextByObjectKey` is queried without limiting to "most recent" — if `object_key` somehow collided (shouldn't, since `UNIQUE` constraint per spec/DB), but the in-code type doesn't enforce uniqueness assumption
**Probably not worth fixing**
The DB schema (per spec) declares `object_key VARCHAR(64) NOT NULL UNIQUE`, so `result.rows[0]` is safe. No defect, but the repository file doesn't include this guarantee in a comment/type — purely informational, not a finding worth raising further.

### 6. `changeProviderDDQChecklistTaskStatus` lets a user move a `document-upload`/`photo-upload` task directly from `active` to `completed` via the generic checklist-task-status endpoint, bypassing the upload workflow, as long as *any* uploaded evidence row exists for that task
**Optional**
`onboardingService.ts`:
```ts
if (action === "complete" && isUploadTask(task.task_type)) {
  const uploadedEvidenceCount = await countUploadedChecklistTaskEvidence(client, task.id);
  if (uploadedEvidenceCount === 0) {
    throw new ServiceError(400, "Upload evidence before completing this DDQ Checklist Task.");
  }
}
```
This correctly closes the "loophole" the spec calls out (cannot complete without evidence) — confirmed good. However, it counts evidence across the *task's entire history*, not the *current* (non-replaced) evidence only. If all uploaded evidence rows were later marked `replaced` due to a fresh upload still sitting at `pending_upload` (upload initiated but not yet confirmed by S3 event), `countUploadedChecklistTaskEvidence` filters on `status = 'uploaded'`, which would correctly be 0 in that specific window (replaced rows are excluded). This is actually consistent. No real defect found here — downgrading to "optional" only as a documentation/comment suggestion: the check semantics ("has at least one currently-uploaded evidence row") could use a one-line comment since it's non-obvious from the SQL alone.

### 7. `evidenceStorage.ts` module-level `s3Client` singleton created at import time using `createEvidenceS3Client()`, which reads `isLocalMode()` once at process startup
**Probably not worth fixing**
```ts
const s3Client = createEvidenceS3Client();
```
This is evaluated once per Lambda/process cold start, consistent with `isLocalMode()` being a static deployment property, not a per-request value. No defect — environment selection is fixed per deployment, not per-request, so caching the client is appropriate. Noted only because it superficially resembles a hidden-default pattern the review guide asks to watch for, but on inspection it is the correct, explicit pattern (local vs deployed split at module load, driven by an explicit env var check).

### 8. `getOrCreateProviderDDQChecklistService` / `createProviderDDQChecklist` (`ddqChecklistRepository.ts`) uses `ON CONFLICT (provider_ddq_pack_id) DO UPDATE SET provider_ddq_pack_id = EXCLUDED.provider_ddq_pack_id` purely to force a `RETURNING` row on conflict — functionally fine, but this silently resurrects/returns an existing checklist (including a `withdrawn` or `completed` one) without communicating that to the caller
**Optional**
When a provider calls "create checklist" on a pack that already has a withdrawn/completed checklist, this returns the existing row as if freshly created, without surfacing checklist status distinctly to the caller for that specific call path (`getOrCreateProviderDDQChecklistService` does re-read full state afterward via `readProviderDDQChecklist`, so the final response *does* include checklist status — so the frontend isn't actually misled). Confirmed non-issue on closer inspection — moved to notes.

### 9. `saveProviderDDQChecklistTaskFormResponse` / `completeProviderDDQChecklistTaskFormResponse` non-null-assert `detail.checklist!` and `detail.task!` after `saveChecklistTaskFormResponseInTransaction` already validated them
**Optional**
`onboardingService.ts`, `completeProviderDDQChecklistTaskFormResponse`:
```ts
const saved = await saveChecklistTaskFormResponseInTransaction(client, detail, input.values, true);
await updateProviderDDQChecklistTaskStatus(client, detail.checklist!.id, detail.task!.id, "completed");
```
`saveChecklistTaskFormResponseInTransaction` throws if `detail.checklist`/`detail.task` are null, so the non-null assertions are safe at runtime, but they bypass TypeScript's narrowing in a way that could become unsafe if the helper's validation logic is ever refactored. A small, low-risk readability/maintainability nit — using a typed return or restructuring to narrow `detail` once would remove the need for `!`. Not worth a dedicated fix on its own.

### 10. `validateEvidenceFile` rejects `document-upload` content types not in `{application/pdf, image/*}`, but `document_type` config values (`passport`, `driving-license`, `head-and-shoulders-photo`, `other`) are never cross-checked against the uploaded `content_type` (e.g., a `passport` document type accepting a `.gif` because `image/*` is allowed)
**Probably not worth fixing**
This matches the spec's stated validation rules exactly ("Allow common document content types for `document-upload`... `application/pdf` and image types"), so it's not a deviation from current product direction — just a potential future tightening. Not a defect against current spec.

---

## Notes / Confirmed-Good Observations

- **Tenant boundary enforcement is consistently correct.** Every evidence and checklist task read/write path (`readProviderDDQChecklistTaskContext`, `readChecklistTaskEvidence`, `getProviderDDQChecklist`, etc.) joins through `provider_ddq_pack.provider_corporation_id = $1`, scoped to `context.corporation.id`. No endpoint accepts a bare evidence/task ID without re-deriving it through the provider/pack/checklist chain, satisfying the spec's "Do not trust client-provided task IDs alone" requirement.
- **Withdrawn-checklist mutation guard is applied consistently**: `validateEvidenceMutation`, `saveChecklistTaskFormResponseInTransaction`, and `changeProviderDDQChecklistTaskStatus` all reject mutation when checklist status is `withdrawn`.
- **Upload-task completion loophole from the spec is closed**: the generic task-status `complete` action now requires `countUploadedChecklistTaskEvidence > 0` for upload tasks and `completed_at` set for form-completion tasks, matching the spec's explicit requirement ("must enforce that document-upload and photo-upload tasks cannot transition to completed unless at least one uploaded evidence row exists").
- **Form response validation is server-authoritative**: `validateFormCompletion` re-derives required-field/type/option checks from the stored `form_document` definition rather than trusting client-supplied completeness, and `normalizeFormValuesForDocument` strips any value keys not present in the form's own item list, preventing injection of arbitrary keys into `form_document.values`.
- **Tag normalization is server-side and consistent** (`normalizeTags`: trim/lowercase/dedupe/sort) for both upload-time tags and tag-update calls, matching the spec's `aws10 ImageTags` normalization pattern.
- **Transactional integrity is generally well handled**: evidence creation + tag replacement + event publish are wrapped in BEGIN/COMMIT/ROLLBACK in `createProviderDDQChecklistTaskEvidenceUploadUrl`, and `completeChecklistTaskEvidenceUploadFromObjectKey` wraps the mark-uploaded + replace-others + status-transition + event-publish sequence similarly.
- **Manual vs. recognition tag separation** (`replaceChecklistTaskEvidenceTags(..., "manual")` only ever touching `source = 'manual'` rows) matches the spec's requirement to preserve future recognition tags.
- **Bucket/CloudFront config is explicit and fails loudly** (`evidenceStorage.ts` throws if `EVIDENCE_BUCKET_NAME`/`EVIDENCE_CLOUDFRONT_URL` are unset) rather than silently defaulting — good adherence to "prefer explicit, reviewable choices over implicit fallbacks."
- Findings #1, #4, #5, #6, #8 above were investigated and found to be non-issues on closer trace-through; they are recorded here for transparency about what was checked rather than as defects.

## Test Gaps

- No test coverage is visible in the provided excerpts for: presigned-upload-URL request validation (file type/size boundary cases), the S3 ObjectCreated → evidence-uploaded transition path (`completeChecklistTaskEvidenceUploadFromObjectKey`), or the form-response validation (`validateFormCompletion`/`normalizeFormValuesForDocument`) edge cases (missing required field, wrong type, stale item ids). These are exactly the kind of boundary logic (file size limits, content-type restrictions per task type, required-field enforcement) that benefit most from targeted unit/integration tests given they're the primary safety checks in this step's scope.
- No visible test for double-delivery/duplicate S3 event handling for `completeChecklistTaskEvidenceUploadFromObjectKey`, which is the kind of idempotency concern this step's focus area explicitly calls out.

## Review Limitations

- The S3 event consumer itself (`s3ObjectCreatedConsumer.ts`) and its object-key decoding logic were not included in this step's source excerpts (it's listed under step 0020), so the full idempotency/ordering behavior around `completeChecklistTaskEvidenceUploadFromObjectKey` could only be partially verified from the onboarding-service side.
- `onboardingTypes.ts` (full file) was not included, so exact column constraints (e.g., `object_key` uniqueness) were taken from the spec document rather than verified directly against a live schema/migration file.
- CDK/S3 bucket policy and CORS configuration (referenced in the spec) were not in scope for this step's file list, so claims about presigned URL size/content-type enforcement could not be confirmed against actual bucket policy conditions — Finding #3 is based on the absence of `ContentLength` in the `PutObjectCommand` shown, not a confirmed absence of any S3-side enforcement.

