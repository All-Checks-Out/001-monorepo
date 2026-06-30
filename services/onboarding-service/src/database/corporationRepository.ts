import type { Client } from "pg";
import type { CorporationRow } from "./onboardingTypes";

export async function listApprovedProviders(client: Client) {
  const result = await client.query<Pick<CorporationRow, "id" | "name">>(
    `SELECT id, name
       FROM corporation
      WHERE type = 'PROVIDER'
        AND status = 'approved'
      ORDER BY name`,
  );

  return result.rows;
}

export async function getCorporationById(client: Client, id: number) {
  const result = await client.query<CorporationRow>(
    "SELECT id, name, type, status FROM corporation WHERE id = $1",
    [id],
  );

  return result.rows[0] ?? null;
}

export async function listCorporations(client: Client) {
  const result = await client.query<CorporationRow>(
    "SELECT id, name, type, status FROM corporation ORDER BY name",
  );

  return result.rows;
}

export async function createApprovedCorporation(
  client: Client,
  input: Pick<CorporationRow, "name" | "type">,
) {
  const result = await client.query<CorporationRow>(
    `INSERT INTO corporation (name, type, status)
     VALUES ($1, $2, 'approved')
     RETURNING id, name, type, status`,
    [input.name, input.type],
  );

  return result.rows[0];
}

