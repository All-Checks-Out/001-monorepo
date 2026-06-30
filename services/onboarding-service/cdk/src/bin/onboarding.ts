#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { OnboardingServiceStack } from "../lib/onboardingServiceStack.js";
import { configForStage, stageFromApp } from "../lib/deploymentConfig.js";

const app = new cdk.App();
const stage = stageFromApp(app);
const config = configForStage(stage);

new OnboardingServiceStack(app, `onboarding-service-stack-${config.stackSuffix}`, {
  env: { account: config.account, region: config.region },
  stage,
});
