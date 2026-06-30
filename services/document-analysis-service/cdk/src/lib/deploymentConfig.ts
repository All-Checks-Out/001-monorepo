import * as cdk from "aws-cdk-lib";

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
      account: "175616158444",
      region: REGION,
    },
    stackSuffix: "testing",
  },
  staging: {
    env: {
      account: "668723997661",
      region: REGION,
    },
    stackSuffix: "staging",
  },
  production: {
    env: {
      account: "989793932938",
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
