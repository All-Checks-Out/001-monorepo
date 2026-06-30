import { CfnOutput, Duration, Stack, type StackProps } from "aws-cdk-lib";
import {
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  Cors,
  LambdaIntegration,
  ResponseType,
  RestApi,
} from "aws-cdk-lib/aws-apigateway";
import {
  AllowedMethods,
  CachedMethods,
  Distribution,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import {
  BlockPublicAccess,
  Bucket,
  BucketEncryption,
  HttpMethods,
} from "aws-cdk-lib/aws-s3";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OnboardingRds } from "./rdsConstruct.js";
import type { DeploymentStage } from "./deploymentConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface OnboardingServiceStackProps extends StackProps {
  stage: DeploymentStage;
}

export class OnboardingServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: OnboardingServiceStackProps) {
    super(scope, id, props);

    new OnboardingRds(this, "Rds");

    const onboardingEventBus = new EventBus(this, "OnboardingEventBus", {
      eventBusName: `onboarding-events-${props.stage}`,
    });

    const evidenceBucket = new Bucket(this, "EvidenceBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      eventBridgeEnabled: true,
      cors: [
        {
          allowedMethods: [HttpMethods.PUT],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag"],
          maxAge: 3000,
        },
      ],
    });

    const evidenceDistribution = new Distribution(this, "EvidenceDistribution", {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(evidenceBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: CachedMethods.CACHE_GET_HEAD_OPTIONS,
      },
    });

    const evidenceDistributionUrl =
      `https://${evidenceDistribution.distributionDomainName}`;

    const userPoolId = StringParameter.valueForStringParameter(
      this,
      "/cognito/user-pool-id",
    );
    const databaseName = process.env.CDK_DATABASE_NAME ?? "uptickart";

    const onboardingServiceFunction = new NodejsFunction(this, "OnboardingServiceFunction", {
      entry: join(
        __dirname,
        "..",
        "..",
        "..",
        "src",
        "index.ts",
      ),
      handler: "handler",
      runtime: Runtime.NODEJS_24_X,
      timeout: Duration.seconds(30),
      environment: {
        COGNITO_USER_POOL_ID: userPoolId,
        DATABASE_NAME: databaseName,
        EVIDENCE_BUCKET_NAME: evidenceBucket.bucketName,
        EVIDENCE_CLOUDFRONT_URL: evidenceDistributionUrl,
        ONBOARDING_EVENT_BUS_NAME: onboardingEventBus.eventBusName,
      },
    });

    const uploadCompletedFunction = new NodejsFunction(this, "UploadCompletedFunction", {
      entry: join(
        __dirname,
        "..",
        "..",
        "..",
        "src",
        "consumers",
        "s3ObjectCreatedConsumer.ts",
      ),
      handler: "handler",
      runtime: Runtime.NODEJS_24_X,
      timeout: Duration.seconds(30),
      environment: {
        DATABASE_NAME: databaseName,
        EVIDENCE_BUCKET_NAME: evidenceBucket.bucketName,
        ONBOARDING_EVENT_BUS_NAME: onboardingEventBus.eventBusName,
      },
    });

    onboardingEventBus.grantPutEventsTo(onboardingServiceFunction);
    onboardingEventBus.grantPutEventsTo(uploadCompletedFunction);

    onboardingServiceFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:ListUsers",
        ],
        resources: ["*"],
      }),
    );

    uploadCompletedFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/rds/*`,
          `arn:aws:ssm:${this.region}:${this.account}:parameter/onboarding/rds/*`,
        ],
      }),
    );

    uploadCompletedFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: ["*"],
      }),
    );

    new Rule(this, "EvidenceObjectCreatedRule", {
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          bucket: {
            name: [evidenceBucket.bucketName],
          },
        },
      },
      targets: [new LambdaFunction(uploadCompletedFunction)],
    });

    onboardingServiceFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter/rds/*`,
          `arn:aws:ssm:${this.region}:${this.account}:parameter/onboarding/rds/*`,
          `arn:aws:ssm:${this.region}:${this.account}:parameter/onboarding/evidence/*`,
        ],
      }),
    );

    onboardingServiceFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
        resources: [evidenceBucket.arnForObjects("*")],
      }),
    );

    onboardingServiceFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: ["*"],
      }),
    );

    const restApi = new RestApi(this, "OnboardingServiceGateway", {
      restApiName: `onboarding-service-${props.stage}`,
      cloudWatchRole: false,
      deployOptions: {
        stageName: "onboarding",
      },
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ["Content-Type", "Authorization"],
      },
    });

    const onboardingServiceIntegration = new LambdaIntegration(onboardingServiceFunction, {
      proxy: true,
    });
    const userPool = UserPool.fromUserPoolId(
      this,
      "ImportedUserPool",
      userPoolId,
    );
    const authorizer = new CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuthorizer",
      {
        cognitoUserPools: [userPool],
        identitySource: "method.request.header.Authorization",
      },
    );

    const publicResource = restApi.root.addResource("public");
    publicResource.addProxy({
      anyMethod: true,
      defaultIntegration: onboardingServiceIntegration,
      defaultMethodOptions: {
        authorizationType: AuthorizationType.NONE,
      },
    });

    const authResource = restApi.root.addResource("auth");
    authResource.addProxy({
      anyMethod: true,
      defaultIntegration: onboardingServiceIntegration,
      defaultMethodOptions: {
        authorizationType: AuthorizationType.COGNITO,
        authorizer,
      },
    });

    restApi.addGatewayResponse("UnauthorizedGatewayResponse", {
      type: ResponseType.UNAUTHORIZED,
      statusCode: "401",
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
        "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    });

    restApi.addGatewayResponse("AccessDeniedGatewayResponse", {
      type: ResponseType.ACCESS_DENIED,
      statusCode: "403",
      responseHeaders: {
        "Access-Control-Allow-Origin": "'*'",
        "Access-Control-Allow-Headers": "'Content-Type,Authorization'",
        "Access-Control-Allow-Methods": "'GET,POST,PUT,DELETE,OPTIONS'",
      },
    });

    new StringParameter(this, "OnboardingServiceBaseUrlParameter", {
      parameterName: "/services/onboarding-service/base-url",
      stringValue: restApi.url,
    });

    new StringParameter(this, "EvidenceBucketNameParameter", {
      parameterName: "/onboarding/evidence/bucket-name",
      stringValue: evidenceBucket.bucketName,
    });

    new StringParameter(this, "EvidenceDistributionUrlParameter", {
      parameterName: "/onboarding/evidence/distribution-url",
      stringValue: evidenceDistributionUrl,
    });

    new StringParameter(this, "OnboardingEventBusNameParameter", {
      parameterName: "/onboarding/events/event-bus-name",
      stringValue: onboardingEventBus.eventBusName,
    });

    new CfnOutput(this, "OnboardingServiceGatewayUrl", {
      value: restApi.url,
    });

    new CfnOutput(this, "EvidenceBucketName", {
      value: evidenceBucket.bucketName,
    });

    new CfnOutput(this, "EvidenceDistributionUrl", {
      value: evidenceDistributionUrl,
    });

    new CfnOutput(this, "OnboardingEventBusName", {
      value: onboardingEventBus.eventBusName,
    });
  }
}
