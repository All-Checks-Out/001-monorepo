# All Checks Out

All Checks Out is a pnpm workspace for the ACO web apps, backend services, local development tooling, and AWS deployment scripts.

This README is deliberately command-first: install, run, test, preview, deploy, destroy.

## Prerequisites

- macOS/Linux shell with Bash
- Node.js with Corepack-enabled `pnpm@11.8.0`
- AWS CLI and AWS SSO profiles named `management`, `testing`, `staging`, `production`
- AWS CDK CLI available as `cdk`
- Flyway available as `flyway`
- OrbStack for local Postgres and MinIO

macOS helper for Flyway and pgAdmin:

```bash
pnpm run install:macos
```

Install OrbStack on macOS:

```bash
brew install --cask orbstack
```

---

## Install

```bash
pnpm install
```

Clean install:

```bash
pnpm run package-cleanup
pnpm install
```

---

## Configure AWS Account IDs

Each developer configures their own AWS account IDs locally.

Bash users should add these exports to `~/.bash_profile`.

Zsh users should add these exports to `~/.zshrc`.

```bash
export ACO24_MANAGEMENT_ACCOUNT_ID="111111111111"
export ACO24_TESTING_ACCOUNT_ID="222222222222"
export ACO24_STAGING_ACCOUNT_ID="333333333333"
export ACO24_PRODUCTION_ACCOUNT_ID="444444444444"
```

Replace the placeholders with your real 12-digit AWS account IDs.

Bash users can reload with:

```bash
source ~/.bash_profile
```

Zsh users can reload with:

```bash
source ~/.zshrc
```

Or open a new terminal.

From the repo root, generate the local TypeScript account config:

```bash
pnpm run aws:accounts-config
```

This creates `packages/shared/aws-accounts/src/index.ts`. The file is generated from your shell environment and ignored by git.

For full AWS organization, Identity Center, account assignment, bootstrap, and teardown setup, see [README-aws-account-setup.md](README-aws-account-setup.md).

---

## Run Locally (Normal Development)

Start local infrastructure:

```bash
pnpm run start:local
```

This creates `.env.local` files, starts Postgres and MinIO, creates the MinIO evidence bucket, runs migrations, and seeds local users when the database is empty.

Run the backend:

```bash
pnpm run backend -- dev local
```

Run the frontend in Vite dev mode:

```bash
pnpm run dev -- local
```

Open:

```text
http://localhost:5173
```

Ports:

```text
shell:         5173
core:          5174
form-design:   5175
backend:       3001
MinIO console: 9001
```

MinIO console:

```text
http://localhost:9001
username: minioadmin
password: minioadmin
```

Local mode does not use Cognito hosted login. It uses a seeded developer-user dropdown; no password is required. The selected user is sent to the API with the local-only `x-local-user-id` header.

Local uploads use MinIO. Testing, staging, and production use Cognito and AWS S3.

---

## Vite Dev Mode

```bash
pnpm run dev -- local
```

This is the normal inner-loop development mode. It runs separate Vite dev servers with hot reload: shell on `5173`, core on `5174`, and form-design on `5175`. The shell loads the remotes from those local ports.

---

## Run Locally (Production-Style Preview)

Start local infrastructure:

```bash
pnpm run start:local
```

Run the backend if the UI needs API access:

```bash
pnpm run backend -- dev local
```

Build and preview:

```bash
pnpm run preview -- local
```

Open:

```text
http://localhost:4173
```

Preview mode builds the frontend bundles first and serves the composed static frontend through one Vite preview server. It does not use hot reload, and is closer to deployed static hosting.

Built remotes:

```text
http://localhost:4173/core/remoteEntry.js
http://localhost:4173/form-design/remoteEntry.js
```

---

## Stop And Reset Local

Stop frontend and backend terminals with `Ctrl-C`.

Stop local containers and remove generated `.env.local` files:

```bash
pnpm run stop:local
```

Reset local data:

```bash
pnpm run database -- reset local
pnpm run start:local
```

Remove uploaded MinIO objects after stopping local mode:

```bash
pnpm run stop:local
docker volume rm aco012-local-minio-data
```

---

## Build

```bash
pnpm run type-check
pnpm run build
```

---

## Test

```text
unit-test:frontend        Frontend Vitest tests

unit-test:backend         Backend Vitest tests

unit-test:all             All Vitest tests

e2e-test:frontend         Frontend Playwright browser tests

e2e-test:frontend:verbose Verbose Playwright run showing tests and steps

e2e-test:frontend:headed  Headed Playwright run

e2e-test:frontend:debug   Debug Playwright run

test:all                  All unit and e2e tests
```

```bash
pnpm run unit-test:frontend
pnpm run unit-test:backend
pnpm run unit-test:all
pnpm run e2e-test:frontend
pnpm run e2e-test:frontend:verbose
pnpm run e2e-test:frontend:headed
pnpm run e2e-test:frontend:debug
pnpm run test:all
```

Use `e2e-test:frontend:verbose` when you want to watch the browser test progress in the terminal.

Playwright-specific UI testing files live under `ui-testing/playwright/`.

---

## Database

Run migrations:

```bash
pnpm run database -- update local
pnpm run database -- update testing
pnpm run database -- update staging
pnpm run database -- update production
```

Reset and rerun migrations:

```bash
pnpm run database -- reset local
pnpm run database -- reset testing
pnpm run database -- reset staging
pnpm run database -- reset production
```

Production database reset prompts for:

```text
reset production database
```

---

## Deploy

Deploy uses the target profile for workload resources and `management` for website/CloudFront operations.

Before deploying from a fresh clone or after changing AWS account IDs, run:

```bash
pnpm run aws:accounts-config
```

Before the first deploy to an account, bootstrap it:

```bash
pnpm run bootstrap-up -- management
pnpm run bootstrap-up -- testing
pnpm run bootstrap-up -- staging
pnpm run bootstrap-up -- production
```

Testing:

```bash
aws sso login --profile management
aws sso login --profile testing
pnpm run bootstrap-up -- management
pnpm run bootstrap-up -- testing
pnpm run deploy -- testing
```

Staging:

```bash
aws sso login --profile management
aws sso login --profile staging
pnpm run bootstrap-up -- staging
pnpm run deploy -- staging
```

Production:

```bash
aws sso login --profile management
aws sso login --profile production
pnpm run bootstrap-up -- production
pnpm run deploy -- production
```

---

## Destroy

Destroy deployed stacks before destroying bootstrap resources.

Testing:

```bash
aws sso login --profile management
aws sso login --profile testing
pnpm run destroy -- testing
```

Staging:

```bash
aws sso login --profile management
aws sso login --profile staging
pnpm run destroy -- staging
```

Production:

```bash
aws sso login --profile management
aws sso login --profile production
pnpm run destroy -- production
```

Production destroy asks you to type:

```text
destroy production infrastructure
```

After deployed stacks are gone, delete CDK bootstrap resources if needed:

Log in to any profiles whose bootstrap resources you are deleting if your SSO sessions have expired.

```bash
pnpm run bootstrap-down -- testing
pnpm run bootstrap-down -- staging
pnpm run bootstrap-down -- production
pnpm run bootstrap-down -- management
```

---

## Seed Data

Seeding runs migrations first, clears onboarding data, resets IDs, and recreates seeded Cognito users.

Testing:

```bash
ACO24_SEED_USER_PASSWORD='<password>' pnpm run data -- seed testing
```

Staging:

```bash
ACO24_SEED_USER_PASSWORD='<password>' pnpm run data -- seed staging
```

Production:

```bash
ACO24_SEED_USER_PASSWORD='<password>' pnpm run data -- seed production
```

Reset deployed data:

```bash
pnpm run data -- reset testing
pnpm run data -- reset staging
ACO24_CONFIRM_PRODUCTION_DATA_RESET=yes pnpm run data -- reset production
```

---

## URLs

Local (Vite dev):

```text
http://localhost:5173
```

Local (preview):

```text
http://localhost:4173
```

Testing:

```bash
pnpm run url -- testing
```

Staging:

```bash
pnpm run url -- staging
```

Production:

```bash
pnpm run url -- production
```

Expected deployed URLs:

```text
testing:    https://testing.aco24.net
staging:    https://staging.aco24.net
production: https://aco24.net
```

---

## Typical Flow

1. Install

```bash
pnpm install
```

2. Configure AWS account IDs

```bash
pnpm run aws:accounts-config
```

3. Run locally

```bash
pnpm run start:local
pnpm run backend -- dev local
pnpm run dev -- local
```

4. Test

```bash
pnpm run test:all
```

5. Bootstrap and deploy testing

```bash
aws sso login --profile management
aws sso login --profile testing
pnpm run bootstrap-up -- management
pnpm run bootstrap-up -- testing
pnpm run deploy -- testing
```

6. Seed testing

```bash
ACO24_SEED_USER_PASSWORD='<password>' pnpm run data -- seed testing
```

7. Open testing

```bash
pnpm run url -- testing
```
