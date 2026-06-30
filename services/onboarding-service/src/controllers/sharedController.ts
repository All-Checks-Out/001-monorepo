import type { Request, Response } from "express";
import { z } from "zod";
import { handleError, parseBody, parseId } from "./http";
import {
  getCurrentUserContext,
  requirePermission,
} from "../services/currentUser";
import {
  getMyAccessRequests as getMyAccessRequestsService,
  getMyUsers as getMyUsersService,
  inviteUserForMyCorporation,
  updateOtherUserPermissionsForMyCorporation,
} from "../services/onboardingService";

const inviteUserSchema = z.object({
  email: z.string().email(),
});

const updateUserPermissionsSchema = z.object({
  permissions: z.array(z.string()),
});

export async function getMe(req: Request, res: Response) {
  const context = await getCurrentUserContext(req, res);
  if (!context) return;

  res.json({
    user: context.user,
    corporation: context.corporation,
  });
}

export async function getMyCorporation(req: Request, res: Response) {
  const context = await getCurrentUserContext(req, res);
  if (!context) return;

  res.json({ corporation: context.corporation });
}

export async function getMyUsers(req: Request, res: Response) {
  const context = await requirePermission(req, res, "users:read");
  if (!context) return;

  try {
    const result = await getMyUsersService(context);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list users.");
  }
}

export async function inviteMyUser(req: Request, res: Response) {
  const input = parseBody(req, res, inviteUserSchema);
  if (!input) return;

  const context = await requirePermission(req, res, "users:invite");
  if (!context) return;

  try {
    const result = await inviteUserForMyCorporation(context, input);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "Could not invite user.");
  }
}

export async function updateMyCorporationUserPermissions(req: Request, res: Response) {
  const id = parseId(req, res);
  if (id === null) return;

  const input = parseBody(req, res, updateUserPermissionsSchema);
  if (!input) return;

  const context = await requirePermission(req, res, "user-permissions:change");
  if (!context) return;

  try {
    const result = await updateOtherUserPermissionsForMyCorporation(
      context,
      id,
      input.permissions,
    );
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not update user permissions.");
  }
}

export async function getMyAccessRequests(req: Request, res: Response) {
  const context = await getCurrentUserContext(req, res);
  if (!context) return;

  try {
    const result = await getMyAccessRequestsService(context);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list access requests.");
  }
}
