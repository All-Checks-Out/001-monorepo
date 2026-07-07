import type { Client } from "pg";
import type {
  DDQChecklistStatus,
  ProviderDDQChecklistBranchSelectionRow,
  DDQPackRow,
  ProviderDDQChecklistRow,
  ProviderDDQChecklistTaskWithItemRow,
} from "./onboardingTypes";

export type ProviderDDQPackPoolItemRow = {
  id: number;
  provider_corporation_id: number;
  ddq_pack_id: number;
  created_at: string;
};

type ChecklistWithPackRows = {
  pack: DDQPackRow | null;
  checklist: ProviderDDQChecklistRow | null;
  tasks: ProviderDDQChecklistTaskWithItemRow[];
  branchSelections: ProviderDDQChecklistBranchSelectionRow[];
};

type ChecklistPackJoinRow = DDQPackRow & {
  checklist_id: number;
  provider_ddq_pack_id: number;
  checklist_status: DDQChecklistStatus;
  checklist_created_at: string;
  checklist_updated_at: string;
};

const checklistSelect = `
  SELECT id,
         provider_ddq_pack_id,
         status,
         created_at::text AS created_at,
         updated_at::text AS updated_at
    FROM provider_ddq_checklist
`;

const checklistTaskSelect = `
  SELECT pct.id,
         pct.checklist_id,
         pct.ddq_pack_item_id,
         pct.status,
         pct.created_at::text AS created_at,
         pct.updated_at::text AS updated_at,
         dpi.position,
         dpi.kind,
         dpi.task_type,
         dpi.title,
         dpi.config,
         dpi.parent_branch_item_id,
         dpi.parent_branch_option_id
    FROM provider_ddq_checklist_task pct
    JOIN ddq_pack_item dpi ON dpi.id = pct.ddq_pack_item_id
`;

const branchSelectionSelect = `
  SELECT id,
         checklist_id,
         branch_pack_item_id,
         selected_option_id,
         created_at::text AS created_at,
         updated_at::text AS updated_at
    FROM provider_ddq_checklist_branch_selection
`;

export async function getProviderDDQPackPoolItem(
  client: Client,
  providerCorporationId: number,
  ddqPackId: number,
) {
  const result = await client.query<ProviderDDQPackPoolItemRow>(
    `SELECT id,
            provider_corporation_id,
            ddq_pack_id,
            created_at::text AS created_at
       FROM provider_ddq_pack
      WHERE provider_corporation_id = $1
        AND ddq_pack_id = $2`,
    [providerCorporationId, ddqPackId],
  );

  return result.rows[0] ?? null;
}

export async function getProviderDDQChecklistByPoolItem(
  client: Client,
  providerDDQPackId: number,
) {
  const result = await client.query<ProviderDDQChecklistRow>(
    `${checklistSelect} WHERE provider_ddq_pack_id = $1`,
    [providerDDQPackId],
  );

  return result.rows[0] ?? null;
}

export async function createProviderDDQChecklist(
  client: Client,
  providerDDQPackId: number,
) {
  const result = await client.query<ProviderDDQChecklistRow>(
    `INSERT INTO provider_ddq_checklist (provider_ddq_pack_id)
     VALUES ($1)
     ON CONFLICT (provider_ddq_pack_id) DO UPDATE
       SET provider_ddq_pack_id = EXCLUDED.provider_ddq_pack_id
     RETURNING id,
               provider_ddq_pack_id,
               status,
               created_at::text AS created_at,
               updated_at::text AS updated_at`,
    [providerDDQPackId],
  );

  return result.rows[0];
}

export async function createMissingProviderDDQChecklistTasks(
  client: Client,
  checklistId: number,
  ddqPackId: number,
) {
  await client.query(
    `INSERT INTO provider_ddq_checklist_task (checklist_id, ddq_pack_item_id)
     SELECT $1, dpi.id
       FROM ddq_pack_item dpi
      WHERE dpi.pack_id = $2
        AND dpi.parent_branch_item_id IS NULL
        AND dpi.parent_branch_option_id IS NULL
     ON CONFLICT (checklist_id, ddq_pack_item_id) DO NOTHING`,
    [checklistId, ddqPackId],
  );
}

export async function createMissingProviderDDQChecklistTasksForBranchOption(
  client: Client,
  checklistId: number,
  branchPackItemId: number,
  optionId: string,
) {
  await client.query(
    `INSERT INTO provider_ddq_checklist_task (checklist_id, ddq_pack_item_id)
     SELECT $1, dpi.id
       FROM ddq_pack_item dpi
      WHERE dpi.parent_branch_item_id = $2
        AND dpi.parent_branch_option_id = $3
      ON CONFLICT (checklist_id, ddq_pack_item_id) DO NOTHING`,
    [checklistId, branchPackItemId, optionId],
  );
}

export async function readProviderDDQChecklist(
  client: Client,
  providerCorporationId: number,
  ddqPackId: number,
): Promise<ChecklistWithPackRows> {
  const packResult = await client.query<ChecklistPackJoinRow>(
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
            pc.updated_at::text AS checklist_updated_at
       FROM provider_ddq_pack pdp
       JOIN ddq_pack dp ON dp.id = pdp.ddq_pack_id
       JOIN provider_ddq_checklist pc ON pc.provider_ddq_pack_id = pdp.id
      WHERE pdp.provider_corporation_id = $1
        AND pdp.ddq_pack_id = $2`,
    [providerCorporationId, ddqPackId],
  );
  const row = packResult.rows[0];

  if (!row) {
    return { pack: null, checklist: null, tasks: [], branchSelections: [] };
  }

  const tasksResult = await client.query<ProviderDDQChecklistTaskWithItemRow>(
    `${checklistTaskSelect}
      WHERE pct.checklist_id = $1
      ORDER BY COALESCE(dpi.parent_branch_item_id, 0),
               COALESCE(dpi.parent_branch_option_id, ''),
               dpi.position,
               dpi.id`,
    [row.checklist_id],
  );

  const selectionsResult = await client.query<ProviderDDQChecklistBranchSelectionRow>(
    `${branchSelectionSelect}
      WHERE checklist_id = $1
      ORDER BY branch_pack_item_id`,
    [row.checklist_id],
  );

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
    tasks: tasksResult.rows,
    branchSelections: selectionsResult.rows,
  };
}

export async function getProviderDDQChecklistBranchTask(
  client: Client,
  providerCorporationId: number,
  ddqPackId: number,
  branchTaskId: number,
) {
  const result = await client.query<ProviderDDQChecklistTaskWithItemRow>(
    `${checklistTaskSelect}
      JOIN provider_ddq_checklist pc ON pc.id = pct.checklist_id
      JOIN provider_ddq_pack pdp ON pdp.id = pc.provider_ddq_pack_id
      WHERE pdp.provider_corporation_id = $1
        AND pdp.ddq_pack_id = $2
        AND pct.id = $3
        AND dpi.kind = 'branch'`,
    [providerCorporationId, ddqPackId, branchTaskId],
  );

  return result.rows[0] ?? null;
}

export async function upsertProviderDDQChecklistBranchSelection(
  client: Client,
  checklistId: number,
  branchPackItemId: number,
  selectedOptionId: string,
) {
  const result = await client.query<ProviderDDQChecklistBranchSelectionRow>(
    `INSERT INTO provider_ddq_checklist_branch_selection (
       checklist_id,
       branch_pack_item_id,
       selected_option_id
     )
     VALUES ($1, $2, $3)
     ON CONFLICT (checklist_id, branch_pack_item_id) DO UPDATE
       SET selected_option_id = EXCLUDED.selected_option_id,
           updated_at = NOW()
     RETURNING id,
               checklist_id,
               branch_pack_item_id,
               selected_option_id,
               created_at::text AS created_at,
               updated_at::text AS updated_at`,
    [checklistId, branchPackItemId, selectedOptionId],
  );

  return result.rows[0];
}

export async function getProviderDDQChecklistBranchSelection(
  client: Client,
  checklistId: number,
  branchPackItemId: number,
) {
  const result = await client.query<ProviderDDQChecklistBranchSelectionRow>(
    `${branchSelectionSelect}
      WHERE checklist_id = $1
        AND branch_pack_item_id = $2`,
    [checklistId, branchPackItemId],
  );

  return result.rows[0] ?? null;
}

export async function deleteProviderDDQChecklistWorkForBranchOption(
  client: Client,
  checklistId: number,
  branchPackItemId: number,
  optionId: string,
) {
  await client.query(
    `WITH RECURSIVE subtree AS (
       SELECT id
         FROM ddq_pack_item
        WHERE parent_branch_item_id = $2
          AND parent_branch_option_id = $3
       UNION ALL
       SELECT child.id
         FROM ddq_pack_item child
         JOIN subtree parent ON child.parent_branch_item_id = parent.id
     )
     DELETE FROM provider_ddq_checklist_branch_selection selection
      USING subtree
      WHERE selection.checklist_id = $1
        AND selection.branch_pack_item_id = subtree.id`,
    [checklistId, branchPackItemId, optionId],
  );

  await client.query(
    `WITH RECURSIVE subtree AS (
       SELECT id
         FROM ddq_pack_item
        WHERE parent_branch_item_id = $2
          AND parent_branch_option_id = $3
       UNION ALL
       SELECT child.id
         FROM ddq_pack_item child
         JOIN subtree parent ON child.parent_branch_item_id = parent.id
     )
     DELETE FROM provider_ddq_checklist_task task
      USING subtree
      WHERE task.checklist_id = $1
        AND task.ddq_pack_item_id = subtree.id`,
    [checklistId, branchPackItemId, optionId],
  );
}

export async function updateProviderDDQChecklistStatus(
  client: Client,
  checklistId: number,
  status: DDQChecklistStatus,
) {
  const result = await client.query<ProviderDDQChecklistRow>(
    `UPDATE provider_ddq_checklist
        SET status = $2,
            updated_at = NOW()
      WHERE id = $1
      RETURNING id,
                provider_ddq_pack_id,
                status,
                created_at::text AS created_at,
                updated_at::text AS updated_at`,
    [checklistId, status],
  );

  return result.rows[0] ?? null;
}

export async function updateProviderDDQChecklistTaskStatus(
  client: Client,
  checklistId: number,
  taskId: number,
  status: DDQChecklistStatus,
) {
  const result = await client.query<ProviderDDQChecklistTaskWithItemRow>(
    `${checklistTaskSelect}
      WHERE pct.checklist_id = $1
        AND pct.id = $2`,
    [checklistId, taskId],
  );
  const existing = result.rows[0];

  if (!existing) return null;

  const updateResult = await client.query<ProviderDDQChecklistTaskWithItemRow>(
    `UPDATE provider_ddq_checklist_task
        SET status = $3,
            updated_at = NOW()
      WHERE checklist_id = $1
        AND id = $2
      RETURNING id,
                checklist_id,
                ddq_pack_item_id,
                status,
                created_at::text AS created_at,
                updated_at::text AS updated_at`,
    [checklistId, taskId, status],
  );

  return {
    ...existing,
    ...updateResult.rows[0],
  };
}

export async function countProviderDDQChecklistTasksByStatus(
  client: Client,
  checklistId: number,
) {
  const result = await client.query<{ status: DDQChecklistStatus; count: string }>(
    `SELECT status, COUNT(*)::text AS count
       FROM provider_ddq_checklist_task
      WHERE checklist_id = $1
      GROUP BY status`,
    [checklistId],
  );

  return result.rows.reduce<Record<DDQChecklistStatus, number>>(
    (counts, row) => ({
      ...counts,
      [row.status]: Number(row.count),
    }),
    { active: 0, completed: 0, withdrawn: 0 },
  );
}
