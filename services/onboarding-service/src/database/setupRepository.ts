import type { Client } from "pg";
import { createAppUser } from "./appUserRepository";
import type { CorporationRow, Permission } from "./onboardingTypes";

export async function hasAssociationUser(client: Client) {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
         FROM app_user u
         JOIN corporation c ON c.id = u.corporation_id
        WHERE c.type = 'ASSOCIATION'
     )`,
  );

  return result.rows[0]?.exists ?? false;
}

export async function createRootAssociationUser(
  client: Client,
  input: {
    cognitoSub: string;
    email: string;
    permissions: Permission[];
  },
) {
  await client.query("BEGIN");

  try {
    if (await hasAssociationUser(client)) {
      await client.query("ROLLBACK");
      return null;
    }

    const corporationResult = await client.query<CorporationRow>(
      `INSERT INTO corporation (name, type, status)
       VALUES ($1, 'ASSOCIATION', 'approved')
       RETURNING id, name, type, status`,
      ["Association"],
    );
    const corporation = corporationResult.rows[0];

    const user = await createAppUser(client, {
      corporationId: corporation.id,
      cognitoSub: input.cognitoSub,
      email: input.email,
      permissions: input.permissions,
    });

    if (!user) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query("COMMIT");
    return { corporation, user };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function resetOnboardingData(client: Client) {
  await client.query(
    `TRUNCATE TABLE
       corporation_access_request,
       corporation_application,
       app_user,
       corporation
     RESTART IDENTITY CASCADE`,
  );
}
