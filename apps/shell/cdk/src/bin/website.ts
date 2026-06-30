#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { WebsiteStack } from "../lib/websiteStack.js";
import { configForStage, stageFromApp } from "../lib/deploymentConfig.js";

const app = new cdk.App();
const stage = stageFromApp(app);
const config = configForStage(stage);

new WebsiteStack(app, `ui-stack-${config.stackSuffix}`, {
  env: { account: config.websiteAccount, region: config.websiteRegion },
  stage,
  domainName: config.domainName,
  cloudFrontDomainNames: config.cloudFrontDomainNames,
  certificateDomainName: config.certificateDomainName,
  certificateSubjectAlternativeNames: config.certificateSubjectAlternativeNames,
});
