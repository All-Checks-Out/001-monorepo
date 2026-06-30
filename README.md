# Due Diligence Onboarding Starter

This project is an AWS serverless teaching architecture for a minimal due-diligence onboarding system.

The active application uses:

- pnpm workspaces
- React apps for the core UI and form-design UI
- Cognito hosted UI with OAuth authorization-code flow
- API Gateway, Lambda, Express, and the existing Cognito authorizer pattern
- Aurora PostgreSQL with Flyway migrations
- CDK deployment scripts

## Platform Support

Development and operations are supported on macOS/Linux-style shells using Bash. Windows and PowerShell workflows are not supported for this project.

## Domain

The onboarding domain is intentionally small:

- `corporation`
- `app_user`
- `corporation_application`
- `corporation_access_request`

Corporation types are `ASSOCIATION`, `PROVIDER`, `AGENT`, and `STAKEHOLDER`. Cognito self-registration is disabled; users are invited through backend/admin flows.

## Root Association User

Create or invite the initial Association user through the explicit public setup flow for the demo/test environment. The public setup and demo data reset endpoints are available without extra feature flags.

## Common Commands

```bash
pnpm install
pnpm run type-check
pnpm run build
pnpm run deploy -- testing
pnpm run deploy -- production
```

The active workspace builds the core UI, form-design UI, shared frontend packages, Cognito service, and onboarding API service.

Frontend shared package boundaries are documented in [Frontend Package Layout](docs/architecture/frontend-package-layout.md). In short: `@frontend/shadcn` is only for shadcn primitives in the default `components/ui` shape, `@frontend/app-ui` is for shared application-level UI, and single-owner code stays inside its app.

The current host/remote setup is documented in [Module Federation Architecture](docs/architecture/module-federation.md).

## Phased Delivery

Deployments are stage-specific and target separate AWS accounts:

- `testing` -> account `175616158444` -> `https://testing.aco24.net`
- `staging` -> account `668723997661` -> `https://staging.aco24.net`
- `production` -> account `989793932938` -> `https://aco24.net`

The Route 53 parent hosted zone for `aco24.net` is in the management account `305069434672`. Website/CloudFront infrastructure is deployed from that management account so CDK can create the CloudFront certificates and Route 53 alias records without manual certificate CNAME work.

`aco24.org` redirects are managed by a separate management-account CloudFront stack in `us-east-1`:

```bash
pnpm run org-redirect-up
```

This creates DNS-validated ACM coverage for `aco24.org`, `www.aco24.org`, `testing.aco24.org`, and `staging.aco24.org`, then points Route 53 A/AAAA alias records at a redirect distribution.

The redirects are:

- `aco24.org` -> `https://aco24.net`
- `www.aco24.org` -> `https://aco24.net`
- `testing.aco24.org` -> `https://testing.aco24.net`
- `staging.aco24.org` -> `https://staging.aco24.net`

The stack assumes the `aco24.org` Route 53 hosted zone exists in the management account. If AWS created it somewhere else, either move/create the hosted zone in management or adjust the stack/account choice.

Use this order:

```bash
pnpm run bootstrap-up -- management
pnpm run bootstrap-up -- testing
pnpm run bootstrap-up -- production
pnpm run dns-zone-up
pnpm run deploy -- testing
pnpm run deploy -- production
```

Environment-specific commands pass the target stage to the root command dispatcher, which sets the matching AWS profile. The defaults are:

- `management` -> `management`
- `testing` -> `testing`
- `staging` -> `staging`
- `production` -> `production`

Staging is independent and is not touched unless you explicitly run:

```bash
pnpm run bootstrap-up -- staging
pnpm run deploy -- staging
```

To destroy one deployed stage without touching the others:

```bash
pnpm run destroy -- testing
pnpm run destroy -- production
```

The destroy command removes the onboarding service first, then Cognito, then empties and destroys the management-account website stack.
