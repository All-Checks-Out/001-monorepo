# Install, Test Locally, Verify

Use the commands in the normal order of events:

1. Install workspace dependencies.
2. Run the local test suites.
3. Run type-checks or full verification when needed.

The local tests do not require AWS login, deployed environments, local Docker
services, or the app to be running.

This repo supports macOS/Linux-style Bash workflows. Windows, PowerShell, and
Git Bash compatibility are not maintained.

## 1. Install

Install workspace dependencies:

```bash
pnpm install
```

## 2. Run All Local Tests

Run every package test script that exists:

```bash
pnpm test
```

At the time of writing this runs:

- shared permission matrix tests
- backend permission tests for the onboarding service
- frontend permission tests for the core app

## 3. Run One Test Area

Run only backend tests:

```bash
pnpm run test:backend
```

Run only frontend tests:

```bash
pnpm run test:frontend
```

You can also run package-local test scripts directly:

```bash
pnpm --filter @shared/permissions test
pnpm --filter @services/onboarding-service test
pnpm --filter @apps/core test
```

## 4. Type-Check

Run all package type-check scripts:

```bash
pnpm run type-check
```

Run only one package type-check:

```bash
pnpm --filter @services/onboarding-service type-check
pnpm --filter @apps/core type-check
```

## 5. Full Local Verification

Run lint, type-check, tests, and builds for packages that define those scripts:

```bash
pnpm run verify
```

For CI-style verification with a frozen lockfile install first:

```bash
pnpm run verify:ci
```

## Current Test Commands

Shared permission tests use Vitest:

```bash
pnpm --filter @shared/permissions test
```

Backend tests use Vitest:

```bash
pnpm --filter @services/onboarding-service test
```

Frontend tests use Vitest, React Testing Library, and jsdom:

```bash
pnpm --filter @apps/core test
```

Tests are kept beside the production code they verify, using `.test.ts` or
`.test.tsx` filenames.
