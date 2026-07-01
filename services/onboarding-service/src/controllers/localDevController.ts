import type { Request, Response } from "express";
import { z } from "zod";
import { createDbClient } from "../database/db";
import { listUsersWithCorporations } from "../database/appUserRepository";
import { handleError, parseBody } from "./http";
import { isLocalMode } from "../localMode";
import { completeChecklistTaskEvidenceUploadFromObjectKey } from "../services/onboardingService";

const completeEvidenceUploadBodySchema = z.object({
  object_key: z.string().trim().min(1),
});

function requireLocalMode(res: Response) {
  if (isLocalMode()) return true;

  res.status(404).json({ error: "Not found." });
  return false;
}

export async function listLocalDevUsers(_req: Request, res: Response) {
  if (!requireLocalMode(res)) return;

  const client = await createDbClient();

  try {
    const users = await listUsersWithCorporations(client);
    res.json({ users });
  } catch (error) {
    handleError(res, error, "Could not list local users.");
  } finally {
    await client.end();
  }
}

export async function completeLocalDevEvidenceUpload(req: Request, res: Response) {
  if (!requireLocalMode(res)) return;

  const body = parseBody(req, res, completeEvidenceUploadBodySchema);
  if (!body) return;

  try {
    const evidence = await completeChecklistTaskEvidenceUploadFromObjectKey(
      body.object_key,
    );
    res.json({ evidence });
  } catch (error) {
    handleError(res, error, "Could not complete local evidence upload.");
  }
}
