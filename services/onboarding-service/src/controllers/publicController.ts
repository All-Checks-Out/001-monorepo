import type { Request, Response } from "express";
import { z } from "zod";
import { handleError, parseBody } from "./http";
import {
  getPublicProviders as getPublicProvidersService,
  submitAccessRequest,
  submitCorporationApplication,
} from "../services/onboardingService";

const corporationApplicationSchema = z.object({
  name: z.string().trim().min(1),
  type: z.enum(["PROVIDER", "AGENT", "STAKEHOLDER"]),
  applicant_email: z.string().email(),
  provider_corporation_id: z.coerce.number().int().positive().optional().nullable(),
});

const accessRequestSchema = z.object({
  requester_corporation_id: z.coerce.number().int().positive(),
  provider_corporation_id: z.coerce.number().int().positive(),
});

export async function createPublicCorporationApplication(req: Request, res: Response) {
  const input = parseBody(req, res, corporationApplicationSchema);
  if (!input) return;

  try {
    const result = await submitCorporationApplication({
      name: input.name,
      type: input.type,
      applicantEmail: input.applicant_email,
      providerCorporationId: input.provider_corporation_id ?? null,
    });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "Could not create corporation application.");
  }
}

export async function getPublicProviders(_req: Request, res: Response) {
  try {
    const result = await getPublicProvidersService();
    res.json(result);
  } catch (error) {
    handleError(res, error, "Could not list providers.");
  }
}

export async function createPublicAccessRequest(req: Request, res: Response) {
  const input = parseBody(req, res, accessRequestSchema);
  if (!input) return;

  try {
    const result = await submitAccessRequest({
      requesterCorporationId: input.requester_corporation_id,
      providerCorporationId: input.provider_corporation_id,
    });
    res.status(201).json(result);
  } catch (error) {
    handleError(res, error, "Could not create access request.");
  }
}
