import { createDbClient } from "./lib/onboardingDatabase";
import { type SeedFixture, writeSeedFixture } from "./lib/seedFixture";
import { getStage } from "./lib/stage";

type CorporationRow = {
  id: number;
  name: string;
  type: SeedFixture["corporations"][number]["type"];
  status: SeedFixture["corporations"][number]["status"];
};

type UserRow = {
  id: number;
  corporation_id: number;
  email: string;
  status: SeedFixture["users"][number]["status"];
  permissions: string[];
};

type ApplicationRow = {
  id: number;
  name: string;
  type: SeedFixture["corporationApplications"][number]["type"];
  applicant_email: string;
  status: SeedFixture["corporationApplications"][number]["status"];
  provider_corporation_id: number | null;
};

type AccessRequestRow = {
  id: number;
  requester_corporation_id: number;
  provider_corporation_id: number;
  status: SeedFixture["corporationAccessRequests"][number]["status"];
};

type DDQPackRow = {
  id: number;
  association_corporation_id: number;
  name: string;
  valid_from: string;
  valid_to: string;
  status: SeedFixture["ddqPacks"][number]["status"];
};

type DDQPackItemRow = {
  id: number;
  pack_id: number;
  position: number;
  kind: SeedFixture["ddqPacks"][number]["items"][number]["kind"];
  task_type: "document-upload" | "form-completion" | "photo-upload" | null;
  title: string;
  config: Record<string, unknown>;
};

type FormTemplateRow = {
  id: number;
  association_corporation_id: number;
  short_name: string;
  description: string;
  schema_json: SeedFixture["formTemplates"][number]["schema"];
};

type ProviderDDQPackRow = {
  id: number;
  provider_corporation_id: number;
  ddq_pack_id: number;
};

type ProviderDDQChecklistRow = {
  id: number;
  provider_ddq_pack_id: number;
  status: SeedFixture["providerDDQChecklists"][number]["status"];
};

type ProviderDDQChecklistTaskRow = {
  checklist_id: number;
  ddq_pack_item_id: number;
  status: SeedFixture["providerDDQChecklists"][number]["tasks"][number]["status"];
};

type SubjectRow = {
  id: number;
  provider_corporation_id: number;
  subject_type_key: string;
  display_name: string;
  values_json: SeedFixture["subjects"][number]["values"];
};

async function main() {
  const client = await createDbClient();

  try {
    const corporationResult = await client.query<CorporationRow>(
      "SELECT id, name, type, status FROM corporation ORDER BY id",
    );
    const userResult = await client.query<UserRow>(
      "SELECT id, corporation_id, email, status, permissions FROM app_user ORDER BY id",
    );
    const applicationResult = await client.query<ApplicationRow>(
      `SELECT id, name, type, applicant_email, status, provider_corporation_id
       FROM corporation_application
       ORDER BY id`,
    );
    const accessRequestResult = await client.query<AccessRequestRow>(
      `SELECT id, requester_corporation_id, provider_corporation_id, status
       FROM corporation_access_request
       ORDER BY id`,
    );
    const ddqPackResult = await client.query<DDQPackRow>(
      `SELECT id,
              association_corporation_id,
              name,
              valid_from::text AS valid_from,
              valid_to::text AS valid_to,
              status
       FROM ddq_pack
       ORDER BY id`,
    );
    const ddqPackItemResult = await client.query<DDQPackItemRow>(
      `SELECT id, pack_id, position, kind, task_type, title, config
       FROM ddq_pack_item
       ORDER BY pack_id, position`,
    );
    const formTemplateResult = await client.query<FormTemplateRow>(
      `SELECT id, association_corporation_id, short_name, description, schema_json
       FROM form_templates
       ORDER BY id`,
    );
    const providerDDQPackResult = await client.query<ProviderDDQPackRow>(
      `SELECT id, provider_corporation_id, ddq_pack_id
       FROM provider_ddq_pack
       ORDER BY id`,
    );
    const providerDDQChecklistResult =
      await client.query<ProviderDDQChecklistRow>(
        `SELECT id, provider_ddq_pack_id, status
         FROM provider_ddq_checklist
         ORDER BY id`,
      );
    const providerDDQChecklistTaskResult =
      await client.query<ProviderDDQChecklistTaskRow>(
        `SELECT checklist_id, ddq_pack_item_id, status
         FROM provider_ddq_checklist_task
         ORDER BY checklist_id, id`,
      );
    const subjectResult = await client.query<SubjectRow>(
      `SELECT id,
              provider_corporation_id,
              subject_type_key,
              display_name,
              values_json
       FROM subject
       ORDER BY provider_corporation_id, id`,
    );

    const itemsByPackId = groupBy(ddqPackItemResult.rows, (row) => row.pack_id);
    const tasksByChecklistId = groupBy(
      providerDDQChecklistTaskResult.rows,
      (row) => row.checklist_id,
    );

    const fixture: SeedFixture = {
      exportedAt: new Date().toISOString(),
      sourceStage: getStage(),
      corporations: corporationResult.rows.map((row) => ({
        legacyId: row.id,
        name: row.name,
        type: row.type,
        status: row.status,
      })),
      users: userResult.rows.map((row) => ({
        legacyId: row.id,
        corporationLegacyId: row.corporation_id,
        email: row.email,
        status: row.status,
        permissions: row.permissions,
      })),
      corporationApplications: applicationResult.rows.map((row) => ({
        legacyId: row.id,
        name: row.name,
        type: row.type,
        applicantEmail: row.applicant_email,
        status: row.status,
        providerCorporationLegacyId: row.provider_corporation_id,
      })),
      corporationAccessRequests: accessRequestResult.rows.map((row) => ({
        legacyId: row.id,
        requesterCorporationLegacyId: row.requester_corporation_id,
        providerCorporationLegacyId: row.provider_corporation_id,
        status: row.status,
      })),
      ddqPacks: ddqPackResult.rows.map((row) => ({
        legacyId: row.id,
        associationCorporationLegacyId: row.association_corporation_id,
        name: row.name,
        validFrom: row.valid_from,
        validTo: row.valid_to,
        status: row.status,
        items: (itemsByPackId.get(row.id) ?? []).map((item) => {
          if (item.kind === "checkpoint") {
            return {
              legacyId: item.id,
              position: item.position,
              kind: item.kind,
              taskType: null,
              title: item.title,
              config: item.config,
            };
          }

          if (item.task_type === null) {
            throw new Error(`DDQ task ${item.id} is missing a task type.`);
          }

          return {
            legacyId: item.id,
            position: item.position,
            kind: item.kind,
            taskType: item.task_type,
            title: item.title,
            config: item.config,
          };
        }),
      })),
      formTemplates: formTemplateResult.rows.map((row) => ({
        legacyId: row.id,
        associationCorporationLegacyId: row.association_corporation_id,
        shortName: row.short_name,
        description: row.description,
        schema: row.schema_json,
      })),
      providerDDQPacks: providerDDQPackResult.rows.map((row) => ({
        legacyId: row.id,
        providerCorporationLegacyId: row.provider_corporation_id,
        ddqPackLegacyId: row.ddq_pack_id,
      })),
      providerDDQChecklists: providerDDQChecklistResult.rows.map((row) => ({
        legacyId: row.id,
        providerDDQPackLegacyId: row.provider_ddq_pack_id,
        status: row.status,
        tasks: (tasksByChecklistId.get(row.id) ?? []).map((task) => ({
          ddqPackItemLegacyId: task.ddq_pack_item_id,
          status: task.status,
        })),
      })),
      subjects: subjectResult.rows.map((row) => ({
        legacyId: `subject-${row.id}`,
        providerCorporationLegacyId: row.provider_corporation_id,
        subjectTypeKey: row.subject_type_key,
        displayName: row.display_name,
        values: row.values_json,
      })),
    };

    const fixturePath = await writeSeedFixture(fixture);
    console.log(`Exported seed fixture to ${fixturePath}.`);
    console.log(
      `Captured ${fixture.corporations.length} corporation(s), ${fixture.users.length} user(s), ${fixture.corporationApplications.length} application(s), ${fixture.corporationAccessRequests.length} access request(s), ${fixture.ddqPacks.length} DDQ Pack(s), ${fixture.formTemplates.length} form template(s), ${fixture.providerDDQPacks.length} provider DDQ Pack(s), ${fixture.providerDDQChecklists.length} DDQ Checklist(s), and ${fixture.subjects.length} Subject(s).`,
    );
  } finally {
    await client.end();
  }
}

function groupBy<Row, Key>(
  rows: Row[],
  getKey: (row: Row) => Key,
) {
  const grouped = new Map<Key, Row[]>();

  for (const row of rows) {
    const key = getKey(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return grouped;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
