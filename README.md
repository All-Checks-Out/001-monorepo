# All Checks Out

All Checks Out is a pnpm workspace for the ACO web apps, backend services, local development tooling, and AWS deployment scripts.

This README is deliberately command-first: install, run, test, preview, deploy.

## Install

```bash

pnpm install
```

---

## Run locally (normal development)

Start local infrastructure:

```bash
pnpm run start:local
```

Run the backend:

```bash
pnpm run backend -- dev local
```

Run the frontend (Vite dev mode):

```bash
pnpm run dev -- local
```

Open:

```text
http://localhost:5173
```

---

## Run locally (production-style preview)

Start local infrastructure:

```bash
pnpm run start:local
```

Run the backend:

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

---

## Build

```bash
pnpm run build
```

---

## Test

Everything:

```bash
pnpm test
```

Everything a PR runs:

```bash
pnpm run verify
```

---

## Deploy

Testing:

```bash
aws sso login --profile testing
pnpm run deploy -- testing
```

Staging:

```bash
aws sso login --profile staging
pnpm run deploy -- staging
```

Production:

```bash
aws sso login --profile production
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

## URLs

Local (Vite dev)

```text
http://localhost:5173
```

Local (Preview)

```text
http://localhost:4173
```

Testing

```bash
pnpm run url -- testing
```

Staging

```bash
pnpm run url -- staging
```

Production

```bash
pnpm run url -- production
```
