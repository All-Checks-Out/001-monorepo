import type { Client } from "pg";
import type { SubjectRow, SubjectValues } from "./onboardingTypes";

export type SubjectFilters = {
  subjectTypeKey?: string;
  q?: string;
  includeArchived?: boolean;
};

export type SubjectInput = {
  subjectTypeKey: string;
  displayName: string;
  values: SubjectValues;
  appUserId: number;
};

const subjectSelect = `
  SELECT id,
         provider_corporation_id,
         subject_type_key,
         display_name,
         values_json,
         created_by_app_user_id,
         updated_by_app_user_id,
         archived_at::text AS archived_at,
         created_at::text AS created_at,
         updated_at::text AS updated_at
    FROM subject
`;

export async function listSubjectsForProvider(
  client: Client,
  providerCorporationId: number,
  filters: SubjectFilters,
) {
  const conditions = ["provider_corporation_id = $1"];
  const values: unknown[] = [providerCorporationId];

  if (filters.subjectTypeKey) {
    values.push(filters.subjectTypeKey);
    conditions.push(`subject_type_key = $${values.length}`);
  }

  if (filters.q) {
    values.push(filters.q);
    conditions.push(`LOWER(display_name) LIKE LOWER('%' || $${values.length} || '%')`);
  }

  if (!filters.includeArchived) {
    conditions.push("archived_at IS NULL");
  }

  const result = await client.query<SubjectRow>(
    `${subjectSelect}
      WHERE ${conditions.join(" AND ")}
      ORDER BY updated_at DESC, id DESC`,
    values,
  );

  return result.rows;
}

export async function getSubjectForProvider(
  client: Client,
  providerCorporationId: number,
  subjectId: number,
) {
  const result = await client.query<SubjectRow>(
    `${subjectSelect}
      WHERE provider_corporation_id = $1
        AND id = $2`,
    [providerCorporationId, subjectId],
  );

  return result.rows[0] ?? null;
}

export async function createSubjectForProvider(
  client: Client,
  providerCorporationId: number,
  input: SubjectInput,
) {
  const result = await client.query<SubjectRow>(
    `INSERT INTO subject (
       provider_corporation_id,
       subject_type_key,
       display_name,
       values_json,
       created_by_app_user_id,
       updated_by_app_user_id
     )
     VALUES ($1, $2, $3, $4::jsonb, $5, $5)
     RETURNING id,
               provider_corporation_id,
               subject_type_key,
               display_name,
               values_json,
               created_by_app_user_id,
               updated_by_app_user_id,
               archived_at::text AS archived_at,
               created_at::text AS created_at,
               updated_at::text AS updated_at`,
    [
      providerCorporationId,
      input.subjectTypeKey,
      input.displayName,
      JSON.stringify(input.values),
      input.appUserId,
    ],
  );

  return result.rows[0];
}

export async function updateSubjectForProvider(
  client: Client,
  providerCorporationId: number,
  subjectId: number,
  input: SubjectInput,
) {
  const result = await client.query<SubjectRow>(
    `UPDATE subject
        SET subject_type_key = $3,
            display_name = $4,
            values_json = $5::jsonb,
            updated_by_app_user_id = $6,
            updated_at = NOW()
      WHERE provider_corporation_id = $1
        AND id = $2
      RETURNING id,
                provider_corporation_id,
                subject_type_key,
                display_name,
                values_json,
                created_by_app_user_id,
                updated_by_app_user_id,
                archived_at::text AS archived_at,
                created_at::text AS created_at,
                updated_at::text AS updated_at`,
    [
      providerCorporationId,
      subjectId,
      input.subjectTypeKey,
      input.displayName,
      JSON.stringify(input.values),
      input.appUserId,
    ],
  );

  return result.rows[0] ?? null;
}

export async function archiveSubjectForProvider(
  client: Client,
  providerCorporationId: number,
  subjectId: number,
  appUserId: number,
) {
  const result = await client.query<SubjectRow>(
    `UPDATE subject
        SET archived_at = COALESCE(archived_at, NOW()),
            updated_by_app_user_id = $3,
            updated_at = NOW()
      WHERE provider_corporation_id = $1
        AND id = $2
      RETURNING id,
                provider_corporation_id,
                subject_type_key,
                display_name,
                values_json,
                created_by_app_user_id,
                updated_by_app_user_id,
                archived_at::text AS archived_at,
                created_at::text AS created_at,
                updated_at::text AS updated_at`,
    [providerCorporationId, subjectId, appUserId],
  );

  return result.rows[0] ?? null;
}
