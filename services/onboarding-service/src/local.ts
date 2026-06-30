import express from "express";
import { app } from "./app";
import { localDevRoutes } from "./routes/onboardingRoutes";

const localApp = express();
localApp.use((_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-local-user-id");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  next();
});
localApp.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});
localApp.use(express.json());
localApp.use("/local-dev", localDevRoutes);
localApp.use("/public", app);
localApp.use("/auth", app);

const port = 3001;

localApp.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
