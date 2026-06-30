import type { Client } from "pg";
import type {
  EvidenceObjectCreatedEvent,
  EvidenceUploadRequestedEvent,
} from "@backend/events";

export type DocumentProjectionRow = {
  evidence_id: number;
  checklist_task_id: number;
  provider_corporation_id: number;
  uploaded_by_app_user_id: number;
  bucket_name: string;
  object_key: string;
  original_filename: string;
  content_type: string;
  upload_time_tags: string[];
  upload_requested_at: string | null;
  object_created_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AnalysisTagRow = {
  tag: string;
  confidence: number | null;
  source: "aws-rekognition";
};

const projectionSelect = `
  SELECT evidence_id,
         checklist_task_id,
         provider_corporation_id,
         uploaded_by_app_user_id,
         bucket_name,
         object_key,
         original_filename,
         content_type,
         upload_time_tags,
         upload_requested_at::text AS upload_requested_at,
         object_created_at::text AS object_created_at,
         created_at::text AS created_at,
         updated_at::text AS updated_at
    FROM document_projection
`;

export async function insertEventInbox(
  client: Client,
  event: EvidenceUploadRequestedEvent | EvidenceObjectCreatedEvent,
) {
  const result = await client.query<{ inserted: boolean }>(
    `INSERT INTO analysis_event_inbox (event_id, event_type, evidence_id, object_key, payload)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING true AS inserted`,
    [
      event.eventId,
      event.eventType,
      event.evidenceId,
      event.objectKey,
      JSON.stringify(event),
    ],
  );

  return Boolean(result.rows[0]?.inserted);
}

export async function markEventInboxProcessed(client: Client, eventId: string) {
  await client.query(
    `UPDATE analysis_event_inbox
        SET processed_at = NOW()
      WHERE event_id = $1`,
    [eventId],
  );
}

export async function upsertUploadRequestedProjection(
  client: Client,
  event: EvidenceUploadRequestedEvent,
) {
  const result = await client.query<DocumentProjectionRow>(
    `INSERT INTO document_projection (
       evidence_id,
       checklist_task_id,
       provider_corporation_id,
       uploaded_by_app_user_id,
       bucket_name,
       object_key,
       original_filename,
       content_type,
       upload_time_tags,
       upload_requested_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz)
     ON CONFLICT (evidence_id) DO UPDATE
     SET checklist_task_id = EXCLUDED.checklist_task_id,
         provider_corporation_id = EXCLUDED.provider_corporation_id,
         uploaded_by_app_user_id = EXCLUDED.uploaded_by_app_user_id,
         bucket_name = EXCLUDED.bucket_name,
         object_key = EXCLUDED.object_key,
         original_filename = EXCLUDED.original_filename,
         content_type = EXCLUDED.content_type,
         upload_time_tags = EXCLUDED.upload_time_tags,
         upload_requested_at = COALESCE(document_projection.upload_requested_at, EXCLUDED.upload_requested_at),
         updated_at = NOW()
     RETURNING evidence_id,
               checklist_task_id,
               provider_corporation_id,
               uploaded_by_app_user_id,
               bucket_name,
               object_key,
               original_filename,
               content_type,
               upload_time_tags,
               upload_requested_at::text AS upload_requested_at,
               object_created_at::text AS object_created_at,
               created_at::text AS created_at,
               updated_at::text AS updated_at`,
    [
      event.evidenceId,
      event.checklistTaskId,
      event.providerCorporationId,
      event.uploadedByAppUserId,
      event.bucketName,
      event.objectKey,
      event.originalFilename,
      event.contentType,
      JSON.stringify(event.uploadTimeTags),
      event.occurredAt,
    ],
  );

  return result.rows[0];
}

export async function upsertObjectCreatedProjection(
  client: Client,
  event: EvidenceObjectCreatedEvent,
) {
  const result = await client.query<DocumentProjectionRow>(
    `INSERT INTO document_projection (
       evidence_id,
       checklist_task_id,
       provider_corporation_id,
       uploaded_by_app_user_id,
       bucket_name,
       object_key,
       original_filename,
       content_type,
       upload_time_tags,
       object_created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::timestamptz)
     ON CONFLICT (evidence_id) DO UPDATE
     SET checklist_task_id = EXCLUDED.checklist_task_id,
         provider_corporation_id = EXCLUDED.provider_corporation_id,
         uploaded_by_app_user_id = EXCLUDED.uploaded_by_app_user_id,
         bucket_name = EXCLUDED.bucket_name,
         object_key = EXCLUDED.object_key,
         original_filename = EXCLUDED.original_filename,
         content_type = EXCLUDED.content_type,
         upload_time_tags = EXCLUDED.upload_time_tags,
         object_created_at = COALESCE(document_projection.object_created_at, EXCLUDED.object_created_at),
         updated_at = NOW()
     RETURNING evidence_id,
               checklist_task_id,
               provider_corporation_id,
               uploaded_by_app_user_id,
               bucket_name,
               object_key,
               original_filename,
               content_type,
               upload_time_tags,
               upload_requested_at::text AS upload_requested_at,
               object_created_at::text AS object_created_at,
               created_at::text AS created_at,
               updated_at::text AS updated_at`,
    [
      event.evidenceId,
      event.checklistTaskId,
      event.providerCorporationId,
      event.uploadedByAppUserId,
      event.bucketName,
      event.objectKey,
      event.originalFilename,
      event.contentType,
      JSON.stringify(event.uploadTimeTags),
      event.occurredAt,
    ],
  );

  return result.rows[0];
}

export async function readDocumentProjection(client: Client, evidenceId: number) {
  const result = await client.query<DocumentProjectionRow>(
    `${projectionSelect}
      WHERE evidence_id = $1`,
    [evidenceId],
  );

  return result.rows[0] ?? null;
}

export async function createAnalysisJob(
  client: Client,
  evidenceId: number,
  objectKey: string,
  status: "completed" | "skipped",
) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO analysis_job (evidence_id, object_key, status, completed_at)
     VALUES ($1, $2, $3, NOW())
     RETURNING id`,
    [evidenceId, objectKey, status],
  );

  return result.rows[0].id;
}

export async function replaceAnalysisTags(
  client: Client,
  analysisJobId: string,
  evidenceId: number,
  tags: AnalysisTagRow[],
) {
  await client.query("DELETE FROM analysis_tag WHERE evidence_id = $1", [evidenceId]);

  for (const tag of tags) {
    await client.query(
      `INSERT INTO analysis_tag (analysis_job_id, evidence_id, tag, confidence, source)
       VALUES ($1, $2, $3, $4, $5)`,
      [analysisJobId, evidenceId, tag.tag, tag.confidence, tag.source],
    );
  }
}
