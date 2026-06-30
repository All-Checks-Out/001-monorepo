import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import {
  AccountPrincipal,
  CompositePrincipal,
  Role,
} from "aws-cdk-lib/aws-iam";
import { HostedZone } from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import { ROOT_DOMAIN } from "./deploymentConfig.js";

interface ManagementDnsStackProps extends StackProps {
  workloadAccountIds: string[];
}

export class ManagementDnsStack extends Stack {
  constructor(scope: Construct, id: string, props: ManagementDnsStackProps) {
    super(scope, id, props);

    const parentHostedZone = HostedZone.fromLookup(this, "ParentHostedZone", {
      domainName: ROOT_DOMAIN,
    });

    const delegationRole = new Role(this, "ParentZoneDelegationRole", {
      assumedBy: new CompositePrincipal(
        ...props.workloadAccountIds.map((accountId) =>
          new AccountPrincipal(accountId),
        ),
      ),
      roleName: "HostedZoneDelegationRole",
    });

    parentHostedZone.grantDelegation(delegationRole);

    new CfnOutput(this, "RootDomainName", {
      value: ROOT_DOMAIN,
    });

    new CfnOutput(this, "ParentHostedZoneId", {
      value: parentHostedZone.hostedZoneId,
    });
  }
}
