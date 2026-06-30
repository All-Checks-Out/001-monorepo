import type { Client } from "pg";
import type {
  ChecklistEvidenceTagSource,
  DDQPackRow,
  ProviderDDQChecklistRow,
  ProviderDDQChecklistTaskEvidenceRow,
  ProviderDDQChecklistTaskEvidenceTagRow,
  ProviderDDQChecklistTaskWithItemRow,
} from "./onboardingTypes";

export type ProviderDDQChecklistTaskContextRows = {
  pack: DDQPackRow | null;
  checklist: ProviderDDQChecklistRow | null;
  task: ProviderDDQChecklistTaskWithItemRow | null;
};

type ChecklistTaskContextJoinRow = DDQPackRow & {
  checklist_id: number;
  provider_ddq_pack_id: number;
  checklist_status: ProviderDDQChecklistRow["status"];
  checklist_created_at: string;
  checklist_updated_at: string;
  task_id: number;
  task_checklist_id: number;
  task_ddq_pack_item_id: number;
  task_status: ProviderDDQChecklistTaskWithItemRow["status"];
  task_created_at: string;
  task_updated_at: string;
  position: number;
  kind: ProviderDDQChecklistTaskWithItemRow["kind"];
  task_type: ProviderDDQChecklistTaskWithItemRow["task_type"];
  title: string;
  config: Record<string, unknown>;
};

type EvidenceContextRow = ProviderDDQChecklistTaskEvidenceRow & {
  checklist_id: number;
  checklist_status: ProviderDDQChecklistRow["status"];
  provider_corporation_id: number;
  task_status: ProviderDDQChecklistTaskWithItemRow["status"];
};

const evidenceSelect = `
  SELECT id,
         checklist_task_id,
         uploaded_by_app_user_id,
         object_key,
         original_filename,
         content_type,
         file_size_bytes::bigint::int AS file_size_bytes,
         status,
         created_at::text AS created_at,
         uploaded_at::text AS uploaded_at,
         replaced_at::text AS replaced_at
    FROM provider_ddq_checklist_task_evidence
`;

export async function readProviderDDQChecklistTaskContext(
  client: Client,
  providerCorporationId: number,
  ddqPackId: number,
  taskId: number,
): Promise<ProviderDDQChecklistTaskContextRows> {
  const result = await client.query<ChecklistTaskContextJoinRow>(
    `SELECT dp.id,
            dp.association_corporation_id,
            dp.name,
            dp.valid_from::text AS valid_from,
            dp.valid_to::text AS valid_to,
            dp.status AS status,
            dp.created_at::text AS created_at,
            pc.id AS checklist_id,
            pc.provider_ddq_pack_id,
            pc.status AS checklist_status,
            pc.created_at::text AS checklist_created_at,
            pc.updated_at::text AS checklist_updated_at,
            pct.id AS task_id,
            pct.checklist_id AS task_checklist_id,
            pct.ddq_pack_item_id AS task_ddq_pack_item_id,
            pct.status AS task_status,
            pct.created_at::text AS task_created_at,
            pct.updated_at::text AS task_updated_at,
            dpi.position,
            dpi.kind,
            dpi.task_type,
            dpi.title,
            dpi.config
       FROM provider_ddq_pack pdp
       JOIN ddq_pack dp ON dp.id = pdp.ddq_pack_id
       JOIN provider_ddq_checklist pc ON pc.provider_ddq_pack_id = pdp.id
       JOIN provider_ddq_checklist_task pct ON pct.checklist_id = pc.id
       JOIN ddq_pack_item dpi ON dpi.id = pct.ddq_pack_item_id
      WHERE pdp.provider_corporation_id = $1
        AND pdp.ddq_pack_id = $2
        AND pct.id = $3`,
    [providerCorporationId, ddqPackId, taskId],
  );
  const row = result.rows[0];

  if (!row) {
    return { pack: null, checklist: null, task: null };
  }

  return {
    pack: {
      id: row.id,
      association_corporation_id: row.association_corporation_id,
      name: row.name,
      valid_from: row.valid_from,
      valid_to: row.valid_to,
      status: row.status,
      created_at: row.created_at,
    },
    checklist: {
      id: row.checklist_id,
      provider_ddq_pack_id: row.provider_ddq_pack_id,
      status: row.checklist_status,
      created_at: row.checklist_created_at,
      updated_at: row.checklist_updated_at,
    },
    task: {
      id: row.task_id,
      checklist_id: row.task_checklist_id,
      ddq_pack_item_id: row.task_ddq_pack_item_id,
      status: row.task_status,
      created_at: row.task_created_at,
      updated_at: row.task_updated_at,
      position: row.position,
      kind: row.kind,
      task_type: row.task_type,
      title: row.title,
      config: row.config,
    },
  };
}

export async function createPendingChecklistTaskEvidence(
  client: Client,
  evidence: {
    checklistTaskId: number;
    uploadedByAppUserId: number;
    objectKey: string;
    originalFilename: string;
    contentType: string;
    fileSizeBytes: number;
  },
) {
  const result = await client.query<ProviderDDQChecklistTaskEvidenceRow>(
    `INSERT INTO provider_ddq_checklist_task_evidence (
       checklist_task_id,
       uploaded_by_app_user_id,
       object_key,
       original_filename,
       content_type,
       file_size_bytes,
       status
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'pending_upload')
     RETURNING id,
               checklist_task_id,
               uploaded_by_app_user_id,
               object_key,
               original_filename,
               content_type,
               file_size_bytes::bigint::int AS file_size_bytes,
               status,
               created_at::text AS created_at,
               uploaded_at::text AS uploaded_at,
               replaced_at::text AS replaced_at`,
    [
      evidence.checklistTaskId,
      evidence.uploadedByAppUserId,
      evidence.objectKey,
      evidence.originalFilename,
      evidence.contentType,
      evidence.fileSizeBytes,
    ],
  );

  return result.rows[0];
}

export async function readChecklistTaskEvidence(
  client: Client,
  checklistTaskId: number,
  evidenceId: number,
) {
  const result = await client.query<ProviderDDQChecklistTaskEvidenceRow>(
    `${evidenceSelect}
      WHERE checklist_task_id = $1
        AND id = $2`,
    [checklistTaskId, evidenceId],
  );

  return result.rows[0] ?? null;
}

export async function readChecklistTaskEvidenceByObjectKey(
  client: Client,
  objectKey: string,
) {
  const result = await client.query<ProviderDDQChecklistTaskEvidenceRow>(
    `${evidenceSelect}
      WHERE object_key = $1`,
    [objectKey],
  );

  return result.rows[0] ?? null;
}

export async function readChecklistTaskEvidenceContextByObjectKey(
  client: Client,
  objectKey: string,
) {
  const result = await client.query<EvidenceContextRow>(
    `SELECT e.id,
            e.checklist_task_id,
            e.uploaded_by_app_user_id,
            e.object_key,
            e.original_filename,
            e.content_type,
            e.file_size_bytes::bigint::int AS file_size_bytes,
            e.status,
            e.created_at::text AS created_at,
            e.uploaded_at::text AS uploaded_at,
            e.replaced_at::text AS replaced_at,
            pct.checklist_id,
            pct.status AS task_status,
            pc.status AS checklist_status,
            pdp.provider_corporation_id
       FROM provider_ddq_checklist_task_evidence e
       JOIN provider_ddq_checklist_task pct ON pct.id = e.checklist_task_id
       JOIN provider_ddq_checklist pc ON pc.id = pct.checklist_id
       JOIN provider_ddq_pack pdp ON pdp.id = pc.provider_ddq_pack_id
      WHERE e.object_key = $1`,
    [objectKey],
  );

  return result.rows[0] ?? null;
}

export async function readLatestUploadedChecklistTaskEvidence(
  client: Client,
  checklistTaskId: number,
) {
  const result = await client.query<ProviderDDQChecklistTaskEvidenceRow>(
    `${evidenceSelect}
      WHERE checklist_task_id = $1
        AND status = 'uploaded'
      ORDER BY uploaded_at DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    [checklistTaskId],
  );

  return result.rows[0] ?? null;
}

export async function countUploadedChecklistTaskEvidence(
  client: Client,
  checklistTaskId: number,
) {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM provider_ddq_checklist_task_evidence
      WHERE checklist_task_id = $1
        AND status = 'uploaded'`,
    [checklistTaskId],
  );

  return Number(result.rows[0]?.count ?? 0);
}

export async function markChecklistTaskEvidenceUploaded(
  client: Client,
  checklistTaskId: number,
  evidenceId: number,
) {
  const result = await client.query<ProviderDDQChecklistTaskEvidenceRow>(
    `UPDATE provider_ddq_checklist_task_evidence
        SET status = 'uploaded',
            uploaded_at = COALESCE(uploaded_at, NOW())
      WHERE checklist_task_id = $1
        AND id = $2
        AND status = 'pending_upload'
      RETURNING id,
                checklist_task_id,
                uploaded_by_app_user_id,
                object_key,
                original_filename,
                content_type,
                file_size_bytes::bigint::int AS file_size_bytes,
                status,
                created_at::text AS created_at,
                uploaded_at::text AS uploaded_at,
                replaced_at::text AS replaced_at`,
    [checklistTaskId, evidenceId],
  );

  return result.rows[0] ?? null;
}

export async function markOtherChecklistTaskEvidenceReplaced(
  client: Client,
  checklistTaskId: number,
  currentEvidenceId: number,
) {
  await client.query(
    `UPDATE provider_ddq_checklist_task_evidence
        SET status = 'replaced',
            replaced_at = NOW()
      WHERE checklist_task_id = $1
        AND id <> $2
        AND status = 'uploaded'`,
    [checklistTaskId, currentEvidenceId],
  );
}

export async function readChecklistTaskEvidenceTags(
  client: Client,
  evidenceId: number,
) {
  const result = await client.query<ProviderDDQChecklistTaskEvidenceTagRow>(
    `SELECT evidence_id,
            tag,
            source,
            created_at::text AS created_at
       FROM provider_ddq_checklist_task_evidence_tag
      WHERE evidence_id = $1
      ORDER BY source, tag`,
    [evidenceId],
  );

  return result.rows;
}

export async function readChecklistTaskAutomaticEvidenceTags(
  client: Client,
  evidenceId: number,
) {
  const result = await client.query<ProviderDDQChecklistTaskEvidenceTagRow>(
    `SELECT evidence_id,
            LOWER(tag) AS tag,
            'recognition' AS source,
            MIN(created_at)::text AS created_at
       FROM document_analysis.analysis_tag
      WHERE evidence_id = $1
      GROUP BY evidence_id, LOWER(tag)
      ORDER BY LOWER(tag)`,
    [evidenceId],
  );

  return result.rows;
}

export async function replaceChecklistTaskEvidenceTags(
  client: Client,
  evidenceId: number,
  tags: string[],
  source: ChecklistEvidenceTagSource,
) {
  await client.query(
    `DELETE FROM provider_ddq_checklist_task_evidence_tag
      WHERE evidence_id = $1
        AND source = $2`,
    [evidenceId, source],
  );

  for (const tag of tags) {
    await client.query(
      `INSERT INTO provider_ddq_checklist_task_evidence_tag (evidence_id, tag, source)
       VALUES ($1, $2, $3)
       ON CONFLICT (evidence_id, tag, source) DO NOTHING`,
      [evidenceId, tag, source],
    );
  }
}
