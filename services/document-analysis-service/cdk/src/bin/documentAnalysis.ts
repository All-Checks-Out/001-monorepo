#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { configForStage, stageFromApp } from "../lib/deploymentConfig.js";
import { DocumentAnalysisServiceStack } from "../lib/documentAnalysisServiceStack.js";

const app = new cdk.App();
const stage = stageFromApp(app);
const config = configForStage(stage);

new DocumentAnalysisServiceStack(app, `document-analysis-service-stack-${config.stackSuffix}`, {
  env: config.env,
  stage,
});
