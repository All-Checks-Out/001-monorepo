import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import {
  Distribution,
  Function,
  FunctionCode,
  FunctionEventType,
  OriginProtocolPolicy,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import {
  ARecord,
  AaaaRecord,
  HostedZone,
  RecordTarget,
} from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import type { Construct } from "constructs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ORG_REDIRECT_DOMAIN, ROOT_DOMAIN } from "./deploymentConfig.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const orgAliases = [
  ORG_REDIRECT_DOMAIN,
  `www.${ORG_REDIRECT_DOMAIN}`,
  `testing.${ORG_REDIRECT_DOMAIN}`,
  `staging.${ORG_REDIRECT_DOMAIN}`,
];

export class OrgRedirectStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const hostedZone = HostedZone.fromLookup(this, "HostedZone", {
      domainName: ORG_REDIRECT_DOMAIN,
    });

    const certificate = new Certificate(this, "OrgRedirectCertificate", {
      domainName: ORG_REDIRECT_DOMAIN,
      subjectAlternativeNames: orgAliases.filter(
        (domainName) => domainName !== ORG_REDIRECT_DOMAIN,
      ),
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const redirectFunction = new Function(this, "OrgRedirectFunction", {
      code: FunctionCode.fromFile({
        filePath: join(__dirname, "..", "functions", "orgRedirect.js"),
      }),
    });

    const distribution = new Distribution(this, "OrgRedirectDistribution", {
      certificate,
      domainNames: orgAliases,
      defaultBehavior: {
        origin: new HttpOrigin(ROOT_DOMAIN, {
          protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
        }),
        viewerProtocolPolicy: ViewerProtocolPolicy.ALLOW_ALL,
        functionAssociations: [
          {
            function: redirectFunction,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
    });

    for (const domainName of orgAliases) {
      const recordName =
        domainName === ORG_REDIRECT_DOMAIN
          ? undefined
          : domainName.slice(0, -`.${ORG_REDIRECT_DOMAIN}`.length);

      new ARecord(this, `OrgRedirectAliasARecord${this.recordId(domainName)}`, {
        zone: hostedZone,
        recordName,
        target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
      });

      new AaaaRecord(
        this,
        `OrgRedirectAliasAaaaRecord${this.recordId(domainName)}`,
        {
          zone: hostedZone,
          recordName,
          target: RecordTarget.fromAlias(new CloudFrontTarget(distribution)),
        },
      );
    }

    new CfnOutput(this, "OrgRedirectDistributionDomainName", {
      value: distribution.distributionDomainName,
    });
  }

  private recordId(domainName: string) {
    return domainName.replace(/[^A-Za-z0-9]/g, "");
  }
}
