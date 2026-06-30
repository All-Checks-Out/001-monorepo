import type { Request, Response } from "express";
import { createDbClient } from "../database/db";
import { getCurrentAppUser } from "../database/appUserRepository";
import type { AppUserRow, CorporationRow, Permission } from "../database/onboardingTypes";
import type { AuthUser } from "../middleware/auth";
import { hasPermission } from "./permissions";

export type CurrentUserContext = {
  user: AppUserRow;
  corporation: CorporationRow;
};

export async function getCurrentUserContext(req: Request, res: Response) {
  const auth = (req as any).auth as AuthUser;
  let client: Awaited<ReturnType<typeof createDbClient>> | undefined;

  try {
    client = await createDbClient();
    const row = await getCurrentAppUser(client, auth.sub);

    if (!row) {
      res.status(404).json({ error: "User not found." });
      return null;
    }

    const user: AppUserRow = {
      id: row.id,
      corporation_id: row.corporation_id,
      cognito_sub: row.cognito_sub,
      email: row.email,
      status: row.status,
      permissions: row.permissions,
    };
    const corporation: CorporationRow = {
      id: row.corporation_id,
      name: row.corporation_name,
      type: row.corporation_type,
      status: row.corporation_status,
    };

    return { user, corporation };
  } catch (error) {
    console.error("Could not read current user.", error);
    res.status(500).json({ error: "Could not read current user." });
    return null;
  } finally {
    await client?.end();
  }
}

export async function requireAssociationUser(req: Request, res: Response) {
  const context = await getCurrentUserContext(req, res);

  if (!context) return null;

  if (context.corporation.type !== "ASSOCIATION") {
    res.status(403).json({ error: "Association access required." });
    return null;
  }

  return context;
}

export async function requireProviderUser(req: Request, res: Response) {
  const context = await getCurrentUserContext(req, res);

  if (!context) return null;

  if (context.corporation.type !== "PROVIDER") {
    res.status(403).json({ error: "Provider access required." });
    return null;
  }

  return context;
}

export async function requirePermission(
  req: Request,
  res: Response,
  permission: Permission,
) {
  const context = await getCurrentUserContext(req, res);

  if (!context) return null;

  if (!hasPermission(context, permission)) {
    res.status(403).json({ error: "Permission required." });
    return null;
  }

  return context;
}

export async function requireAssociationUserWithPermission(
  req: Request,
  res: Response,
  permission: Permission,
) {
  const context = await requireAssociationUser(req, res);

  if (!context) return null;

  if (!hasPermission(context, permission)) {
    res.status(403).json({ error: "Permission required." });
    return null;
  }

  return context;
}

export async function requireProviderUserWithPermission(
  req: Request,
  res: Response,
  permission: Permission,
) {
  const context = await requireProviderUser(req, res);

  if (!context) return null;

  if (!hasPermission(context, permission)) {
    res.status(403).json({ error: "Permission required." });
    return null;
  }

  return context;
}
