import type { Client } from "pg";
import type { AppUserRow, AppUserWithCorporationRow, CurrentUserRow, Permission } from "./onboardingTypes";

export async function getCurrentAppUser(client: Client, cognitoSub: string) {
  const result = await client.query<CurrentUserRow>(
    `SELECT u.id,
            u.corporation_id,
            u.cognito_sub,
            u.email,
            u.status,
            u.permissions,
            c.name AS corporation_name,
            c.type AS corporation_type,
            c.status AS corporation_status
       FROM app_user u
       JOIN corporation c ON c.id = u.corporation_id
      WHERE u.cognito_sub = $1`,
    [cognitoSub],
  );

  return result.rows[0] ?? null;
}

export async function getCurrentAppUserById(client: Client, id: number) {
  const result = await client.query<CurrentUserRow>(
    `SELECT u.id,
            u.corporation_id,
            u.cognito_sub,
            u.email,
            u.status,
            u.permissions,
            c.name AS corporation_name,
            c.type AS corporation_type,
            c.status AS corporation_status
       FROM app_user u
       JOIN corporation c ON c.id = u.corporation_id
      WHERE u.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function listUsersForCorporation(client: Client, corporationId: number) {
  const result = await client.query<AppUserRow>(
    `SELECT id, corporation_id, cognito_sub, email, status, permissions
       FROM app_user
      WHERE corporation_id = $1
      ORDER BY email`,
    [corporationId],
  );

  return result.rows;
}

export async function listUsersWithCorporations(client: Client) {
  const result = await client.query<AppUserWithCorporationRow>(
    `SELECT u.id,
            u.corporation_id,
            u.cognito_sub,
            u.email,
            u.status,
            u.permissions,
            c.name AS corporation_name,
            c.type AS corporation_type
       FROM app_user u
       JOIN corporation c ON c.id = u.corporation_id
      ORDER BY LOWER(u.email),
               u.email`,
  );

  return result.rows;
}

export async function createAppUser(
  client: Client,
  input: {
    corporationId: number;
    cognitoSub: string;
    email: string;
    permissions?: Permission[];
  },
) {
  const result = await client.query<AppUserRow>(
    `INSERT INTO app_user (corporation_id, cognito_sub, email, status, permissions)
     VALUES ($1, $2, $3, 'invited', $4)
     ON CONFLICT (email) DO NOTHING
     RETURNING id, corporation_id, cognito_sub, email, status, permissions`,
    [input.corporationId, input.cognitoSub, input.email, input.permissions ?? []],
  );

  return result.rows[0] ?? null;
}

export async function getAppUserByEmail(client: Client, email: string) {
  const result = await client.query<AppUserRow>(
    `SELECT id, corporation_id, cognito_sub, email, status, permissions
       FROM app_user
      WHERE email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function getAppUserById(client: Client, id: number) {
  const result = await client.query<AppUserRow>(
    `SELECT id, corporation_id, cognito_sub, email, status, permissions
       FROM app_user
      WHERE id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function updateAppUserPermissions(
  client: Client,
  id: number,
  permissions: string[],
) {
  const result = await client.query<AppUserRow>(
    `UPDATE app_user
        SET permissions = $2
      WHERE id = $1
      RETURNING id, corporation_id, cognito_sub, email, status, permissions`,
    [id, permissions],
  );

  return result.rows[0] ?? null;
}
