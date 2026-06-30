import type { Request, Response } from "express";
import { z } from "zod";
import { handleError, parseBody } from "./http";
import {
  fullFactoryResetDemoData as fullFactoryResetDemoDataService,
  getRootSetupStatus as getRootSetupStatusService,
  recreateSampleData as recreateSampleDataService,
  seededFactoryResetDemoData as seededFactoryResetDemoDataService,
  setupRootUser,
} from "../services/setupService";

const rootUserSchema = z.object({
  email: z.string().email(),
});

export async function getRootSetupStatus(_req: Request, res: Response) {
  try {
    const result = await getRootSetupStatusService();
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not read root setup status.");
  }
}

export async function createRootUser(req: Request, res: Response) {
  const input = parseBody(req, res, rootUserSchema);
  if (!input) return;

  try {
    const result = await setupRootUser(input.email);
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "Could not create root user.");
  }
}

export async function fullFactoryResetDemoData(_req: Request, res: Response) {
  try {
    const result = await fullFactoryResetDemoDataService();
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not perform full factory reset.");
  }
}

export async function seededFactoryResetDemoData(_req: Request, res: Response) {
  try {
    const result = await seededFactoryResetDemoDataService();
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not perform seeded factory reset.");
  }
}

export async function recreateSampleData(_req: Request, res: Response) {
  try {
    const result = await recreateSampleDataService();
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not recreate sample data.");
  }
}
