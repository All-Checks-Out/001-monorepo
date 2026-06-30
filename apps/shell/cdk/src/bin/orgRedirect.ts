#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import {
  CLOUDFRONT_REGION,
  MANAGEMENT_ACCOUNT,
} from "../lib/deploymentConfig.js";
import { OrgRedirectStack } from "../lib/orgRedirectStack.js";

const app = new cdk.App();

new OrgRedirectStack(app, "org-redirect-management", {
  env: { account: MANAGEMENT_ACCOUNT, region: CLOUDFRONT_REGION },
});
