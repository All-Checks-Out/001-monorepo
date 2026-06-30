# Claude Review: Step 0008, Run 02

- Current git branch: `main`
- Reviewed at: 2026-06-30T06:47:41.211Z
- Command: `pnpm run claude:review -- 0008`

## Review Step

### 0008 Data, Runtime, Deployment, Verification, Docs, And Final System Review

Purpose: review data/migration/seed/reset/export safety, local runtime scripts, deployment/CDK/stage isolation, verification coverage, documentation consistency, and final cross-system risks.

Runner note: this is intentionally broad. Use at least `CLAUDE_REVIEW_TIMEOUT_MS=900000` and `CLAUDE_REVIEW_MAX_SOURCE_BYTES=1000000` unless Richard asks for a narrower final pass.

Files:

- `package.json`
- `pnpm-workspace.yaml`
- root and package package.json files
- `README.md`
- `README-RUN.md`
- `scripts/`
- `apps/shell/cdk/`
- `apps/shell/scripts/`
- `apps/core/cdk/`
- `apps/core/scripts/`
- `apps/form-design/scripts/`
- `services/cognito-service/cdk/`
- `services/onboarding-service/cdk/`
- `services/document-analysis-service/cdk/`
- `services/onboarding-service/database/`
- `services/onboarding-service/src/database/`
- `services/onboarding-service/scripts/`
- `services/onboarding-service/src/app.ts`
- `services/onboarding-service/src/index.ts`
- `services/onboarding-service/src/local.ts`
- `services/onboarding-service/src/controllers/healthController.ts`
- `docs/architecture/`
- `docs/code-review/`
- `docs/design-guides/`
- `docs/specs/`
- `docs/dev-plans-and-handovers/`

Focus:

- migration ordering and repeatability
- seed/reset/export ownership, idempotency, and production safeguards
- secret handling and command-site stage clarity
- local startup without AWS and local/deployed behaviour drift
- manual deployment safety, stage isolation, domains, and CloudFront/S3 layout
- verification command consistency, health checks, logs, and missing high-value tests
- stale documentation, stale architecture claims, and future-agent regression risks
- unresolved cross-cutting risks before declaring the review sequence complete

## Review Output

# Step 0008 Review: Data, Runtime, Deployment, Verification, Docs, And Final System Review

## Findings

### 1. `pnpm run database -- reset <stage>` destroys deployed databases with no production confirmation guard
**Classification: blocking**

`scripts/reset-database.sh` routes `testing|staging|production` straight to `run_deployed_reset`, which calls `pnpm exec tsx scripts/src/database-migrate.ts reset` with **no stage check at all**. In `services/onboarding-service/scripts/src/database-migrate.ts`, `reset` mode runs Flyway `clean` (`-cleanDisabled=false`), which drops every object in the `onboarding`/`document_analysis`/`public` schemas.

Contrast this with the sibling command `data -- reset`, where `services/onboarding-service/scripts/src/data-reset.ts` explicitly requires:
```ts
if (getStage() === "production" && process.env.ACO24_CONFIRM_PRODUCTION_DATA_RESET !== "yes") {
  throw new Error("Refusing to reset production data. Set ACO24_CONFIRM_PRODUCTION_DATA_RESET=yes to continue.");
}
```
`database -- reset` has no equivalent gate, even though it performs an equally (arguably more) destructive action (full schema wipe vs. table truncate). `pnpm run database -- reset production` is also listed as a valid command in `scripts/root-command.sh`'s usage text and is reachable purely by typing the stage name — there is no second confirmation step, and README-RUN.md never documents this command's production reachability at all (it only documents `data -- reset production` with its confirmation requirement). This is a real, easily-triggered, undocumented path to destroying production schema with no recovery prompt.

### 2. `pnpm run destroy -- production` can permanently delete the production database and Cognito user pool with no production-specific confirmation
**Classification: blocking**

`scripts/destroy-stage.sh` accepts `testing|staging|production` uniformly and calls `pnpm -C services/onboarding-service run destroy`, which runs:
```
cdk destroy onboarding-service-stack-$ACO24_STAGE --force --require-approval never ...
```
The Aurora cluster construct (`services/onboarding-service/cdk/src/lib/rdsConstruct.ts`) is configured with `deletionProtection: false`, `removalPolicy: RemovalPolicy.DESTROY`, and `backup.retention: Duration.days(1)`. The Cognito stack (`services/cognito-service/cdk/src/lib/cognitoStack.ts`) likewise uses `removalPolicy: RemovalPolicy.DESTROY` on the `UserPool`. `--force --require-approval never` means CDK will not prompt interactively before deleting these resources.

This means a single command — `pnpm run destroy -- production` — removes the production database and all Cognito users with no extra confirmation step, while the strictly less destructive `data -- reset`/`data -- seed` commands already require an explicit `ACO24_CONFIRM_PRODUCTION_DATA_RESET=yes`/password env var before touching production. That established precedent (the team already recognizes plain stage-argument-only protection is insufficient for irreversible production mutations) is not applied to the most destructive command in the toolset, and the 1-day backup retention leaves very little recovery window if this is ever run against the wrong stage by mistake.

### 3. `apps/core/cdk` is a full, unused duplicate of `apps/shell/cdk`'s shared website/DNS/org-redirect infrastructure
**Classification: recommended**

`apps/core/cdk/src/bin/{website,dnsZone,orgRedirect}.ts` and `apps/core/cdk/src/lib/{websiteStack,deploymentConfig,managementDnsStack,orgRedirectStack}.ts` are essentially identical copies of the equivalent files in `apps/shell/cdk`, including the **same stack names** (`ui-stack-${stage}`, `dns-zone-management`, `org-redirect-management`) in the same management account.

Per `docs/architecture/module-federation.md`: "The shell owns the shared S3 bucket, CloudFront distribution, certificate, DNS records, SPA route rewrite, and SSM website parameters... **Only the shell app has the active shared website infrastructure deploy/destroy commands.**" `apps/core/package.json` has no script that ever invokes anything in `apps/core/cdk` (only `type-check` compiles it via `tsc --noEmit -p cdk/tsconfig.json`); the actual CDK apps are unreferenced dead code.

This directly contradicts the canonical architecture doc and is a real audit hazard: a future agent or developer could reasonably run `cdk deploy --app "tsx ./cdk/src/bin/website.ts" --context stage=testing` from `apps/core`, targeting the exact same `ui-stack-testing` CloudFormation stack the shell already owns and deploys, risking confusing drift or conflicting changes to shared production infrastructure. Recommend deleting `apps/core/cdk` entirely.

### 4. `apps/core`'s `invalidate-cloudfront` script is wired to a full wildcard invalidation instead of the route-scoped script that already exists
**Classification: recommended**

`apps/core/package.json`:
```json
"invalidate-cloudfront": "AWS_PROFILE=management bash scripts/invalidate-cloudfront.sh",
"deploy": "pnpm run generate-env && pnpm run build && pnpm run upload && pnpm run invalidate-cloudfront"
```
`apps/core/scripts/invalidate-cloudfront.sh` invalidates `/*` (the entire CloudFront distribution). But `apps/core/scripts/invalidate-route-app.sh` already exists and correctly scopes the invalidation to `/core` and `/core/*` — it is simply never referenced by any script. Compare with `apps/form-design/package.json`, which correctly wires `invalidate-cloudfront` to its own `scripts/invalidate-route-app.sh` (scoped to `/form-design`/`/form-design/*`), and with `apps/shell/package.json`, which deliberately separates its narrow `invalidate-cloudfront` (→ `invalidate-shell-app.sh`, scoped to `/`, `/index.html`, `/assets/*`) from the explicit full-distribution `invalidate-all-cloudfront` (→ `invalidate-cloudfront.sh`) used only by the top-level `deploy-stage.sh`.

Core is the only app that gets this wrong: every standalone `pnpm run app -- core deploy <stage>` triggers a needless full-distribution invalidation (slower, and CloudFront full invalidations have real cost beyond the free tier) instead of the cheap, already-implemented `/core/*`-scoped one. Recommend pointing `invalidate-cloudfront` at `invalidate-route-app.sh` (matching form-design) and removing the now-redundant `invalidate-cloudfront.sh` from `apps/core/scripts`.

### 5. `healthController.ts`'s health check does not verify database connectivity
**Classification: optional**

```ts
export function getHealth(_req: Request, res: Response) {
  res.send("Healthy!");
}
```
This is the only health-check endpoint found in the reviewed files (`services/onboarding-service/src/controllers/healthController.ts`). It always returns success regardless of database/Secrets Manager/SSM reachability, so it cannot detect a broken DB connection — a meaningful gap for a "boring, observable" backend goal. A lightweight `SELECT 1` (or equivalent) would make this a real readiness check rather than pure liveness.

### 6. `app.ts` sets a wildcard `Access-Control-Allow-Origin: *` for all deployed environments, not just local
**Classification: optional**

`services/onboarding-service/src/app.ts` unconditionally sets `Access-Control-Allow-Origin: *` for every request, including in the Lambda-deployed `index.ts` path used by testing/staging/production. Since auth uses bearer tokens (not cookies), a wildcard CORS origin doesn't itself enable unauthenticated cross-origin access, so this is a fairly standard, low-risk pattern for this kind of API — flagging only so it's a confirmed, deliberate choice for the deployed environment rather than an oversight carried over from local dev convenience.

## Notes (confirmed-good / not findings)

- `database-migrate.ts`'s `getDatabaseName()` validates the database name against a safe identifier regex before use in `CREATE DATABASE`, and Flyway migrations are written with `IF NOT EXISTS`/`IF EXISTS` guards throughout, supporting safe re-runs.
- Stage selection is consistently explicit at the command site across `scripts/root-command.sh`'s `stage_arg`/`deployed_stage_arg` helpers, and `AWS_PROFILE` is always derived from the explicit stage argument rather than environment defaults.
- `scripts/destroy-stage.sh`/`scripts/deploy-stage.sh` correctly order service teardown/setup (document-analysis → onboarding → cognito → website on destroy; infra → services → frontends on deploy).
- Local-only scripts (`scripts/local-*.sh`) correctly gate all local infra (Postgres/MinIO) behind explicit `local-env.sh` sourcing and never touch AWS profiles.
- `pnpm run data -- *` commands are correctly restricted to `testing|staging|production` only (no `local` option) via `deployed_stage_arg`, preventing accidental use against a developer's local database through that path.
- `services/onboarding-service/database/sql/` migration ordering (V1–V15, plus the `document_analysis` schema's own V10) is sequential with no apparent gaps or conflicting numbering in the reviewed file list.
- README.md and README-RUN.md are internally consistent on local/deployed workflow ordering (login → deploy/seed → run) and accurately describe the local MinIO/Postgres bootstrap flow.
- `apps/shell`'s upload script correctly excludes `core/*` and `form-design/*` so a shell-only deploy never clobbers already-deployed route-app assets, matching the documented shared-bucket layout.

## Test Gaps

- No test exercises `scripts/reset-database.sh`'s production-reachability gap (finding #1) — a regression test (or simply removing the gap) would be the most direct way to close this.
- No test or CI check verifies that `apps/core/cdk` stack names don't collide with `apps/shell/cdk` (finding #3); a simple lint/grep step asserting no duplicate CDK stack IDs across `apps/*/cdk` would catch this class of issue earlier.
- No automated check confirms each app's `invalidate-cloudfront` script targets the correct scoped paths (finding #4).

## Review Limitations

- The exact AWS CDK default behavior for Aurora final-snapshot-on-delete when `removalPolicy: RemovalPolicy.DESTROY` is set without an explicit snapshot flag was not independently verified against the pinned `aws-cdk-lib` version; finding #2's severity does not depend on this detail (the core risk is the missing production confirmation gate, which holds regardless of snapshot behavior).
- CI/CD pipeline configuration (if any exists outside this repo) was not in scope; this review only covers the manual command surface defined in `package.json`/`scripts/`.
- `services/onboarding-service/database/sql/` migration *content* repeatability for the document-analysis schema was reviewed only via the files explicitly listed for this step; migrations outside the provided excerpt were not re-verified here (already covered in the prior step-0021 review).

