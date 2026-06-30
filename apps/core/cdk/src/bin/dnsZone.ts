#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {
  MANAGEMENT_ACCOUNT,
  configForStage,
} from "../lib/deploymentConfig.js";
import { ManagementDnsStack } from "../lib/managementDnsStack.js";

const app = new cdk.App();
const region = "eu-west-2";
const workloadAccountIds = [
  configForStage("testing").account,
  configForStage("staging").account,
  configForStage("production").account,
];

new ManagementDnsStack(app, "dns-zone-management", {
  env: { account: MANAGEMENT_ACCOUNT, region },
  workloadAccountIds,
});
