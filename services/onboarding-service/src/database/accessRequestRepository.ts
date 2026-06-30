import type { Client } from "pg";
import type { AccessRequestWithCorporationsRow, CorporationAccessRequestRow } from "./onboardingTypes";

export async function createAccessRequest(
  client: Client,
  input: { requesterCorporationId: number; providerCorporationId: number },
) {
  const result = await client.query<CorporationAccessRequestRow>(
    `INSERT INTO corporation_access_request (
       requester_corporation_id,
       provider_corporation_id,
       status
     )
     VALUES ($1, $2, 'pending')
     RETURNING id, requester_corporation_id, provider_corporation_id, status`,
    [input.requesterCorporationId, input.providerCorporationId],
  );

  return result.rows[0];
}

export async function listAccessRequests(client: Client) {
  const result = await client.query<AccessRequestWithCorporationsRow>(
    `SELECT ar.id,
            ar.requester_corporation_id,
            ar.provider_corporation_id,
            ar.status,
            requester.name AS requester_corporation_name,
            requester.type AS requester_corporation_type,
            provider.name AS provider_corporation_name
       FROM corporation_access_request ar
       JOIN corporation requester ON requester.id = ar.requester_corporation_id
       JOIN corporation provider ON provider.id = ar.provider_corporation_id
      ORDER BY ar.id DESC`,
  );

  return result.rows;
}

export async function listAccessRequestsForProvider(client: Client, providerCorporationId: number) {
  const result = await client.query<AccessRequestWithCorporationsRow>(
    `SELECT ar.id,
            ar.requester_corporation_id,
            ar.provider_corporation_id,
            ar.status,
            requester.name AS requester_corporation_name,
            requester.type AS requester_corporation_type,
            provider.name AS provider_corporation_name
       FROM corporation_access_request ar
       JOIN corporation requester ON requester.id = ar.requester_corporation_id
       JOIN corporation provider ON provider.id = ar.provider_corporation_id
      WHERE ar.provider_corporation_id = $1
      ORDER BY ar.id DESC`,
    [providerCorporationId],
  );

  return result.rows;
}

export async function listAccessRequestsForRequester(client: Client, requesterCorporationId: number) {
  const result = await client.query<AccessRequestWithCorporationsRow>(
    `SELECT ar.id,
            ar.requester_corporation_id,
            ar.provider_corporation_id,
            ar.status,
            requester.name AS requester_corporation_name,
            requester.type AS requester_corporation_type,
            provider.name AS provider_corporation_name
       FROM corporation_access_request ar
       JOIN corporation requester ON requester.id = ar.requester_corporation_id
       JOIN corporation provider ON provider.id = ar.provider_corporation_id
      WHERE ar.requester_corporation_id = $1
      ORDER BY ar.id DESC`,
    [requesterCorporationId],
  );

  return result.rows;
}

export async function approveAccessRequest(client: Client, id: number, providerCorporationId?: number) {
  const params: Array<number> = [id];
  const providerClause = providerCorporationId ? " AND provider_corporation_id = $2" : "";
  if (providerCorporationId) params.push(providerCorporationId);

  const result = await client.query<CorporationAccessRequestRow>(
    `UPDATE corporation_access_request
        SET status = 'approved'
      WHERE id = $1${providerClause}
      RETURNING id, requester_corporation_id, provider_corporation_id, status`,
    params,
  );

  return result.rows[0] ?? null;
}

export async function rejectAccessRequest(client: Client, id: number, providerCorporationId?: number) {
  const params: Array<number> = [id];
  const providerClause = providerCorporationId ? " AND provider_corporation_id = $2" : "";
  if (providerCorporationId) params.push(providerCorporationId);

  const result = await client.query<CorporationAccessRequestRow>(
    `UPDATE corporation_access_request
        SET status = 'rejected'
      WHERE id = $1${providerClause}
      RETURNING id, requester_corporation_id, provider_corporation_id, status`,
    params,
  );

  return result.rows[0] ?? null;
}

