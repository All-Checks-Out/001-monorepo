import type { Client } from "pg";
import type {
  FormDocument,
  ProviderDDQChecklistTaskFormResponseRow,
} from "./onboardingTypes";

const formResponseSelect = `
  SELECT id,
         checklist_task_id,
         form_document,
         created_at::text AS created_at,
         updated_at::text AS updated_at,
         completed_at::text AS completed_at
    FROM provider_ddq_checklist_task_form_response
`;

export async function readChecklistTaskFormResponse(
  client: Client,
  checklistTaskId: number,
) {
  const result = await client.query<ProviderDDQChecklistTaskFormResponseRow>(
    `${formResponseSelect} WHERE checklist_task_id = $1`,
    [checklistTaskId],
  );

  return result.rows[0] ?? null;
}

export async function upsertChecklistTaskFormResponse(
  client: Client,
  input: {
    checklistTaskId: number;
    formDocument: FormDocument;
    completedAt?: Date | null;
  },
) {
  const result = await client.query<ProviderDDQChecklistTaskFormResponseRow>(
    `INSERT INTO provider_ddq_checklist_task_form_response (
       checklist_task_id,
       form_document,
       completed_at
     )
     VALUES ($1, $2, $3)
     ON CONFLICT (checklist_task_id) DO UPDATE
       SET form_document = EXCLUDED.form_document,
           completed_at = EXCLUDED.completed_at,
           updated_at = NOW()
     RETURNING id,
               checklist_task_id,
               form_document,
               created_at::text AS created_at,
               updated_at::text AS updated_at,
               completed_at::text AS completed_at`,
    [
      input.checklistTaskId,
      JSON.stringify(input.formDocument),
      input.completedAt ?? null,
    ],
  );

  return result.rows[0];
}
