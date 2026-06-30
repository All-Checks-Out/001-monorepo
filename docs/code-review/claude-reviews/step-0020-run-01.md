# Claude Review: Step 0020, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T05:34:42.761Z
- Command: `pnpm run claude:review -- 0020`

## Review Step

### 0020 Document Events And Analysis Service

Purpose: review event publishing/consuming and document-analysis service boundaries.

Files:

- `packages/backend/events/package.json`
- `packages/backend/events/src/index.ts`
- `services/onboarding-service/src/events/evidenceEvents.ts`
- `services/onboarding-service/src/consumers/s3ObjectCreatedConsumer.ts`
- `services/document-analysis-service/src/events/analysisEvents.ts`
- `services/document-analysis-service/src/consumers/evidenceEventConsumer.ts`
- `services/document-analysis-service/src/database/db.ts`
- `services/document-analysis-service/src/database/documentRepository.ts`
- `services/document-analysis-service/src/services/tagSuggestions.ts`
- `docs/specs/auto-tagging-spec.md`

Focus:

- event schema stability
- idempotency and retry safety
- cross-service ownership boundaries
- document/tag suggestion persistence
- failure visibility

## Review Output

# Step 0020 Review: Document Events And Analysis Service

## Findings

### 1. `parseDetail` silently double-parses and can throw on malformed messages, failing the whole batch item unnecessarily
**File:** `services/document-analysis-service/src/consumers/evidenceEventConsumer.ts:40-53`

```ts
function parseDetail(body: string) {
  const envelope = JSON.parse(body) as {
    detail?: EvidenceEvent;
  };
  const detail = envelope.detail ?? JSON.parse(body) as EvidenceEvent;
  ...
}
```

`JSON.parse(body)` runs twice in the fallback branch (the second call re-parses the same string already parsed into `envelope`). This is not a correctness bug since `envelope` and the fallback are structurally equivalent, but it's wasted work that signals the EventBridge-vs-raw envelope shape is not actually pinned down — the code is guessing at the wire format rather than asserting it. If the real payload shape diverges from both branches, this throws inside the per-record `try` in `handler`, which is caught and reported as a batch item failure (correct retry behaviour), but there's no visibility into *why* parsing failed beyond the generic `console.error`. Given the event contract is new and shared across two services, a defect here would silently retry forever without a clear log signal distinguishing "bad envelope shape" from "transient DB failure."
**Classification:** optional — retry/failure path is safe, but the redundant parse and unclear envelope contract is worth tightening for an event shape this is meant to be stable.

### 2. `EvidenceUploadRequestedEvent` projection upsert can race ahead of or behind `EvidenceObjectCreated`, but ordering is never enforced
**File:** `services/document-analysis-service/src/database/documentRepository.ts:71-128` (both upsert functions)

Both `upsertUploadRequestedProjection` and `upsertObjectCreatedProjection` use `ON CONFLICT (evidence_id) DO UPDATE`, unconditionally overwriting `checklist_task_id`, `provider_corporation_id`, `bucket_name`, `object_key`, etc. with whatever arrived most recently — regardless of which event type arrives second. SQS does not guarantee ordering for standard queues (and even FIFO would need a `MessageGroupId` keyed by evidence to guarantee it, which is not evidenced anywhere in these files). If `EvidenceObjectCreated` is processed before `EvidenceUploadRequested` (plausible under retries/redrive), the second upsert overwrites fields with stale/duplicate data, which is mostly idempotent here since both events carry the same field values for a given evidence_id — but if a *new* upload ever reused an `evidence_id` (it shouldn't, but nothing enforces that elsewhere) this would silently merge two uploads' metadata.
**Classification:** optional — current event payloads are duplicative by design (both carry full metadata) so this is low-risk today, but it's the kind of ordering assumption worth a one-line comment or test rather than leaving implicit.

### 3. `processEvidenceEvent` opens a new DB connection per SQS record with no pooling
**File:** `services/document-analysis-service/src/consumers/evidenceEventConsumer.ts:60` and `services/document-analysis-service/src/database/db.ts:43-58`

Every record in the SQS batch calls `createDbClient()`, which does a fresh SSM `GetParameter` + Secrets Manager `GetSecretValue` round trip (cached via the module-level `credentials` variable, fine) **and** a fresh `Client.connect()` TCP/TLS handshake to Postgres, followed by `client.end()` in `finally`. For a batch of, say, 10 records, that's 10 sequential connect/disconnect cycles. This is consistent with "minimal implementation" intent from the spec, and is not a correctness defect, but it is a real latency/connection-churn cost worth knowing about if Rekognition batches grow.
**Classification:** probably not worth fixing — explicitly in line with the spec's "no defensive completeness" instruction; flagging only as an operational note, not a defect.

### 4. `markEventInboxProcessed` runs unconditionally even when `inserted` is true but downstream work already happened in a different branch — minor redundancy, not a bug
Re-checked: this is actually fine — `markEventInboxProcessed` is called once per successful code path after the corresponding projection/tagging work completes, and the early return on `!inserted` (duplicate event) skips all of it. No defect.

### 5. `replaceAnalysisTags` deletes by `evidence_id` then inserts under a new `analysis_job_id`, orphaning the prior `analysis_job` row
**File:** `services/document-analysis-service/src/database/documentRepository.ts:163-178` and the caller in `evidenceEventConsumer.ts:90-99`

Each time `EvidenceObjectCreated` is processed for a given evidence_id, a **new** `analysis_job` row is created (line 91-96) even though `analysis_event_inbox` should prevent duplicate processing of the *same* event. This is only reachable if the same evidence_id receives a second, distinct `EvidenceObjectCreated` event (e.g., upstream re-upload to the same evidence record). In that case `replaceAnalysisTags` deletes old tags by `evidence_id` and inserts new ones referencing the new job, but the old `analysis_job` row remains in `analysis_job` with `status = 'completed'` and no tags — an orphaned job record pointing to deleted tags. Harmless for correctness (tags table is the source of truth for "current" tags), but creates a confusing audit trail where `analysis_job` history doesn't match `analysis_tag` history.
**Classification:** optional — minor data-hygiene gap, not a functional defect; worth a short comment if intentional, otherwise low-priority cleanup.

### 6. No idempotency check before calling Rekognition itself
**File:** `services/document-analysis-service/src/consumers/evidenceEventConsumer.ts:85-99`

The `analysis_event_inbox` dedupes by `event_id`, which protects against the *same* event being reprocessed (e.g., SQS at-least-once redelivery). That's correctly implemented and is the main idempotency safeguard the spec asks for. Worth noting only as a confirmed-good pattern, not a finding — see Notes below.

---

## Notes (confirmed-good / intentional, not findings)

- **Idempotency via inbox table**: `insertEventInbox` uses `ON CONFLICT (event_id) DO NOTHING ... RETURNING true`, and the caller short-circuits on `!inserted`. This correctly prevents duplicate SQS delivery from re-calling Rekognition or duplicating tags. Matches the spec's stated rationale for keeping the inbox table.
- **Transactional consistency**: `processEvidenceEvent` wraps inbox-insert, projection upsert, job creation, and tag replacement in a single `BEGIN`/`COMMIT`/`ROLLBACK` per record, and `publishAnalysisCompletedEvent` is only called after tags are durably written but before commit — note this means if EventBridge publish succeeds but the subsequent `COMMIT` fails, a completion event could be published for data that gets rolled back. This is a real but narrow window (publish-then-commit ordering); given the spec's explicit "no defensive completeness" instruction and the low blast radius (a stray completion event with no matching DB row, which a re-delivery of the upstream event would naturally repair), this is **not** elevated to a finding, but it is worth being aware of if completion events start driving more consequential downstream actions.
- **Schema boundary respected**: `documentRepository.ts` and `db.ts` only touch `document_analysis.*` tables (enforced via `SET search_path TO document_analysis, public` in `db.ts:51`), with no cross-schema reads into onboarding tables — matches the spec's hard boundary requirement.
- **Local-mode skip in onboarding publisher**: `evidenceEvents.ts:11` (`if (isLocalMode()) return;`) cleanly separates local dev from deployed event publishing, consistent with the repo's local/deployed separation goals. The document-analysis side (`analysisEvents.ts`) has no equivalent local-mode check, but since document-analysis events are emitted from within an SQS consumer Lambda that itself only exists in deployed environments, this asymmetry is not a defect — there's no local invocation path for this publisher to guard.
- **Failure visibility**: `console.error` in the catch block plus returning `batchItemFailures` are the only failure signals — no structured logging, alerting, or DLQ. The spec explicitly says "Do not add DLQs" and "no defensive completeness," so this is an intentional, spec-directed minimalism rather than a defect.
- **Event versioning**: All three event types in `packages/backend/events/src/index.ts` carry a `version: 1` literal field but nothing currently reads or switches on it. This is fine for a first version — flagging only as something to watch when a `version: 2` is eventually needed, not a current defect.
- **`s3ObjectCreatedConsumer.ts`** correctly decodes S3's `+`-for-space and URL-encoded key format before delegating to the onboarding service's own completion logic — this consumer lives in onboarding-service and is out of document-analysis's schema boundary, as expected.

## Test Gaps

- No unit/integration tests are included in or referenced by the reviewed files for: `evidenceEventConsumer.ts` event parsing/branching, the inbox dedupe path, `tagSuggestions.ts` tag normalization (dedupe-by-lowercase, 40-char truncation, confidence rounding), or the projection upsert SQL. Given this is new, schema-boundary-sensitive code, targeted tests around (a) duplicate `event_id` delivery being a no-op, (b) non-image content types skipping Rekognition, and (c) tag normalization edge cases (empty string, >40 chars, duplicate case-insensitive tags) would be the highest-value additions.
- No test coverage shown for `s3ObjectCreatedConsumer.ts`'s key-decoding logic, which is a plausible source of subtle bugs (e.g., keys containing literal `+` characters in the original filename).

## Review Limitations

- The `analysis_event_inbox`, `document_projection`, `analysis_job`, and `analysis_tag` table definitions are taken from the spec's suggested schema, not from an actual migration file in the provided excerpts — actual column types/constraints (e.g., whether `event_id` truly has a unique constraint matching the `ON CONFLICT` clause) could not be independently verified from the bounded source.
- CDK infrastructure for the SQS queue, EventBridge rule, and Lambda permissions (Rekognition access, bucket read access) was not included in this step's file list and was not reviewed; any IAM over-permissioning or queue configuration issues are out of scope here.
- `completeChecklistTaskEvidenceUploadFromObjectKey` (called from `s3ObjectCreatedConsumer.ts`) lives in `onboardingService.ts`, which is not part of this step's file list — its correctness is out of scope.

## Summary

No blocking findings. The event/consumer/repository boundary is implemented cleanly and matches the spec's schema-isolation and idempotency requirements. The few findings above are minor robustness and data-hygiene observations (optional/probably-not-worth-fixing), not defects that compromise correctness, security, or the documented architecture.

