import { createDbClient } from "../database/db";
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
} from "../database/seedDataRepository";
import {
  createRootAssociationUser,
  hasAssociationUser,
} from "../database/setupRepository";
import testingSeedData from "../../scripts/src/fixtures/testing-seed-data.json";
import { seedFixtureSchema } from "../../scripts/src/lib/seedFixture";
import {
  deleteAllCognitoUsers,
  inviteCognitoUser,
  recreateSeedCognitoUser,
} from "./cognitoAdmin";
import { getPermissionsForCorporationType } from "./permissions";
import { isLocalMode } from "../localMode";
import { localCognitoSub } from "./localIdentity";
import { ServiceError } from "./onboardingService";

export async function getRootSetupStatus() {
  const client = await createDbClient();

  try {
    const configured = await hasAssociationUser(client);
    return { configured };
  } finally {
    await client.end();
  }
}

export async function setupRootUser(email: string) {
  const client = await createDbClient();

  try {
    if (await hasAssociationUser(client)) {
      throw new ServiceError(409, "Root user is already configured.");
    }

    const cognitoSub = isLocalMode()
      ? localCognitoSub(email)
      : await inviteCognitoUser(email);
    const result = await createRootAssociationUser(client, {
      cognitoSub,
      email,
      permissions: [...getPermissionsForCorporationType("ASSOCIATION")],
    });

    if (!result) {
      throw new ServiceError(409, "Root user is already configured.");
    }

    return result;
  } finally {
    await client.end();
  }
}

async function clearDemoDatabase() {
  const client = await createDbClient();

  try {
    await client.query("BEGIN");
    await clearSeededDatabaseRows(client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

async function seedDemoDatabase(
  getCognitoSub: (user: { email: string }) => Promise<string>,
) {
  const fixture = seedFixtureSchema.parse(testingSeedData);
  const client = await createDbClient();

  try {
    await client.query("BEGIN");
    await clearSeededDatabaseRows(client);
    const corporationIdMap = await seedCorporations(client, fixture);
    await seedUsers(
      client,
      fixture,
      corporationIdMap,
      (email) => {
        const user = fixture.users.find((seedUser) => seedUser.email === email);
        if (!user) throw new Error(`Missing seed user for ${email}.`);
        return getCognitoSub({ email });
      },
    );
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

    return {
      corporations: fixture.corporations.length,
      users: fixture.users.length,
      corporationApplications: fixture.corporationApplications.length,
      corporationAccessRequests: fixture.corporationAccessRequests.length,
      ddqPacks: fixture.ddqPacks.length,
      formTemplates: fixture.formTemplates.length,
      providerDDQPacks: fixture.providerDDQPacks.length,
      providerDDQChecklists: fixture.providerDDQChecklists.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function fullFactoryResetDemoData() {
  if (isLocalMode()) {
    await clearDemoDatabase();
    return { deletedUsers: 0 };
  }

  const deletedUsers = await deleteAllCognitoUsers();
  await clearDemoDatabase();
  return { deletedUsers };
}

export async function seededFactoryResetDemoData() {
  if (isLocalMode()) {
    const seeded = await seedDemoDatabase(async (user) => localCognitoSub(user.email));
    return { deletedUsers: 0, ...seeded };
  }

  const deletedUsers = await deleteAllCognitoUsers();
  const seeded = await seedDemoDatabase(recreateSeedCognitoUser);
  return { deletedUsers, ...seeded };
}

export async function recreateSampleData() {
  if (isLocalMode()) {
    return seedDemoDatabase(async (user) => localCognitoSub(user.email));
  }

  return seedDemoDatabase((user) => inviteCognitoUser(user.email));
}
