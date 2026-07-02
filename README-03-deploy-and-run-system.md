# 03 Deploy And Run System

## Install Dependencies

```bash
pnpm install
```

Clean install:

```bash
pnpm run package-cleanup
pnpm install
```

---

## Generate AWS Account Config

Run this after cloning, pulling, or changing account IDs:

```bash
pnpm run aws:accounts-config
```

Generated file:

```text
packages/shared/aws-accounts/src/index.ts
```

---

## Run Locally

Install the platform container runtime first:

```text
macOS:   OrbStack
Windows: Docker Desktop with WSL2 integration
```

Start local infrastructure:

```bash
pnpm run start:local
```

Run the backend:

```bash
pnpm run backend -- dev local
```

Run the frontend:

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

---

## Preview Locally

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

Built remotes:

```text
http://localhost:4173/core/remoteEntry.js
http://localhost:4173/form-design/remoteEntry.js
```

---

## Stop And Reset Local

Stop frontend and backend terminals with `Ctrl-C`.

Stop local containers:

```bash
pnpm run stop:local
```

Reset local data:

```bash
pnpm run database -- reset local
pnpm run start:local
```

Remove uploaded MinIO objects:

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

## Deploy Testing

```bash
aws sso login --profile management
aws sso login --profile testing
pnpm run aws:accounts-config
pnpm run bootstrap-up -- management
pnpm run bootstrap-up -- testing
pnpm run deploy -- testing
```

---

## Deploy Staging

```bash
aws sso login --profile management
aws sso login --profile staging
pnpm run aws:accounts-config
pnpm run bootstrap-up -- staging
pnpm run deploy -- staging
```

---

## Deploy Production

```bash
aws sso login --profile management
aws sso login --profile production
pnpm run aws:accounts-config
pnpm run bootstrap-up -- production
pnpm run deploy -- production
```

---

## Seed Data

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

---

## Reset Deployed Data

```bash
pnpm run data -- reset testing
pnpm run data -- reset staging
ACO24_CONFIRM_PRODUCTION_DATA_RESET=yes pnpm run data -- reset production
```

---

## URLs

Local:

```text
http://localhost:5173
```

Local preview:

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

## Destroy Testing

```bash
aws sso login --profile management
aws sso login --profile testing
pnpm run destroy -- testing
```

---

## Destroy Staging

```bash
aws sso login --profile management
aws sso login --profile staging
pnpm run destroy -- staging
```

---

## Destroy Production

```bash
aws sso login --profile management
aws sso login --profile production
pnpm run destroy -- production
```

Production destroy prompts for:

```text
destroy production infrastructure
```

---

## Destroy Bootstrap Resources

Destroy deployed stacks first.

Then:

```bash
pnpm run bootstrap-down -- testing
pnpm run bootstrap-down -- staging
pnpm run bootstrap-down -- production
pnpm run bootstrap-down -- management
```
