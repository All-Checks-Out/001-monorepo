# Provider DDQ Checklist Upload Evidence Specification

## Goal

This specification describes checklist task evidence uploads for the current
repo.

When a Provider user executes a checklist task whose DDQ pack item requires a document or photo upload, the checklist UI should open an upload workspace for that task. The user must select a document or image, see a same-page preview before upload, add manual tags, upload the file through a presigned S3 URL, and have the backend persist metadata and tags in the SQL database. Once the upload is saved, the task execution state can move to completed.

All checklist tasks should also be reviewable, subject to permissions. For upload tasks, review must show the uploaded evidence, metadata, and tags. For non-upload tasks, review should show the task details and current execution state, even if the initial review content is minimal.

Follow the repository UX guidance in
[UX Design Philosophy for AI Agents](../design-guides/ux-design-philosophy-for-ai-agents.md)
whenever it applies. Frontend route ownership, remote mount points, and global
navigation ownership follow
[Module Federation Architecture](../architecture/module-federation.md). That
architecture document is canonical for route ownership.

In particular: keep this as a quiet operational interface, use breadcrumbs, use shared shadcn-style UI primitives, keep action icons familiar and tooltip/aria labelled, separate draft form state from immediate commands, and avoid adding marketing-style explanatory page sections.

## Upload Pattern

- Backend allocates a UUID object key with `randomUUID()`.
- Backend returns a short-lived S3 `PUT` presigned URL.
- Client uploads the selected file directly to S3 with `fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file })`.
- Metadata is stored in SQL with the UUID object key.
- Tags are stored in a separate table and replaced transactionally.
- S3 bucket blocks public access and allows browser `PUT` CORS.
- A CloudFront distribution is used for read/display URLs.
- S3 ObjectCreated events mark evidence rows uploaded and complete active
  upload tasks.

Evidence belongs to a Provider checklist task, not to a standalone gallery
image.

## Current Context

The checklist execution feature is already implemented. Relevant files:

- `docs/specs/form-designer-spec.md`
- `docs/specs/auto-tagging-spec.md`
- `services/onboarding-service/database/sql/V8__Create_provider_ddq_checklists.sql`
- `services/onboarding-service/database/sql/V9__Create_checklist_task_evidence.sql`
- `services/onboarding-service/src/database/ddqChecklistRepository.ts`
- `services/onboarding-service/src/database/ddqChecklistEvidenceRepository.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/controllers/providerController.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`
- `services/onboarding-service/src/consumers/s3ObjectCreatedConsumer.ts`
- `packages/frontend/api/src/onboarding/types.ts`
- `packages/frontend/api/src/onboarding/client.ts`
- `apps/core/src/pages/ProviderDDQChecklist.tsx`
- `apps/core/src/pages/ProviderDDQChecklistTaskPage.tsx`
- `apps/core/src/pages/ProviderDDQPacks.tsx`

The existing task types are:

```ts
type DDQTaskType = "document-upload" | "form-completion" | "photo-upload";
```

This feature applies initially to:

- `document-upload`
- `photo-upload`

Manual tags are captured at upload time. Automatic tags are produced by the
document-analysis service when available, as described in
[Minimal Document Analysis Auto-Tagging Specification](./auto-tagging-spec.md).

## Terminology

Avoid using `complete` as the primary user-facing verb for a task that requires action. Prefer:

- `Execute task` for opening the task workspace and doing the required work.
- `Review task` for viewing the completed or current task record.
- `Mark task complete` only inside the task workspace after evidence has been uploaded and saved, or as the exact status transition label where clarity requires it.

The underlying task status action remains `complete`, but the UI should
generally use `Execute` rather than `Complete` as the row action.

Use `evidence` as the domain word for the uploaded document or photo. It is broader than image and works for PDFs or other documents.

## UX Requirements

### Checklist Page Actions

The `Actions` column on `ProviderDDQChecklist` should use icon buttons, not text buttons. Each icon button must have:

- an intuitive lucide icon,
- `aria-label`,
- `title` or shared tooltip,
- disabled state where applicable,
- no visible text label inside the button.

Suggested icons:

- Execute task: `PlayCircle` or `UploadCloud` for upload tasks.
- Review task: `Eye`.
- Withdraw task: `Ban`.
- Restore task: `RotateCcw`.
- Reopen task: `Undo2`.
- Checklist-level actions may keep compact icon+text if the context is less obvious, but row actions in the table should be icon-only.

Show `Execute task` for active upload tasks when the user can perform checks. Show `Review task` for all checklist tasks when the user has any checklist view permission and a checklist exists. If a task has no evidence yet, review still opens a read-only task detail view showing that no evidence has been uploaded.

### Upload Workspace

Add a task-level workspace route, for example:

```text
/core/provider/ddq-packs/:packId/checklist/tasks/:taskId
```

Use a breadcrumb:

```text
DDQ Packs / {pack name} / {task title}
```

The current page should be non-clickable. The `DDQ Packs / {pack name}` breadcrumb link should return to the checklist page unless a draft upload/tag edit is dirty; if dirty, disable or guard navigation according to the UX philosophy document.

The upload workspace should be a compact operational layout. Recommended structure:

- Left or top area: task metadata and current progress.
- Main form area: file picker, manual tags, optional note/title fields if included.
- Preview area on the same page, visible before upload.
- Action row: discard/reset, upload/execute, review existing evidence if present.

The user must see a miniature preview before pressing upload:

- For images: use `URL.createObjectURL(file)` and show an image thumbnail.
- For PDFs: show an embedded/object preview when the browser supports it; otherwise show a document preview panel with filename, type, and size.
- For unsupported file types: show a document-style preview panel with filename, MIME type, size, and a clear icon.

Do not enable the upload action until:

- a file is selected,
- the preview panel is present,
- validation passes,
- required manual tag rules pass.

Manual tags should be based on the aws10 `ImageTags` UI pattern:

- normalize tags with `trim().toLowerCase()`,
- prevent duplicates,
- show tags as removable chips,
- provide an input plus add icon/button,
- save tags with the upload or as a separate replace-all operation after upload.

Because field edits are draft-based, changing file selection or tags should show a dirty state such as `Unsaved evidence`. Upload is the explicit save/execute command.

### Review Workspace

The task route should support review mode, or use a sibling route if that is cleaner. Review mode is read-only unless the user has perform permission and explicitly chooses to reopen or replace evidence.

Review should show:

- task title, type, progress,
- uploaded file preview or document placeholder,
- original filename,
- content type,
- file size,
- upload timestamp,
- uploader identity where available,
- manual tags,
- any later automatic tags when added in future versions.

For uploaded documents/photos, provide an `Open original` action that loads the CloudFront URL in a new tab. Avoid forcing downloads for images/PDFs unless the browser cannot preview the type.

## Permissions

Reuse the existing checklist permissions:

- `ddq-packs:perform-checks`: can execute tasks, request upload URLs, upload evidence, replace evidence, edit manual tags, and transition tasks.
- `ddq-packs:review-checks`: can review checklist tasks read-only.
- `ddq-packs:approve-checks`: can review checklist tasks read-only for this phase.

Backend enforcement is authoritative. Frontend permission checks are only usability.

Direct access rules:

- A user can only access checklist evidence for their own Provider corporation's `provider_ddq_pack`.
- Review endpoints require any of the three checklist permissions above.
- Mutation endpoints require `ddq-packs:perform-checks`.
- Users without checklist permissions receive authorization errors from the backend.

## Storage Infrastructure

Add an S3 evidence bucket to the onboarding service CDK, following the aws10 `PhotosImages` construct:

- private bucket,
- block all public access,
- browser CORS allowing `PUT` from the frontend,
- CloudFront distribution with origin access control for read URLs,
- SSM parameters for bucket name and distribution URL.

Suggested parameter names:

```text
/onboarding/evidence/bucket-name
/onboarding/evidence/distribution-url
```

Add Lambda environment variables:

```text
EVIDENCE_BUCKET_NAME
EVIDENCE_CLOUDFRONT_URL
```

Grant the onboarding Lambda:

- `s3:PutObject` for presigned uploads,
- `s3:GetObject` if server-side validation/read is later needed,
- `s3:DeleteObject` if replacement/deletion cleanup is implemented now,
- `ssm:GetParameter` if resolving bucket/config through SSM at runtime.

Add onboarding-service dependencies:

```text
@aws-sdk/client-s3
@aws-sdk/s3-request-presigner
```

## Database

Add a new migration after `V8__Create_provider_ddq_checklists.sql`, for example `V9__Create_checklist_task_evidence.sql`.

Recommended schema:

```sql
CREATE TABLE IF NOT EXISTS provider_ddq_checklist_task_evidence (
    id INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    checklist_task_id INT NOT NULL,
    uploaded_by_app_user_id INT NOT NULL,
    object_key VARCHAR(64) NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_upload',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_at TIMESTAMPTZ NULL,
    replaced_at TIMESTAMPTZ NULL,
    CONSTRAINT provider_ddq_checklist_task_evidence_task_fk
        FOREIGN KEY (checklist_task_id)
        REFERENCES provider_ddq_checklist_task(id)
        ON DELETE CASCADE,
    CONSTRAINT provider_ddq_checklist_task_evidence_user_fk
        FOREIGN KEY (uploaded_by_app_user_id)
        REFERENCES app_user(id)
        ON DELETE RESTRICT,
    CONSTRAINT provider_ddq_checklist_task_evidence_status_check
        CHECK (status IN ('pending_upload', 'uploaded', 'replaced', 'failed')),
    CONSTRAINT provider_ddq_checklist_task_evidence_size_check
        CHECK (file_size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_provider_ddq_checklist_task_evidence_task
    ON provider_ddq_checklist_task_evidence(checklist_task_id);

CREATE TABLE IF NOT EXISTS provider_ddq_checklist_task_evidence_tag (
    evidence_id INT NOT NULL,
    tag TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT provider_ddq_checklist_task_evidence_tag_evidence_fk
        FOREIGN KEY (evidence_id)
        REFERENCES provider_ddq_checklist_task_evidence(id)
        ON DELETE CASCADE,
    CONSTRAINT provider_ddq_checklist_task_evidence_tag_pk
        PRIMARY KEY (evidence_id, tag, source),
    CONSTRAINT provider_ddq_checklist_task_evidence_tag_not_blank
        CHECK (LENGTH(TRIM(tag)) > 0),
    CONSTRAINT provider_ddq_checklist_task_evidence_tag_source_check
        CHECK (source IN ('manual', 'recognition'))
);

CREATE INDEX IF NOT EXISTS idx_provider_ddq_checklist_task_evidence_tag
    ON provider_ddq_checklist_task_evidence_tag(LOWER(tag));
```

Notes:

- `pending_upload` is useful because the backend creates metadata before the
  browser uploads to S3. S3 ObjectCreated events mark the row `uploaded` after
  the object exists.
- Keep evidence history by marking old rows `replaced` instead of overwriting
  them. The review UI can show the latest uploaded row by default.
- `object_key` should be a UUID string. If file extensions are needed for downstream tools, store the original filename separately and keep the object key opaque.

Add types to both backend and frontend API type files:

```ts
type ChecklistEvidenceStatus = "pending_upload" | "uploaded" | "replaced" | "failed";
type ChecklistEvidenceTagSource = "manual" | "recognition";

type ProviderDDQChecklistTaskEvidence = {
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
  url: string;
  tags: ProviderDDQChecklistTaskEvidenceTag[];
};

type ProviderDDQChecklistTaskEvidenceTag = {
  tag: string;
  source: ChecklistEvidenceTagSource;
};
```

## Backend API

Add endpoints under the existing provider checklist route:

```text
GET  /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId
POST /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId/evidence/upload-url
PUT  /auth/provider/ddq-packs/:packId/checklist/tasks/:taskId/evidence/:evidenceId/tags
```

Recommended response for `GET`:

```ts
type ProviderDDQChecklistTaskDetailResponse = {
  pack: DDQPack;
  checklist: ProviderDDQChecklist;
  task: ProviderDDQChecklistTask;
  evidence: ProviderDDQChecklistTaskEvidence | null;
};
```

Request body for `upload-url`:

```ts
{
  original_filename: string;
  content_type: string;
  file_size_bytes: number;
  tags: string[];
}
```

Response body for `upload-url`:

```ts
{
  evidence: ProviderDDQChecklistTaskEvidence;
  upload_url: string;
}
```

Upload completion behavior:

1. S3 emits ObjectCreated after the browser `PUT` succeeds.
2. `s3ObjectCreatedConsumer` decodes the object key and resolves the evidence
   row.
3. The onboarding service marks the evidence row `uploaded`, sets
   `uploaded_at = NOW()`, and marks previous uploaded evidence for the same task
   as `replaced`.
4. If the checklist task is active, the onboarding service transitions it to
   `completed` and applies the existing automatic checklist status rules.
5. The onboarding service emits the evidence object-created event consumed by
   document analysis.

Tag update behavior:

- Validate tags with zod.
- Normalize tags in the service layer.
- Replace manual tags transactionally.
- Preserve future `recognition` tags unless the endpoint explicitly targets all tags. For this phase, the endpoint should replace only `source = 'manual'`.

Validation:

- Allow `image/*` for `photo-upload`.
- Allow common document content types for `document-upload`, at minimum `application/pdf` and image types if the document type is identity-photo-like.
- Enforce max file size. Suggested default: 10 MB unless product requirements say otherwise.
- Reject upload for checkpoint and form-completion tasks.
- Reject mutation when the checklist is withdrawn.

## Backend Implementation Files

Suggested new or changed files:

- `services/onboarding-service/database/sql/V9__Create_checklist_task_evidence.sql`
- `services/onboarding-service/src/database/ddqChecklistEvidenceRepository.ts`
- `services/onboarding-service/src/services/evidenceStorage.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/controllers/providerController.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`
- `services/onboarding-service/src/database/onboardingTypes.ts`
- `services/onboarding-service/cdk/src/lib/evidenceConstruct.ts`
- `services/onboarding-service/cdk/src/lib/onboardingServiceStack.ts`
- `services/onboarding-service/package.json`

Repository operations needed:

- read one checklist task with pack/checklist context and latest evidence,
- create pending evidence row,
- list/read evidence tags,
- replace manual evidence tags,
- mark evidence uploaded,
- mark older evidence rows replaced,
- optionally mark pending evidence failed.

Keep SQL in repository files rather than expanding controller code.

## Frontend API Client

Extend `packages/frontend/api/src/onboarding/client.ts` with:

```ts
getProviderDDQChecklistTask(packId, taskId)
createProviderDDQChecklistTaskEvidenceUploadUrl(packId, taskId, payload)
updateProviderDDQChecklistTaskEvidenceTags(packId, taskId, evidenceId, tags)
uploadProviderDDQChecklistTaskEvidence(file, packId, taskId, tags, options)
```

The high-level `uploadProviderDDQChecklistTaskEvidence` helper should:

1. Request the upload URL and pending evidence row.
2. PUT the file to S3 using the returned URL.
3. Return the evidence row and upload URL. The backend observes the S3
   ObjectCreated event asynchronously.

Use existing `authJson`, `jsonPost`, and `jsonRequest` helpers. Use the Cognito ID token exactly as existing onboarding-service calls do.

## Frontend UI

Suggested files:

- update `apps/core/src/pages/ProviderDDQChecklist.tsx`
- add or update `apps/core/src/pages/ProviderDDQChecklistTaskPage.tsx`
- update `apps/core/src/CoreRouteContent.tsx`
- update `apps/core/src/constants/routes.ts`
- add shared local helpers if useful, for example `apps/core/src/utils/checklistEvidence.ts`

Checklist table changes:

- Rename the primary active task action from visible `Complete` text to icon-only `Execute task`.
- Add icon-only `Review task`.
- Keep status transition actions available where appropriate, but consider moving direct `Mark complete` for upload tasks into the task workspace so evidence is required first.
- For `document-upload` and `photo-upload`, completing from the table should be disabled or should route to execute; do not let users mark these tasks complete without evidence.

Task upload page states:

- Loading.
- Read-only review.
- Editable execute mode.
- No evidence uploaded.
- Existing evidence uploaded.
- New file selected with preview.
- Uploading.
- Error.
- Dirty tags/file state.

File preview implementation:

- Use object URLs and revoke them in `useEffect` cleanup.
- Image thumbnail should use stable dimensions so layout does not jump.
- PDF/document preview should fit the same stable preview frame.
- Show filename, type, and size near the preview.

Manual tags implementation:

- Use chips with remove icons.
- Use a compact add-tag form.
- Normalize tags before storing client state.
- Display saved manual tags in review mode.
- Reserve visual distinction for future recognition tags, but do not show AI controls yet.

## Completion/Execution Rules

For upload tasks:

- Active task + no uploaded evidence: `Execute task` opens upload workspace.
- Upload successful + S3 ObjectCreated processed: task becomes `completed`.
- Active task + uploaded evidence: user may review and then mark complete if
  object-created processing did not already do it.
- Completed task: user can review evidence.
- Reopened completed upload task: existing evidence remains available; user can replace it or mark complete again depending on desired workflow.
- Withdrawn task: review remains available, mutation disabled.
- Withdrawn checklist: task mutation disabled until checklist restored.

The backend must enforce that `document-upload` and `photo-upload` tasks cannot transition to `completed` unless at least one `uploaded` evidence row exists. This closes the loophole in the existing generic task status endpoint.

## Security and Data Integrity

- Do not trust client-provided task IDs alone. Every evidence endpoint must resolve through provider corporation, pack, checklist, and task.
- Do not return raw S3 bucket names or credentials to the client.
- Presigned upload URLs should expire quickly, for example 15 minutes.
- Store and validate content type and size before creating the upload URL.
- Consider adding a later cleanup job for stale `pending_upload` rows and orphaned S3 objects.
- Avoid exposing evidence across provider corporations.
- If CloudFront distribution URLs are public-by-URL, object keys must remain unguessable UUIDs.

## Testing and Verification

Backend:

```bash
pnpm -C services/onboarding-service run type-check
pnpm -C services/onboarding-service run test:security
```

Frontend:

```bash
pnpm -C packages/frontend/api run type-check
pnpm -C apps/core run type-check
pnpm -C apps/core run build
```

Manual QA:

1. Login as a Provider user with `ddq-packs:perform-checks`.
2. Create/open a checklist containing `document-upload` and `photo-upload` tasks.
3. Confirm row actions are icon-only and have tooltips/aria labels.
4. Open `Execute task` for a photo task.
5. Select an image and confirm a preview appears before upload is enabled.
6. Add manual tags, remove one, add it again, and confirm normalization/deduplication.
7. Upload and confirm the task becomes completed.
8. Review the task and confirm preview, metadata, and tags display.
9. Repeat with a PDF/document task.
10. Login as a user with only `ddq-packs:review-checks`; confirm review works and upload/tag edits are disabled.
11. Directly call mutation endpoints without perform permission and confirm authorization errors.
12. Withdraw the checklist and confirm evidence mutation is blocked.

## Open Product Questions

These should be answered before or during implementation:

1. Should S3 ObjectCreated always mark the task complete, or should the user
   upload evidence and then separately choose `Mark task complete`?
2. What document MIME types and max file size should be allowed for `document-upload`?
3. Should users be able to replace evidence after a task is completed, or must they reopen the task first?
4. Should review users see the original file through CloudFront, or should access be mediated by short-lived signed read URLs?
5. Should manual tags be mandatory for upload tasks, or optional?
6. Should evidence history be visible to reviewers, or only the latest uploaded evidence?
