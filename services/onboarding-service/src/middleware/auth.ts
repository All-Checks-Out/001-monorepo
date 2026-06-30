import { getCurrentInvoke } from "@codegenie/serverless-express";
import type { NextFunction, Request, Response } from "express";
import { createDbClient } from "../database/db";
import { getCurrentAppUserById } from "../database/appUserRepository";
import { isLocalMode } from "../localMode";

export type AuthUser = {
  sub: string;
  email?: string;
};

type Claims = {
  sub?: string;
  email?: string;
};

export function attachAuth(req: Request, _res: Response, next: NextFunction) {
  if (isLocalMode()) {
    void attachLocalAuth(req, next).catch(next);
    return;
  }

  const invoke = getCurrentInvoke?.();
  const claims: Claims | undefined =
    invoke?.event?.requestContext?.authorizer?.claims;

  if (claims?.sub) {
    (req as any).auth = {
      sub: claims.sub,
      email: claims.email,
    } as AuthUser;
  }

  next();
}

async function attachLocalAuth(req: Request, next: NextFunction) {
  const rawUserId = req.header("x-local-user-id");
  const localUserId = rawUserId ? Number(rawUserId) : NaN;

  if (!Number.isInteger(localUserId) || localUserId < 1) {
    next();
    return;
  }

  const client = await createDbClient();

  try {
    const user = await getCurrentAppUserById(client, localUserId);

    if (user) {
      (req as any).auth = {
        sub: user.cognito_sub,
        email: user.email,
      } as AuthUser;
    }
  } finally {
    await client.end();
  }

  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = (req as any).auth as AuthUser | undefined;

  if (!auth?.sub) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  next();
}
