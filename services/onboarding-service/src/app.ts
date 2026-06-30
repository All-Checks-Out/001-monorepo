import express from "express";
import type { Request, Response } from "express";
import { protectedRoutes, publicRoutes } from "./routes/onboardingRoutes";
import { attachAuth, requireAuth } from "./middleware/auth";

export const app = express();

app.use((_req: Request, res: Response, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-local-user-id");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  next();
});

app.use((req: Request, res: Response, next) => {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json());

app.use(publicRoutes);
app.use(attachAuth, requireAuth);
app.use(protectedRoutes);
