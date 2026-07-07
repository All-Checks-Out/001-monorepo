import { execSync } from "node:child_process";
import { normalizeSubjectValues } from "@shared/subjects";
import { createSeedCognitoUser } from "./lib/cognitoSeed";
import { createDbClient } from "./lib/onboardingDatabase";
import { readSeedFixture, type SeedFixture } from "./lib/seedFixture";
import { getCognitoConfig } from "./lib/ssm";
import { getStage } from "./lib/stage";

type DbClient = Awaited<ReturnType<typeof createDbClient>>;

const TABLES_IN_DELETE_ORDER = [
  "provider_ddq_checklist_task_form_response",
  "provider_ddq_checklist_task",
  "provider_ddq_checklist",
  "provider_ddq_pack",
  "ddq_pack_item",
  "ddq_pack",
  "form_templates",
  "subject",
  "corporation_access_request",
  "corporation_application",
  "app_user",
  "corporation",
] as const;

const SEQUENCES_IN_RESET_ORDER = [
  "provider_ddq_checklist_task_form_response_id_seq",
  "provider_ddq_checklist_task_id_seq",
  "provider_ddq_checklist_id_seq",
  "provider_ddq_pack_id_seq",
  "ddq_pack_item_id_seq",
  "ddq_pack_id_seq",
  "form_templates_id_seq",
  "subject_id_seq",
  "corporation_access_request_id_seq",
  "corporation_application_id_seq",
  "app_user_id_seq",
  "corporation_id_seq",
] as const;

function assertSeedAllowed() {
  if (
    getStage() === "production"
    && !process.env.ACO24_SEED_USER_PASSWORD
  ) {
    throw new Error(
      "ACO24_SEED_USER_PASSWORD must be set when seeding production.",
    );
  }
}

async function clearExistingRows(client: DbClient) {
  for (const tableName of TABLES_IN_DELETE_ORDER) {
    await client.query(`DELETE FROM ${tableName}`);
  }

  for (const sequenceName of SEQUENCES_IN_RESET_ORDER) {
    await client.query(`ALTER SEQUENCE ${sequenceName} RESTART WITH 1`);
  }
}

function requireMappedId(
  map: Map<number, number>,
  legacyId: number,
  label: string,
) {
  const mappedId = map.get(legacyId);
  if (!mappedId) {
    throw new Error(`Missing seeded ${label} for legacy id ${legacyId}.`);
  }

  return mappedId;
}

async function seedCorporations(client: DbClient, fixture: SeedFixture) {
  const corporationIdMap = new Map<number, number>();

  for (const corporation of fixture.corporations) {
    const result = await client.query<{ id: number }>(
      `INSERT INTO corporation (name, type, status)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [corporation.name, corporation.type, corporation.status],
    );

    corporationIdMap.set(corporation.legacyId, result.rows[0].id);
  }

  return corporationIdMap;
}

async function seedUsers(
  client: DbClient,
  fixture: SeedFixture,
  corporationIdMap: Map<number, number>,
) {
  const cognitoConfig = await getCognitoConfig();

  for (const user of fixture.users) {
    console.log(`Creating Cognito user ${user.email}...`);
    const cognitoSub = await createSeedCognitoUser(cognitoConfig, {
      email: user.email,
    });
    const corporationId = requireMappedId(
      corporationIdMap,
      user.corporationLegacyId,
      "corporation",
    );

    await client.query(
      `INSERT INTO app_user (corporation_id, cognito_sub, email, status, permissions)
       VALUES ($1, $2, $3, $4, $5)`,
      [corporationId, cognitoSub, user.email, user.status, user.permissions],
    );
  }
}

async function seedSubjects(
  client: DbClient,
  fixture: SeedFixture,
  corporationIdMap: Map<number, number>,
) {
  const subjectLegacyIds = new Set<string>();

  for (const subject of fixture.subjects) {
    if (subjectLegacyIds.has(subject.legacyId)) {
      throw new Error(`Duplicate seeded subject legacy id ${subject.legacyId}.`);
    }
    subjectLegacyIds.add(subject.legacyId);

    const providerCorporationId = requireMappedId(
      corporationIdMap,
      subject.providerCorporationLegacyId,
      "provider corporation",
    );
    const validation = normalizeSubjectValues(
      subject.subjectTypeKey,
      subject.values,
    );

    if (!validation.valid) {
      throw new Error(
        `Invalid seeded subject ${subject.legacyId}: ${validation.error}`,
      );
    }

    await client.query(
      `INSERT INTO subject (
         provider_corporation_id,
         subject_type_key,
         display_name,
         values_json
       )
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        providerCorporationId,
        subject.subjectTypeKey,
        subject.displayName,
        JSON.stringify(validation.values),
      ],
    );
  }
}

async function seedApplications(
  client: DbClient,
  fixture: SeedFixture,
  corporationIdMap: Map<number, number>,
) {
  for (const application of fixture.corporationApplications) {
    const providerCorporationId = application.providerCorporationLegacyId
      ? requireMappedId(
          corporationIdMap,
          application.providerCorporationLegacyId,
          "provider corporation",
        )
      : null;

    await client.query(
      `INSERT INTO corporation_application
       (name, type, applicant_email, status, provider_corporation_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        application.name,
        application.type,
        application.applicantEmail,
        application.status,
        providerCorporationId,
      ],
    );
  }
}

async function seedAccessRequests(
  client: DbClient,
  fixture: SeedFixture,
  corporationIdMap: Map<number, number>,
) {
  for (const accessRequest of fixture.corporationAccessRequests) {
    const requesterCorporationId = requireMappedId(
      corporationIdMap,
      accessRequest.requesterCorporationLegacyId,
      "requester corporation",
    );
    const providerCorporationId = requireMappedId(
      corporationIdMap,
      accessRequest.providerCorporationLegacyId,
      "provider corporation",
    );

    await client.query(
      `INSERT INTO corporation_access_request
       (requester_corporation_id, provider_corporation_id, status)
       VALUES ($1, $2, $3)`,
      [requesterCorporationId, providerCorporationId, accessRequest.status],
    );
  }
}

async function seedDDQPacks(
  client: DbClient,
  fixture: SeedFixture,
  corporationIdMap: Map<number, number>,
) {
  const ddqPackIdMap = new Map<number, number>();
  const ddqPackItemIdMap = new Map<number, number>();

  for (const pack of fixture.ddqPacks) {
    const associationCorporationId = requireMappedId(
      corporationIdMap,
      pack.associationCorporationLegacyId,
      "association corporation",
    );
    const packResult = await client.query<{ id: number }>(
      `INSERT INTO ddq_pack
       (association_corporation_id, name, valid_from, valid_to, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        associationCorporationId,
        pack.name,
        pack.validFrom,
        pack.validTo,
        pack.status,
      ],
    );
    const packId = packResult.rows[0].id;
    ddqPackIdMap.set(pack.legacyId, packId);

    for (const item of pack.items) {
      const itemResult = await client.query<{ id: number }>(
        `INSERT INTO ddq_pack_item
         (pack_id, position, kind, task_type, title, config)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          packId,
          item.position,
          item.kind,
          item.taskType,
          item.title,
          JSON.stringify(item.config),
        ],
      );
      ddqPackItemIdMap.set(item.legacyId, itemResult.rows[0].id);
    }
  }

  return { ddqPackIdMap, ddqPackItemIdMap };
}

async function seedFormTemplates(
  client: DbClient,
  fixture: SeedFixture,
  corporationIdMap: Map<number, number>,
) {
  const formTemplateIdMap = new Map<number, number>();

  for (const template of fixture.formTemplates) {
    const associationCorporationId = requireMappedId(
      corporationIdMap,
      template.associationCorporationLegacyId,
      "association corporation",
    );

    const result = await client.query<{ id: number }>(
      `INSERT INTO form_templates
       (association_corporation_id, short_name, description, schema_json)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [
        associationCorporationId,
        template.shortName,
        template.description,
        JSON.stringify(template.schema),
      ],
    );

    formTemplateIdMap.set(template.legacyId, result.rows[0].id);
  }

  return formTemplateIdMap;
}

async function seedProviderDDQPacks(
  client: DbClient,
  fixture: SeedFixture,
  corporationIdMap: Map<number, number>,
  ddqPackIdMap: Map<number, number>,
) {
  const providerDDQPackIdMap = new Map<number, number>();

  for (const poolItem of fixture.providerDDQPacks) {
    const providerCorporationId = requireMappedId(
      corporationIdMap,
      poolItem.providerCorporationLegacyId,
      "provider corporation",
    );
    const ddqPackId = requireMappedId(
      ddqPackIdMap,
      poolItem.ddqPackLegacyId,
      "DDQ Pack",
    );

    const result = await client.query<{ id: number }>(
      `INSERT INTO provider_ddq_pack (provider_corporation_id, ddq_pack_id)
       VALUES ($1, $2)
       RETURNING id`,
      [providerCorporationId, ddqPackId],
    );

    providerDDQPackIdMap.set(poolItem.legacyId, result.rows[0].id);
  }

  return providerDDQPackIdMap;
}

async function seedProviderDDQChecklists(
  client: DbClient,
  fixture: SeedFixture,
  providerDDQPackIdMap: Map<number, number>,
  ddqPackItemIdMap: Map<number, number>,
) {
  for (const checklist of fixture.providerDDQChecklists) {
    const providerDDQPackId = requireMappedId(
      providerDDQPackIdMap,
      checklist.providerDDQPackLegacyId,
      "provider DDQ Pack",
    );

    const checklistResult = await client.query<{ id: number }>(
      `INSERT INTO provider_ddq_checklist (provider_ddq_pack_id, status)
       VALUES ($1, $2)
       RETURNING id`,
      [providerDDQPackId, checklist.status],
    );
    const checklistId = checklistResult.rows[0].id;

    for (const task of checklist.tasks) {
      const ddqPackItemId = requireMappedId(
        ddqPackItemIdMap,
        task.ddqPackItemLegacyId,
        "DDQ Pack Item",
      );

      await client.query(
        `INSERT INTO provider_ddq_checklist_task
         (checklist_id, ddq_pack_item_id, status)
         VALUES ($1, $2, $3)`,
        [checklistId, ddqPackItemId, task.status],
      );
    }
  }
}

async function main() {
  assertSeedAllowed();

  console.log("Ensuring onboarding database schema is up to date...");
  execSync("pnpm exec tsx scripts/src/database-migrate.ts", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  console.log("");

  const fixture = await readSeedFixture();
  const client = await createDbClient();

  try {
    await client.query("BEGIN");
    await clearExistingRows(client);
    const corporationIdMap = await seedCorporations(client, fixture);
    await seedUsers(client, fixture, corporationIdMap);
    await seedSubjects(client, fixture, corporationIdMap);
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
    `Seeded ${fixture.corporations.length} corporation(s), ${fixture.users.length} Cognito/database user(s), ${fixture.corporationApplications.length} application(s), ${fixture.corporationAccessRequests.length} access request(s), ${fixture.ddqPacks.length} DDQ Pack(s), ${fixture.formTemplates.length} form template(s), ${fixture.providerDDQPacks.length} provider DDQ Pack(s), ${fixture.providerDDQChecklists.length} DDQ Checklist(s), and ${fixture.subjects.length} Subject(s).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
