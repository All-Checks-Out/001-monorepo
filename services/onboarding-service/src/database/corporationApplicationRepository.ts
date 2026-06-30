import type { Client } from "pg";
import type { ApplicationType, CorporationApplicationRow } from "./onboardingTypes";

export async function createCorporationApplication(
  client: Client,
  input: {
    name: string;
    type: ApplicationType;
    applicantEmail: string;
    providerCorporationId?: number | null;
  },
) {
  const result = await client.query<CorporationApplicationRow>(
    `INSERT INTO corporation_application (
       name,
       type,
       applicant_email,
       provider_corporation_id,
       status
     )
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, name, type, applicant_email, provider_corporation_id, status`,
    [input.name, input.type, input.applicantEmail, input.providerCorporationId ?? null],
  );

  return result.rows[0];
}

export async function listCorporationApplications(client: Client) {
  const result = await client.query<CorporationApplicationRow>(
    `SELECT application.id,
            application.name,
            application.type,
            application.applicant_email,
            application.provider_corporation_id,
            application.status,
            provider.name AS provider_corporation_name
       FROM corporation_application application
       LEFT JOIN corporation provider ON provider.id = application.provider_corporation_id
      ORDER BY application.id DESC`,
  );

  return result.rows;
}

export async function listProviderSetupApplications(client: Client) {
  const result = await client.query<CorporationApplicationRow>(
    `SELECT application.id,
            application.name,
            application.type,
            application.applicant_email,
            application.provider_corporation_id,
            application.status,
            provider.name AS provider_corporation_name
       FROM corporation_application application
       LEFT JOIN corporation provider ON provider.id = application.provider_corporation_id
      WHERE application.type = 'PROVIDER'
      ORDER BY application.id DESC`,
  );

  return result.rows;
}

export async function listApplicationsForProvider(client: Client, providerCorporationId: number) {
  const result = await client.query<CorporationApplicationRow>(
    `SELECT application.id,
            application.name,
            application.type,
            application.applicant_email,
            application.provider_corporation_id,
            application.status,
            provider.name AS provider_corporation_name
       FROM corporation_application application
       JOIN corporation provider ON provider.id = application.provider_corporation_id
      WHERE application.provider_corporation_id = $1
        AND application.type IN ('AGENT', 'STAKEHOLDER')
      ORDER BY application.id DESC`,
    [providerCorporationId],
  );

  return result.rows;
}

export async function getCorporationApplication(client: Client, id: number) {
  const result = await client.query<CorporationApplicationRow>(
    `SELECT application.id,
            application.name,
            application.type,
            application.applicant_email,
            application.provider_corporation_id,
            application.status,
            provider.name AS provider_corporation_name
       FROM corporation_application application
       LEFT JOIN corporation provider ON provider.id = application.provider_corporation_id
      WHERE application.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function markCorporationApplicationApproved(client: Client, id: number) {
  const result = await client.query<CorporationApplicationRow>(
    `UPDATE corporation_application
        SET status = 'approved'
      WHERE id = $1
      RETURNING id, name, type, applicant_email, provider_corporation_id, status`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function rejectCorporationApplication(client: Client, id: number) {
  const result = await client.query<CorporationApplicationRow>(
    `UPDATE corporation_application
        SET status = 'rejected'
      WHERE id = $1
      RETURNING id, name, type, applicant_email, provider_corporation_id, status`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function rejectCorporationApplicationForProvider(
  client: Client,
  id: number,
  providerCorporationId: number,
) {
  const result = await client.query<CorporationApplicationRow>(
    `UPDATE corporation_application
        SET status = 'rejected'
      WHERE id = $1
        AND provider_corporation_id = $2
      RETURNING id, name, type, applicant_email, provider_corporation_id, status`,
    [id, providerCorporationId],
  );

  return result.rows[0] ?? null;
}
