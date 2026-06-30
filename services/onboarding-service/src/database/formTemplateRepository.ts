import type { Client } from "pg";
import type {
  FormTemplateDetailRow,
  FormTemplateSchema,
  FormTemplateSummaryRow,
} from "./onboardingTypes";

export type FormTemplateInput = {
  shortName: string;
  description: string;
  schema: FormTemplateSchema;
};

const summarySelect = `
  SELECT id,
         association_corporation_id,
         short_name,
         description,
         created_at::text AS created_at,
         updated_at::text AS updated_at
    FROM form_templates
`;

const detailSelect = `
  SELECT id,
         association_corporation_id,
         short_name,
         description,
         schema_json,
         created_at::text AS created_at,
         updated_at::text AS updated_at
    FROM form_templates
`;

export async function listFormTemplatesForAssociation(
  client: Client,
  associationCorporationId: number,
) {
  const result = await client.query<FormTemplateSummaryRow>(
    `${summarySelect}
      WHERE association_corporation_id = $1
      ORDER BY created_at DESC, id DESC`,
    [associationCorporationId],
  );

  return result.rows;
}

export async function getFormTemplateForAssociation(
  client: Client,
  associationCorporationId: number,
  templateId: number,
) {
  const result = await client.query<FormTemplateDetailRow>(
    `${detailSelect}
      WHERE association_corporation_id = $1
        AND id = $2`,
    [associationCorporationId, templateId],
  );

  return result.rows[0] ?? null;
}

export async function createFormTemplateForAssociation(
  client: Client,
  associationCorporationId: number,
  input: FormTemplateInput,
) {
  const result = await client.query<FormTemplateDetailRow>(
    `INSERT INTO form_templates (
       association_corporation_id,
       short_name,
       description,
       schema_json
     )
     VALUES ($1, $2, $3, $4)
     RETURNING id,
               association_corporation_id,
               short_name,
               description,
               schema_json,
               created_at::text AS created_at,
               updated_at::text AS updated_at`,
    [
      associationCorporationId,
      input.shortName,
      input.description,
      JSON.stringify(input.schema),
    ],
  );

  return result.rows[0];
}

export async function updateFormTemplateForAssociation(
  client: Client,
  associationCorporationId: number,
  templateId: number,
  input: FormTemplateInput,
) {
  const result = await client.query<FormTemplateDetailRow>(
    `UPDATE form_templates
        SET short_name = $3,
            description = $4,
            schema_json = $5,
            updated_at = NOW()
      WHERE association_corporation_id = $1
        AND id = $2
      RETURNING id,
                association_corporation_id,
                short_name,
                description,
                schema_json,
                created_at::text AS created_at,
                updated_at::text AS updated_at`,
    [
      associationCorporationId,
      templateId,
      input.shortName,
      input.description,
      JSON.stringify(input.schema),
    ],
  );

  return result.rows[0] ?? null;
}

export async function deleteFormTemplateForAssociation(
  client: Client,
  associationCorporationId: number,
  templateId: number,
) {
  const result = await client.query<Pick<FormTemplateDetailRow, "id">>(
    `DELETE FROM form_templates
      WHERE association_corporation_id = $1
        AND id = $2
      RETURNING id`,
    [associationCorporationId, templateId],
  );

  return Boolean(result.rows[0]);
}
