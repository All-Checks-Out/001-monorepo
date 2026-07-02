import * as cdk from "aws-cdk-lib";
import { AWS_ACCOUNTS } from "@shared/aws-accounts";

export type DeploymentStage = "testing" | "staging" | "production";

export type StageConfig = {
  account: string;
  websiteAccount: string;
  region: string;
  websiteRegion: string;
  domainName: string;
  cloudFrontDomainNames: string[];
  certificateDomainName: string;
  certificateSubjectAlternativeNames: string[];
  stackSuffix: string;
};

export const ROOT_DOMAIN = "aco24.net";
export const MANAGEMENT_ACCOUNT = AWS_ACCOUNTS.management;
const REGION = "eu-west-2";
const CLOUDFRONT_REGION = "us-east-1";

const stageConfigs: Record<DeploymentStage, StageConfig> = {
  testing: {
    account: AWS_ACCOUNTS.testing,
    websiteAccount: MANAGEMENT_ACCOUNT,
    region: REGION,
    websiteRegion: CLOUDFRONT_REGION,
    domainName: `testing.${ROOT_DOMAIN}`,
    cloudFrontDomainNames: [`testing.${ROOT_DOMAIN}`],
    certificateDomainName: `testing.${ROOT_DOMAIN}`,
    certificateSubjectAlternativeNames: [],
    stackSuffix: "testing",
  },
  staging: {
    account: AWS_ACCOUNTS.staging,
    websiteAccount: MANAGEMENT_ACCOUNT,
    region: REGION,
    websiteRegion: CLOUDFRONT_REGION,
    domainName: `staging.${ROOT_DOMAIN}`,
    cloudFrontDomainNames: [`staging.${ROOT_DOMAIN}`],
    certificateDomainName: `staging.${ROOT_DOMAIN}`,
    certificateSubjectAlternativeNames: [],
    stackSuffix: "staging",
  },
  production: {
    account: AWS_ACCOUNTS.production,
    websiteAccount: MANAGEMENT_ACCOUNT,
    region: REGION,
    websiteRegion: CLOUDFRONT_REGION,
    domainName: ROOT_DOMAIN,
    cloudFrontDomainNames: [`www.${ROOT_DOMAIN}`, ROOT_DOMAIN],
    certificateDomainName: `www.${ROOT_DOMAIN}`,
    certificateSubjectAlternativeNames: [ROOT_DOMAIN],
    stackSuffix: "production",
  },
};

export function stageFromApp(app: cdk.App): DeploymentStage {
  const stage = app.node.tryGetContext("stage") ?? process.env.DEPLOY_STAGE;

  if (stage === "testing" || stage === "staging" || stage === "production") {
    return stage;
  }

  throw new Error(
    "Missing or invalid stage. Pass --context stage=testing|staging|production or set DEPLOY_STAGE.",
  );
}

export function configForStage(stage: DeploymentStage): StageConfig {
  return stageConfigs[stage];
}
