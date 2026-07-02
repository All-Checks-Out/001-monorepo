import * as cdk from "aws-cdk-lib";
import { AWS_ACCOUNTS } from "@shared/aws-accounts";

export type DeploymentStage = "testing" | "staging" | "production";

export type StageConfig = {
  env: {
    account: string;
    region: string;
  };
  stackSuffix: string;
};

const REGION = "eu-west-2";

const stageConfigs: Record<DeploymentStage, StageConfig> = {
  testing: {
    env: {
      account: AWS_ACCOUNTS.testing,
      region: REGION,
    },
    stackSuffix: "testing",
  },
  staging: {
    env: {
      account: AWS_ACCOUNTS.staging,
      region: REGION,
    },
    stackSuffix: "staging",
  },
  production: {
    env: {
      account: AWS_ACCOUNTS.production,
      region: REGION,
    },
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
