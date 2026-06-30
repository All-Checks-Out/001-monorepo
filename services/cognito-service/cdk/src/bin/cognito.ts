#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CognitoStack } from "../lib/cognitoStack.js";
import { configForStage, stageFromApp } from "../lib/deploymentConfig.js";

const app = new cdk.App();
const stage = stageFromApp(app);
const config = configForStage(stage);

new CognitoStack(app, `cognito-stack-${config.stackSuffix}`, {
  env: { account: config.account, region: config.region },
  stage,
  websiteUrl: `https://${config.domainName}`,
});
