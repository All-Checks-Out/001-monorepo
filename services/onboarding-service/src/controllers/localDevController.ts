import type { Request, Response } from "express";
import { createDbClient } from "../database/db";
import { listUsersWithCorporations } from "../database/appUserRepository";
import { handleError } from "./http";
import { isLocalMode } from "../localMode";

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
