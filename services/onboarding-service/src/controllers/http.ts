import type { Request, Response } from "express";
import { z } from "zod";
import { ServiceError } from "../services/onboardingService";

export function parseBody<T extends z.ZodType>(req: Request, res: Response, schema: T): z.infer<T> | null {
  const result = schema.safeParse(req.body ?? {});

  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0]?.message ?? "Invalid request body." });
    return null;
  }

  return result.data;
}

export function parseId(req: Request, res: Response) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: "Invalid id." });
    return null;
  }

  return id;
}

export function handleError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error(fallbackMessage, error);
  res.status(500).json({ error: fallbackMessage });
}
