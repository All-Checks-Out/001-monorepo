import { CfnOutput, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  Distribution,
  Function,
  FunctionCode,
  FunctionEventType,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
  ARecord,
  AaaaRecord,
  HostedZone,
  RecordTarget,
} from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ROOT_DOMAIN } from "./deploymentConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface WebsiteStackProps extends StackProps {
  stage: string;
  domainName: string;
  cloudFrontDomainNames: string[];
  certificateDomainName: string;
  certificateSubjectAlternativeNames: string[];
}

export class WebsiteStack extends Stack {
  constructor(scope: Construct, id: string, props: WebsiteStackProps) {
    super(scope, id, props);

    const hostedZone = HostedZone.fromLookup(this, "HostedZone", {
      domainName: ROOT_DOMAIN,
    });

    const certificate = new Certificate(this, "WebsiteCertificate", {
      domainName: props.certificateDomainName,
      subjectAlternativeNames: props.certificateSubjectAlternativeNames,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const websiteBucket = new Bucket(this, "WebsiteBucket", {
      removalPolicy: RemovalPolicy.DESTROY,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    const routeRewriteFunction = new Function(this, "RouteRewriteFunction", {
      code: FunctionCode.fromFile({
        filePath: join(__dirname, "..", "functions", "routeRewrite.js"),
      }),
    });

    const distribution = new Distribution(this, "WebsiteDistribution", {
      defaultRootObject: "index.html",
      certificate,
      domainNames: props.cloudFrontDomainNames,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [
          {
            function: routeRewriteFunction,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
    });
    const websiteUrl = `https://${props.domainName}`;

    for (const domainName of props.cloudFrontDomainNames) {
      const recordName =
        domainName === ROOT_DOMAIN
          ? undefined
          : domainName.slice(0, -`.${ROOT_DOMAIN}`.length);

      new ARecord(this, `WebsiteAliasARecord${this.recordId(domainName)}`, {
        zone: hostedZone,
        recordName,
        target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      });

      new AaaaRecord(this, `WebsiteAliasAaaaRecord${this.recordId(domainName)}`, {
        zone: hostedZone,
        recordName,
        target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      });
    }

    // Saved SSM Parameters

    const parameterPrefix = `/stages/${props.stage}/website`;

    new StringParameter(this, "CloudfrontWebsiteBucketNameParameter", {
      parameterName: `${parameterPrefix}/bucket-name`,
      stringValue: websiteBucket.bucketName,
    });

    new StringParameter(this, "CloudfrontWebsiteDistributionIdParameter", {
      parameterName: `${parameterPrefix}/distribution-id`,
      stringValue: distribution.distributionId,
    });

    new StringParameter(this, "CloudfrontWebsiteDistributionUrlParameter", {
      parameterName: `${parameterPrefix}/distribution-url`,
      stringValue: websiteUrl,
    });

    new StringParameter(this, "WebsiteDomainNameParameter", {
      parameterName: `${parameterPrefix}/domain-name`,
      stringValue: props.domainName,
    });

    // Outputs

    new CfnOutput(this, "CloudfrontWebsiteDistributionDomainName", {
      value: distribution.distributionDomainName,
    });

    new CfnOutput(this, "CloudfrontWebsiteDistributionUrl", {
      value: websiteUrl,
    });

    new CfnOutput(this, "CloudfrontWebsiteDomainName", {
      value: props.domainName,
    });
  }

  private recordId(domainName: string) {
    return domainName.replace(/[^A-Za-z0-9]/g, "");
  }
}
