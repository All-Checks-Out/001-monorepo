import type { Client } from "pg";
import type {
  DDQPackItemKind,
  DDQPackItemRow,
  DDQPackRow,
  DDQPackStatus,
  DDQTaskType,
  ProviderDDQPackRow,
} from "./onboardingTypes";

type PackInput = {
  name: string;
  validFrom: string;
  validTo: string;
};

type ItemInput = {
  kind: DDQPackItemKind;
  taskType: DDQTaskType | null;
  title: string;
  config: Record<string, unknown>;
};

const packSelect = `
  SELECT ddq_pack.id,
         ddq_pack.association_corporation_id,
         ddq_pack.name,
         ddq_pack.valid_from::text AS valid_from,
         ddq_pack.valid_to::text AS valid_to,
         ddq_pack.status,
         ddq_pack.created_at::text AS created_at
    FROM ddq_pack
`;

const itemSelect = `
  SELECT id,
         pack_id,
         position,
         kind,
         task_type,
         title,
         config,
         created_at::text AS created_at
    FROM ddq_pack_item
`;

export async function listDDQPacksForAssociation(
  client: Client,
  associationCorporationId: number,
) {
  const result = await client.query<DDQPackRow>(
    `${packSelect}
      WHERE association_corporation_id = $1
      ORDER BY created_at DESC, id DESC`,
    [associationCorporationId],
  );

  return result.rows;
}

export async function listProviderDDQPacks(
  client: Client,
  providerCorporationId: number,
) {
  const result = await client.query<ProviderDDQPackRow>(
    `SELECT ddq_pack.id,
            ddq_pack.association_corporation_id,
            ddq_pack.name,
            ddq_pack.valid_from::text AS valid_from,
            ddq_pack.valid_to::text AS valid_to,
            ddq_pack.status,
            ddq_pack.created_at::text AS created_at,
            pdp.id AS provider_ddq_pack_id,
            pdc.id AS checklist_id,
            pdc.status AS checklist_status
       FROM ddq_pack
       JOIN provider_ddq_pack pdp ON pdp.ddq_pack_id = ddq_pack.id
       LEFT JOIN provider_ddq_checklist pdc ON pdc.provider_ddq_pack_id = pdp.id
      WHERE pdp.provider_corporation_id = $1
      ORDER BY pdp.created_at DESC, ddq_pack.id DESC`,
    [providerCorporationId],
  );

  return result.rows;
}

export async function listAvailableProviderDDQPacks(
  client: Client,
  providerCorporationId: number,
) {
  const result = await client.query<DDQPackRow>(
    `${packSelect}
      WHERE ddq_pack.status <> 'draft'
        AND NOT EXISTS (
          SELECT 1
            FROM provider_ddq_pack pdp
           WHERE pdp.provider_corporation_id = $1
             AND pdp.ddq_pack_id = ddq_pack.id
        )
      ORDER BY ddq_pack.created_at DESC, ddq_pack.id DESC`,
    [providerCorporationId],
  );

  return result.rows;
}

export async function getDDQPack(client: Client, id: number) {
  const result = await client.query<DDQPackRow>(
    `${packSelect} WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function getDDQPackForAssociation(
  client: Client,
  associationCorporationId: number,
  id: number,
) {
  const result = await client.query<DDQPackRow>(
    `${packSelect}
      WHERE association_corporation_id = $1
        AND id = $2`,
    [associationCorporationId, id],
  );

  return result.rows[0] ?? null;
}

export async function addProviderDDQPack(
  client: Client,
  providerCorporationId: number,
  ddqPackId: number,
) {
  const result = await client.query<{ id: number }>(
    `INSERT INTO provider_ddq_pack (provider_corporation_id, ddq_pack_id)
     VALUES ($1, $2)
     ON CONFLICT (provider_corporation_id, ddq_pack_id) DO NOTHING
     RETURNING id`,
    [providerCorporationId, ddqPackId],
  );

  return Boolean(result.rows[0]);
}

export async function createDDQPackForAssociation(
  client: Client,
  associationCorporationId: number,
  input: PackInput,
) {
  const result = await client.query<DDQPackRow>(
    `INSERT INTO ddq_pack (association_corporation_id, name, valid_from, valid_to)
     VALUES ($1, $2, $3, $4)
     RETURNING id,
               association_corporation_id,
               name,
               valid_from::text AS valid_from,
               valid_to::text AS valid_to,
               status,
               created_at::text AS created_at`,
    [associationCorporationId, input.name, input.validFrom, input.validTo],
  );

  return result.rows[0];
}

export async function updateDDQPackMetadataForAssociation(
  client: Client,
  associationCorporationId: number,
  id: number,
  input: PackInput,
) {
  const result = await client.query<DDQPackRow>(
    `UPDATE ddq_pack
        SET name = $3,
            valid_from = $4,
            valid_to = $5
      WHERE association_corporation_id = $1
        AND id = $2
      RETURNING id,
                association_corporation_id,
                name,
                valid_from::text AS valid_from,
                valid_to::text AS valid_to,
                status,
                created_at::text AS created_at`,
    [associationCorporationId, id, input.name, input.validFrom, input.validTo],
  );

  return result.rows[0] ?? null;
}

export async function updateDDQPackStatusForAssociation(
  client: Client,
  associationCorporationId: number,
  id: number,
  status: DDQPackStatus,
) {
  const result = await client.query<DDQPackRow>(
    `UPDATE ddq_pack
        SET status = $3
      WHERE association_corporation_id = $1
        AND id = $2
      RETURNING id,
                association_corporation_id,
                name,
                valid_from::text AS valid_from,
                valid_to::text AS valid_to,
                status,
                created_at::text AS created_at`,
    [associationCorporationId, id, status],
  );

  return result.rows[0] ?? null;
}

export async function deleteDDQPackForAssociation(
  client: Client,
  associationCorporationId: number,
  id: number,
) {
  const result = await client.query<Pick<DDQPackRow, "id">>(
    `DELETE FROM ddq_pack
      WHERE association_corporation_id = $1
        AND id = $2
      RETURNING id`,
    [associationCorporationId, id],
  );

  return Boolean(result.rows[0]);
}

export async function listDDQPackItems(client: Client, packId: number) {
  const result = await client.query<DDQPackItemRow>(
    `${itemSelect} WHERE pack_id = $1 ORDER BY position`,
    [packId],
  );

  return result.rows;
}

export async function listDDQPackItemsForAssociation(
  client: Client,
  associationCorporationId: number,
  packId: number,
) {
  const result = await client.query<DDQPackItemRow>(
    `${itemSelect}
      WHERE pack_id = $1
        AND EXISTS (
          SELECT 1
            FROM ddq_pack
           WHERE ddq_pack.id = ddq_pack_item.pack_id
             AND ddq_pack.association_corporation_id = $2
        )
      ORDER BY position`,
    [packId, associationCorporationId],
  );

  return result.rows;
}

export async function getDDQPackItem(
  client: Client,
  packId: number,
  itemId: number,
) {
  const result = await client.query<DDQPackItemRow>(
    `${itemSelect} WHERE pack_id = $1 AND id = $2`,
    [packId, itemId],
  );

  return result.rows[0] ?? null;
}

export async function createDDQPackItemForAssociation(
  client: Client,
  associationCorporationId: number,
  packId: number,
  insertAfterItemId: number | null,
  input: ItemInput,
) {
  const pack = await getDDQPackForAssociation(client, associationCorporationId, packId);
  if (!pack) return null;

  const insertPosition = await getInsertPosition(client, packId, insertAfterItemId);
  if (insertPosition === null) return null;

  await shiftItemPositions(client, packId, insertPosition);

  const result = await client.query<DDQPackItemRow>(
    `INSERT INTO ddq_pack_item (pack_id, position, kind, task_type, title, config)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id,
               pack_id,
               position,
               kind,
               task_type,
               title,
               config,
               created_at::text AS created_at`,
    [
      packId,
      insertPosition,
      input.kind,
      input.taskType,
      input.title,
      JSON.stringify(input.config),
    ],
  );

  return result.rows[0];
}

export async function updateDDQPackItemForAssociation(
  client: Client,
  associationCorporationId: number,
  packId: number,
  itemId: number,
  input: ItemInput,
) {
  const result = await client.query<DDQPackItemRow>(
    `UPDATE ddq_pack_item
        SET kind = $4,
            task_type = $5,
            title = $6,
            config = $7
      WHERE pack_id = $1
        AND id = $2
        AND EXISTS (
          SELECT 1
            FROM ddq_pack
           WHERE ddq_pack.id = ddq_pack_item.pack_id
             AND ddq_pack.association_corporation_id = $3
        )
      RETURNING id,
                pack_id,
                position,
                kind,
                task_type,
                title,
                config,
                created_at::text AS created_at`,
    [
      packId,
      itemId,
      associationCorporationId,
      input.kind,
      input.taskType,
      input.title,
      JSON.stringify(input.config),
    ],
  );

  return result.rows[0] ?? null;
}

export async function deleteDDQPackItemForAssociation(
  client: Client,
  associationCorporationId: number,
  packId: number,
  itemId: number,
) {
  const pack = await getDDQPackForAssociation(client, associationCorporationId, packId);
  if (!pack) return false;

  const existing = await getDDQPackItem(client, packId, itemId);
  if (!existing) return false;

  await client.query("DELETE FROM ddq_pack_item WHERE pack_id = $1 AND id = $2", [
    packId,
    itemId,
  ]);
  await client.query(
    `UPDATE ddq_pack_item
        SET position = position - 1
      WHERE pack_id = $1
        AND position > $2`,
    [packId, existing.position],
  );

  return true;
}

export async function replaceDDQPackItemsForAssociation(
  client: Client,
  associationCorporationId: number,
  packId: number,
  items: ItemInput[],
) {
  const pack = await getDDQPackForAssociation(client, associationCorporationId, packId);
  if (!pack) return false;

  await client.query("DELETE FROM ddq_pack_item WHERE pack_id = $1", [packId]);

  for (const [index, item] of items.entries()) {
    await client.query(
      `INSERT INTO ddq_pack_item (pack_id, position, kind, task_type, title, config)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        packId,
        index + 1,
        item.kind,
        item.taskType,
        item.title,
        JSON.stringify(item.config),
      ],
    );
  }

  return true;
}

async function getInsertPosition(
  client: Client,
  packId: number,
  insertAfterItemId: number | null,
) {
  if (insertAfterItemId === null) return 1;

  const result = await client.query<Pick<DDQPackItemRow, "position">>(
    "SELECT position FROM ddq_pack_item WHERE pack_id = $1 AND id = $2",
    [packId, insertAfterItemId],
  );
  const item = result.rows[0];

  if (!item) return null;
  return item.position + 1;
}

async function shiftItemPositions(
  client: Client,
  packId: number,
  insertPosition: number | null,
) {
  if (insertPosition === null) return;

  await client.query(
    `UPDATE ddq_pack_item
        SET position = position + 1
      WHERE pack_id = $1
        AND position >= $2`,
    [packId, insertPosition],
  );
}
