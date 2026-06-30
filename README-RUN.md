# Login, Deploy With Data Seeding, Run

Use the commands in the normal order of events:

1. Login to AWS.
2. Deploy the target environment and seed its data.
3. Run or open the app.

The supported targets are:

- `local`
- `testing`
- `staging`
- `production`

Most commands take the target as an argument, for example `pnpm run deploy -- testing` or `pnpm run dev -- local`.

This repo supports macOS/Linux-style Bash workflows. Windows, PowerShell, and Git Bash compatibility are not maintained.

## 1. Login

Login to the AWS accounts you need before deploying.

```bash
aws sso login --profile management
aws sso login --profile testing
aws sso login --profile staging
aws sso login --profile production
```

For a single environment, login to `management` plus the target environment:

```bash
aws sso login --profile management
aws sso login --profile testing
```

## 2. Deploy With Data Seeding

Deploy a complete environment:

```bash
pnpm run deploy -- testing
pnpm run deploy -- staging
pnpm run deploy -- production
```

Seed the deployed environment:

```bash
ACO24_SEED_USER_PASSWORD='Pass44$$' pnpm run data -- seed testing
ACO24_SEED_USER_PASSWORD='Pass44$$' pnpm run data -- seed staging
ACO24_SEED_USER_PASSWORD='Pass44$$' pnpm run data -- seed production
```

`pnpm run data -- seed <stage>` runs database migrations first, clears the onboarding data tables, resets their ID sequences, and recreates the seeded Cognito users. You do not need to run `pnpm run data -- reset <stage>` before seeding.

Expected URLs:

```text
testing:    https://testing.aco24.net
staging:    https://staging.aco24.net
production: https://aco24.net
```

You can also print the deployed URL from SSM:

```bash
pnpm run url -- testing
pnpm run url -- staging
pnpm run url -- production
```

## 3. Run Fully Offline Locally

Local development runs without AWS credentials. It uses Postgres and MinIO in
Docker, the onboarding backend on port `3001`, the shell Vite app on port
`5173`, the core Vite app on port `5174`, and the form-design Vite app on port
`5175`.

Local mode is selected by `APP_ENV=local` and the tracked local run scripts.
Testing, staging, and production continue to use AWS Cognito and AWS S3.

Install workspace dependencies:

```bash
pnpm install
```

Install OrbStack for local Postgres and MinIO:

```bash
brew install --cask orbstack
```

Open OrbStack once after installing it. If macOS asks to install Rosetta during
OrbStack setup, allow it; the project itself does not depend on Rosetta, but
OrbStack may require it to finish first-run setup on Apple silicon. Docker
Desktop is not used by this repo.

The local scripts look for Docker on the normal `PATH`, in `~/.orbstack/bin`,
and in OrbStack's bundled CLI directory at
`/Applications/OrbStack.app/Contents/MacOS/xbin`, so both Mac Minis can use the
same Homebrew cask install without extra manual symlinks.

For `local`, Vite uses `.env.local` files to point the shell, core, and
form-design apps at local services. `pnpm run start:local` creates these files
from the tracked `.env.local-rename-me` templates. Run `pnpm run start:local`
before `pnpm run dev -- local`.

### Start Local Infrastructure

Create local Vite overrides, start local Postgres, start local MinIO, create
the required MinIO bucket, run database migrations, and seed sample users when
the local database is empty:

```bash
pnpm run start:local
```

The MinIO console is available at:

```text
http://localhost:9001
```

The default local MinIO login is:

```text
username: minioadmin
password: minioadmin
```

### Run The System Locally

Run the backend:

```bash
pnpm run backend -- dev local
```

In another terminal, run the shell, core, and form-design micro frontends
together:

```bash
pnpm run dev -- local
```

Open:

```text
http://localhost:5173
```

The shell runs on port `5173` and owns the global sidebar. It loads the core
remote from port `5174` and the form-design remote from port `5175`; each remote
renders its own in-app header. The local backend runs on port `3001`.

In local mode, the app does not show the Cognito hosted login. Instead, the app
shows a seeded developer-user dropdown. Choose any seeded database user and
continue; no password is required. API requests identify that selected local
user with a local-only `x-local-user-id` header.

Evidence uploads still use S3-style pre-signed URLs. In local mode those URLs
point at MinIO. Local mode does not run the document analysis service, does not
send EventBridge messages to document analysis, and does not ask MinIO to notify
the onboarding service after an object is uploaded. In testing, staging, and
production uploads continue to use AWS S3 ObjectCreated events and Cognito
remains the authentication source.

If you want to run the Vite apps directly without regenerating `.env` files:

```bash
pnpm -C apps/shell exec vite --host 0.0.0.0 --port 5173
pnpm -C apps/core exec vite --host 0.0.0.0 --port 5174
pnpm -C apps/form-design exec vite --host 0.0.0.0 --port 5175
```

### Optional: Preview The Built Frontends On One Port

To test the production-built frontend bundles locally through one Vite preview
server, first prepare local mode as usual:

```bash
pnpm run start:local
```

If the UI needs API access, run the backend in another terminal:

```bash
pnpm run backend -- dev local
```

Then build and preview the shell, core, and form-design apps as one composed
static site:

```bash
pnpm run preview -- local
```

Open:

```text
http://localhost:4173
```

The built remotes are served from the same preview server:

```text
http://localhost:4173/core/remoteEntry.js
http://localhost:4173/form-design/remoteEntry.js
```

This is different from `pnpm run dev -- local`: it does not use Vite hot reload,
and it is intended to check the built static frontend output in a shape closer
to the deployed website.

### Stop Everything Locally

Stop the frontend and backend processes with `Ctrl-C` in their terminals.

Remove managed `.env.local` files and stop the local Docker resources:

```bash
pnpm run stop:local
```

`stop:local` stops Postgres and stops/removes the managed MinIO container. The
local Docker volumes are left in place so data survives a normal stop/start.

### Reset Local Data

Reset the local database and then start local mode again:

```bash
pnpm run database -- reset local
pnpm run start:local
```

To also remove object files uploaded to MinIO, delete the managed MinIO Docker
volume after `stop:local`:

```bash
docker volume rm aco012-local-minio-data
```

## 4. Run Deployed Environments

For deployed environments, generate environment files and run the shell, core,
and form-design micro frontends together:

```bash
pnpm run dev -- testing
pnpm run dev -- staging
pnpm run dev -- production
```

Expected URLs:

```text
testing:    https://testing.aco24.net
staging:    https://staging.aco24.net
production: https://aco24.net
```

## Validation

Before or after a deploy, useful checks are:

```bash
pnpm run type-check
pnpm run build
```

## First-Time Setup

Bootstrap AWS accounts when needed:

```bash
pnpm run bootstrap-up -- management
pnpm run bootstrap-up -- testing
pnpm run bootstrap-up -- staging
pnpm run bootstrap-up -- production
```

Deploy DNS once from the management account:

```bash
pnpm run dns-zone-up
pnpm run org-redirect-up
```

## Less Common Commands

Generate frontend environment files manually:

```bash
pnpm run generate-env -- local
pnpm run generate-env -- testing
pnpm run generate-env -- staging
pnpm run generate-env -- production
```

Run only one local frontend:

```bash
pnpm run app -- shell dev local
pnpm run app -- core dev local
pnpm run app -- form-design dev local
```

Deploy individual parts:

```bash
pnpm run app -- shell deploy testing
pnpm run app -- core deploy testing
pnpm run app -- form-design deploy testing
pnpm run service -- cognito-service deploy testing
pnpm run service -- onboarding-service deploy testing
```

Replace `testing` with `staging` or `production` as needed.

`local` deploys for shell, core, and form-design generate local env files and run builds. They do not deploy AWS infrastructure. `pnpm run service -- onboarding-service deploy local` runs local database migrations. `pnpm run service -- cognito-service deploy local` is informational because local development does not deploy Cognito.

Destroy a complete environment:

```bash
pnpm run destroy -- testing
pnpm run destroy -- staging
pnpm run destroy -- production
```

Destroy order is handled by `scripts/destroy-stage.sh`:

1. document analysis service
2. onboarding service
3. Cognito service
4. website bucket contents
5. shell website infrastructure

The core and form-design MFEs are uploaded into the same website bucket under
`/core` and `/form-design`, so emptying or destroying the shell website
infrastructure also removes the deployed remote files.

For local cleanup:

```bash
pnpm run destroy -- local
```

Destroy individual parts:

```bash
pnpm run app -- shell destroy testing
pnpm run service -- onboarding-service destroy testing
pnpm run service -- cognito-service destroy testing
```

Replace `testing` with `staging` or `production` as needed.

Core and form-design are stored in the shared website bucket. Use
`pnpm run destroy -- <stage>` or `pnpm run app -- shell destroy <stage>` to remove the bucket-backed website.

Reset deployed data only when you need to wipe the onboarding database schema and clear all Cognito users:

```bash
pnpm run data -- reset testing
pnpm run data -- reset staging
```

Production reset is blocked unless you confirm it explicitly:

```bash
ACO24_CONFIRM_PRODUCTION_DATA_RESET=yes pnpm run data -- reset production
```

## AWS Config Reference

Example `~/.aws/config`:

```ini
[profile management]
sso_session = aco24
sso_account_id = 305069434672
sso_role_name = AdministratorAccess
region = eu-west-2

[profile testing]
sso_session = aco24
sso_account_id = 175616158444
sso_role_name = AdministratorAccess
region = eu-west-2

[profile staging]
sso_session = aco24
sso_account_id = 668723997661
sso_role_name = AdministratorAccess
region = eu-west-2

[profile production]
sso_session = aco24
sso_account_id = 989793932938
sso_role_name = AdministratorAccess
region = eu-west-2

[sso-session aco24]
sso_start_url = https://d-9c67b1f327.awsapps.com/start
sso_region = eu-west-2
sso_registration_scopes = sso:account:access
```

Example shell config:

```bash
export PS1="$ "
export BASH_SILENCE_DEPRECATION_WARNING=1

# Default AWS region. Stage-specific root commands set AWS_PROFILE through scripts/root-command.sh.
# Manual AWS commands should still specify --profile explicitly.
export AWS_REGION=eu-west-2
export AWS_DEFAULT_REGION=eu-west-2

export ROOT_ASSOCIATION_USER_EMAIL='aco24.root@gmail.com'

alias prun='pnpm --silent run '
alias gitcred='git credential-manager github '
alias gitcred-list='git credential-manager github list'
alias gitcred-logout='git credential-manager github logout `git credential-manager github list`'

eval "$(/opt/homebrew/bin/brew shellenv)"
```
