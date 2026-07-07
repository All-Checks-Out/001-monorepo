import type { Client } from "pg";
import { normalizeSubjectValues, subjectDisplayName } from "@shared/subjects";
import type { SeedFixture } from "../../scripts/src/lib/seedFixture";

const TABLES_IN_RESET_ORDER = [
  "document_analysis.analysis_tag",
  "document_analysis.analysis_job",
  "document_analysis.analysis_event_inbox",
  "document_analysis.document_projection",
  "provider_ddq_checklist_task_form_response",
  "provider_ddq_checklist_task_evidence_tag",
  "provider_ddq_checklist_task_evidence",
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

export async function clearSeededDatabaseRows(client: Client) {
  await client.query(
    `TRUNCATE TABLE ${TABLES_IN_RESET_ORDER.join(", ")} RESTART IDENTITY CASCADE`,
  );
}

export async function seedCorporations(client: Client, fixture: SeedFixture) {
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

export async function seedUsers(
  client: Client,
  fixture: SeedFixture,
  corporationIdMap: Map<number, number>,
  getCognitoSub: (email: string) => Promise<string>,
) {
  for (const user of fixture.users) {
    const cognitoSub = await getCognitoSub(user.email);
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

export async function seedSubjects(
  client: Client,
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
        subjectDisplayName(subject.subjectTypeKey, validation.values),
        JSON.stringify(validation.values),
      ],
    );
  }
}

export async function seedApplications(
  client: Client,
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

export async function seedAccessRequests(
  client: Client,
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

export async function seedDDQPacks(
  client: Client,
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

export async function seedFormTemplates(
  client: Client,
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

export async function seedProviderDDQPacks(
  client: Client,
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

export async function seedProviderDDQChecklists(
  client: Client,
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
