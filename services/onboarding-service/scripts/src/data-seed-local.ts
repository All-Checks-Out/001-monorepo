import { createDbClient } from "../../src/database/db";
import {
  clearSeededDatabaseRows,
  seedAccessRequests,
  seedApplications,
  seedCorporations,
  seedDDQPacks,
  seedFormTemplates,
  seedProviderDDQChecklists,
  seedProviderDDQPacks,
  seedUsers,
} from "../../src/database/seedDataRepository";
import { readSeedFixture } from "./lib/seedFixture";

function localCognitoSub(email: string) {
  return `local:${email.toLowerCase()}`;
}

async function main() {
  if (process.env.APP_ENV !== "local") {
    throw new Error("Local seed can only run with APP_ENV=local.");
  }

  const fixture = await readSeedFixture();
  const client = await createDbClient();

  try {
    const userCount = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM app_user",
    );

    if (Number(userCount.rows[0]?.count ?? 0) > 0) {
      console.log("Local database already has users; leaving existing data in place.");
      return;
    }

    await client.query("BEGIN");
    await clearSeededDatabaseRows(client);
    const corporationIdMap = await seedCorporations(client, fixture);
    await seedUsers(client, fixture, corporationIdMap, async (email) => {
      return localCognitoSub(email);
    });
    await seedApplications(client, fixture, corporationIdMap);
    await seedAccessRequests(client, fixture, corporationIdMap);
    const { ddqPackIdMap, ddqPackItemIdMap } = await seedDDQPacks(
      client,
      fixture,
      corporationIdMap,
    );
    await seedFormTemplates(client, fixture, corporationIdMap);
    const providerDDQPackIdMap = await seedProviderDDQPacks(
      client,
      fixture,
      corporationIdMap,
      ddqPackIdMap,
    );
    await seedProviderDDQChecklists(
      client,
      fixture,
      providerDDQPackIdMap,
      ddqPackItemIdMap,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log(
    `Seeded ${fixture.users.length} local database user(s), ${fixture.ddqPacks.length} DDQ Pack(s), ${fixture.formTemplates.length} form template(s), ${fixture.providerDDQPacks.length} provider DDQ Pack(s), and ${fixture.providerDDQChecklists.length} DDQ Checklist(s) without Cognito.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
