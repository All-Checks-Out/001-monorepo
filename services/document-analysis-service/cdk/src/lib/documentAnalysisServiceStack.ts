import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { SqsQueue } from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DeploymentStage } from "./deploymentConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface DocumentAnalysisServiceStackProps extends StackProps {
  stage: DeploymentStage;
}

export class DocumentAnalysisServiceStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: DocumentAnalysisServiceStackProps,
  ) {
    super(scope, id, props);

    const eventBusName = StringParameter.valueForStringParameter(
      this,
      "/onboarding/events/event-bus-name",
    );
    const evidenceBucketName = StringParameter.valueForStringParameter(
      this,
      "/onboarding/evidence/bucket-name",
    );
    const databaseName = process.env.CDK_DATABASE_NAME ?? "uptickart";

    const onboardingEventBus = EventBus.fromEventBusName(
      this,
      "ImportedOnboardingEventBus",
      eventBusName,
    );
    const evidenceBucket = Bucket.fromBucketName(
      this,
      "ImportedEvidenceBucket",
      evidenceBucketName,
    );

    const evidenceEventsQueue = new Queue(this, "EvidenceEventsQueue", {
      queueName: `document-analysis-evidence-events-${props.stage}`,
      visibilityTimeout: Duration.seconds(90),
    });

    const evidenceEventFunction = new NodejsFunction(this, "EvidenceEventFunction", {
      entry: join(
        __dirname,
        "..",
        "..",
        "..",
        "src",
        "consumers",
        "evidenceEventConsumer.ts",
      ),
      handler: "handler",
      runtime: Runtime.NODEJS_24_X,
      timeout: Duration.seconds(30),
      environment: {
        DATABASE_NAME: databaseName,
        ONBOARDING_EVENT_BUS_NAME: eventBusName,
      },
    });

    evidenceEventFunction.addEventSource(
      new SqsEventSource(evidenceEventsQueue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      }),
    );

    evidenceBucket.grantRead(evidenceEventFunction);
    onboardingEventBus.grantPutEventsTo(evidenceEventFunction);

    evidenceEventFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["rekognition:DetectLabels"],
        resources: ["*"],
      }),
    );

    evidenceEventFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/rds/*`,
          `arn:aws:ssm:${this.region}:${this.account}:parameter/onboarding/rds/*`,
          `arn:aws:ssm:${this.region}:${this.account}:parameter/onboarding/evidence/*`,
          `arn:aws:ssm:${this.region}:${this.account}:parameter/onboarding/events/*`,
        ],
      }),
    );

    evidenceEventFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: ["*"],
      }),
    );

    new Rule(this, "EvidenceUploadRequestedRule", {
      eventBus: onboardingEventBus,
      eventPattern: {
        source: ["aco010.onboarding"],
        detailType: ["evidence.upload-requested"],
      },
      targets: [new SqsQueue(evidenceEventsQueue)],
    });

    new Rule(this, "EvidenceObjectCreatedRule", {
      eventBus: onboardingEventBus,
      eventPattern: {
        source: ["aco010.onboarding"],
        detailType: ["evidence.object-created"],
      },
      targets: [new SqsQueue(evidenceEventsQueue)],
    });
  }
}
