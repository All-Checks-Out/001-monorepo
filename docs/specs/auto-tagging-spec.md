# Minimal Document Analysis Auto-Tagging Specification

## Purpose

Add a new document analysis microservice that automatically tags uploaded photos.

From the user's perspective, the behaviour should be simple:

1. A user uploads a photo as evidence for a due diligence checklist task.
2. The system automatically analyses the photo.
3. The photo receives automatic tags from AWS Rekognition.
4. The user does not need to manually tell the backend that the upload has completed.

The implementation should intentionally be minimal. Prefer the smallest working path over defensive completeness.

## Key Design Decisions

### S3 Is The Upload Completion Signal

The frontend must not call a backend "finalize upload" endpoint after the browser upload completes.

Instead:

1. The frontend requests a pre-signed S3 upload URL from the core/onboarding service.
2. The frontend uploads the file directly to S3.
3. S3 emits an ObjectCreated event when the object becomes available.
4. The backend trusts the S3 ObjectCreated event as the upload-completion signal.
5. The system proceeds from that event.

There should be no UI waiting/reporting loop whose purpose is to tell the backend that the file transfer has completed.

### Minimal Code

The implementation should be deliberately minimal:

- no custom retry/backoff logic unless AWS infrastructure requires it
- no defensive reconciliation worker
- no duplicate upload-finalization paths
- no "pending upload then finalize" lifecycle
- no DLQs unless explicitly requested later
- no CDK custom resource Lambdas
- no frontend progress-confirmation workflow
- no broad error handling framework
- no speculative abstractions for future document AI

Use normal TypeScript type checks and simple input parsing where the route/event handler already needs it, but avoid building a production-hardening layer in this first implementation.

### Match The aws10 Project Style

Wherever possible, the code should replicate or stay as close as possible to the way the code works and is written, both in style and form, in the `aws10` project in this workspace.

This applies to:

- service layout
- Rekognition client usage
- event processing shape
- database/repository style
- naming conventions
- test style
- CDK structure, where applicable

If this repository's architecture requires a different shape, prefer the
current repository boundary rules and document the reason for the difference.

### Service And Schema Boundary

Create a new service:

```text
services/document-analysis-service
```

The core/onboarding service and the document-analysis service must use the same
Aurora PostgreSQL database, but with independent PostgreSQL schemas. This is a
development build with no production data to preserve, so existing Flyway
migrations may be edited to create the schema shape as if the system had always
been designed this way.

The document-analysis service must have its own PostgreSQL schema in that shared
database:

```text
document_analysis
```

The existing core/onboarding service keeps owning its own data. The document-analysis service must not query, join, update, or delete onboarding-owned tables.

All data needed by document-analysis must be projected through events.

Forbidden in document-analysis code:

```sql
SELECT * FROM onboarding.some_table;
SELECT * FROM provider_ddq_checklist_task_evidence;
```

Allowed in document-analysis code:

```sql
SELECT * FROM document_analysis.document_projection;
INSERT INTO document_analysis.analysis_tag (...);
```

## Target Architecture

```text
Browser
  |
  | 1. request upload URL
  v
Core / onboarding service
  |
  | 2. create evidence record and return pre-signed S3 URL
  v
Browser
  |
  | 3. upload directly to S3
  v
S3 evidence bucket
  |
  | 4. ObjectCreated event
  v
EventBridge
  |
  +--> Core / onboarding upload-completed consumer
  |
  +--> Document-analysis queue/consumer
          |
          v
      document_analysis schema
          |
          v
      AWS Rekognition DetectLabels
          |
          v
      automatic tags stored in document_analysis.analysis_tag
```

## Core / Onboarding Service Responsibilities

The core/onboarding service owns:

- users
- providers
- corporations
- DDQ packs
- DDQ checklists
- checklist tasks
- evidence records
- manual upload-time tags
- task completion state

Upload URL request behaviour:

1. Validate that the user may upload evidence for the checklist task.
2. Create an evidence record.
3. Store upload-time manual tags, if supplied.
4. Generate a pre-signed S3 upload URL.
5. Emit an evidence projection event containing the context document-analysis needs.
6. Return the upload URL to the frontend.

S3 ObjectCreated behaviour:

1. Receive an S3 ObjectCreated event for the evidence bucket.
2. Match the object key to the evidence record created during upload URL request.
3. Mark the evidence as uploaded.
4. Complete the checklist task from the user's perspective.
5. Emit an evidence-upload-completed event.

No separate frontend finalize endpoint should be required.

The previous manual frontend finalize endpoint and UI flow must be removed from
this slice. Checklist task completion is driven by the onboarding/core service
after it receives and trusts the S3 ObjectCreated event.

## Document Analysis Service Responsibilities

The document-analysis service owns:

- projected evidence/document metadata
- analysis jobs
- automatic tags
- Rekognition label results

It must:

1. Consume projected evidence events from queues.
2. Store its own projection of the evidence metadata.
3. Consume the upload-completed event derived from S3 ObjectCreated.
4. For photos, call AWS Rekognition DetectLabels.
5. Store Rekognition labels as automatic tags.
6. Optionally emit a simple analysis-completed event.

It must not:

- read onboarding tables
- write automatic tags into onboarding tables
- require frontend upload-finalization calls
- implement PDF/Textract analysis in the first pass
- implement custom object-readiness retry logic in the first pass

## Event Contracts

Use versioned events. Keep them small and explicit.

### EvidenceUploadRequested

Emitted by onboarding/core when the pre-signed upload URL is created.

This event gives document-analysis projection context, but it does not mean the S3 object exists yet.

```json
{
  "version": 1,
  "event_id": "uuid",
  "event_type": "EvidenceUploadRequested",
  "occurred_at": "2026-06-22T12:00:00.000Z",
  "source": "onboarding-service",
  "data": {
    "evidence_id": 123,
    "checklist_task_id": 456,
    "provider_corporation_id": 789,
    "uploaded_by_app_user_id": 101,
    "bucket_name": "example-bucket",
    "object_key": "evidence/123/file.jpg",
    "original_filename": "file.jpg",
    "content_type": "image/jpeg",
    "upload_time_tags": ["passport", "identity"]
  }
}
```

### EvidenceObjectCreated

Emitted by onboarding/core after it receives and trusts the S3 ObjectCreated event.

This is the business upload-completion event consumed by document-analysis.

```json
{
  "version": 1,
  "event_id": "uuid",
  "event_type": "EvidenceObjectCreated",
  "occurred_at": "2026-06-22T12:01:00.000Z",
  "source": "onboarding-service",
  "data": {
    "evidence_id": 123,
    "checklist_task_id": 456,
    "provider_corporation_id": 789,
    "uploaded_by_app_user_id": 101,
    "bucket_name": "example-bucket",
    "object_key": "evidence/123/file.jpg",
    "original_filename": "file.jpg",
    "content_type": "image/jpeg",
    "upload_time_tags": ["passport", "identity"]
  }
}
```

### DocumentAnalysisCompleted

Emitted by document-analysis after Rekognition tags have been stored.

```json
{
  "version": 1,
  "event_id": "uuid",
  "event_type": "DocumentAnalysisCompleted",
  "occurred_at": "2026-06-22T12:02:00.000Z",
  "source": "document-analysis-service",
  "data": {
    "evidence_id": 123,
    "object_key": "evidence/123/file.jpg",
    "analysis_job_id": "uuid",
    "automatic_tags": [
      {
        "tag": "Passport",
        "confidence": 98.4,
        "source": "aws-rekognition"
      }
    ]
  }
}
```

## Suggested Document Analysis Schema

Create the schema:

```sql
CREATE SCHEMA IF NOT EXISTS document_analysis;
```

Minimal tables:

```sql
CREATE TABLE document_analysis.document_projection (
    evidence_id INT PRIMARY KEY,
    checklist_task_id INT NOT NULL,
    provider_corporation_id INT NULL,
    uploaded_by_app_user_id INT NULL,
    bucket_name TEXT NOT NULL,
    object_key TEXT NOT NULL UNIQUE,
    original_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    upload_time_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    upload_requested_at TIMESTAMPTZ NULL,
    object_created_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE document_analysis.analysis_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id INT NOT NULL,
    object_key TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL
);

CREATE TABLE document_analysis.analysis_tag (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_job_id UUID NOT NULL REFERENCES document_analysis.analysis_job(id) ON DELETE CASCADE,
    evidence_id INT NOT NULL,
    tag TEXT NOT NULL,
    confidence NUMERIC(5,2) NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Optional but useful:

```sql
CREATE TABLE document_analysis.analysis_event_inbox (
    event_id UUID PRIMARY KEY,
    event_type TEXT NOT NULL,
    evidence_id INT NULL,
    object_key TEXT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Even in a minimal implementation, an inbox table is acceptable because it keeps duplicate events from creating duplicate tags.

## Image Analysis Behaviour

For `image/*` uploads:

1. Create or read the document projection.
2. Create an analysis job.
3. Call Rekognition DetectLabels with the S3 bucket and object key.
4. Store returned labels in `document_analysis.analysis_tag`.
5. Mark the job completed.
6. Emit `DocumentAnalysisCompleted` if event publication is implemented in the slice.

For non-images:

1. Store the projection.
2. Do not call Rekognition.
3. Leave future document/PDF analysis out of scope.

## Frontend Behaviour

The frontend should:

1. Ask onboarding/core for an upload URL.
2. Upload the selected photo directly to S3.
3. Return the user to the checklist/task flow.

The frontend should not:

- call a finalize endpoint
- poll for object readiness
- notify the backend that upload transfer has completed
- block checklist progress on document-analysis completion

When a checklist task is viewed later, the UI should display automatic tags if
they have been generated by then. This can be implemented by having the
onboarding/core read path query the document-analysis schema for tags by
evidence id. The document-analysis service remains the owner of those tables;
onboarding/core must not write to them.

## Infrastructure

Add infrastructure for:

- document-analysis Lambda or worker
- queue from EventBridge to document-analysis
- EventBridge rule for evidence projection/upload-completion events
- S3 ObjectCreated event path to onboarding/core upload-completed consumer
- permission for document-analysis to call Rekognition
- permission for document-analysis to read the evidence bucket object
- database access for the `document_analysis` schema

Do not add DLQs.

Do not add CDK custom resource Lambdas. Infrastructure should be expressed using normal CDK constructs and service integrations only. If a deployment-time task appears to require a custom resource Lambda, leave it as a documented manual or script-driven step instead of adding one.

Avoid custom retry infrastructure in the first pass unless explicitly requested.

## Out Of Scope For First Pass

- PDF/Textract analysis
- due diligence assessment AI
- object-readiness retries
- frontend progress tracking
- frontend analysis status UI
- manual tag editing after upload
- production-grade observability
- DLQs
- CDK custom resource Lambdas
- reconciliation workers

## Handover Requirement

Every agent writing a handover for the next agent must include this exact instruction in both:

1. the handover document
2. the prompt provided to the user for the next agent

Required instruction:

```text
Wherever possible, the code should replicate or stay as close as possible to the way the code works and is written, both in style and form, in the aws10 project in this workspace.
```

## Open Questions

1. Should the S3 ObjectCreated event be consumed directly by onboarding/core, or should EventBridge route the raw S3 event to a small onboarding-owned Lambda?
2. Should checklist task completion happen immediately when onboarding receives S3 ObjectCreated, or should task completion remain separate from upload evidence status?
3. Should automatic Rekognition tags ever be shown in the current UI during this rebuild, or should they only be stored in `document_analysis` for now?
4. Should non-image uploads still be allowed as evidence, or should this simplified first pass restrict uploads to photos only?
5. Should duplicate protection use `analysis_event_inbox`, or is even that too much for the intended minimal implementation?
