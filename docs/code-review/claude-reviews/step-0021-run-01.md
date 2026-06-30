# Claude Review: Step 0021, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T05:37:13.774Z
- Command: `pnpm run claude:review -- 0021`

## Review Step

### 0021 Database Migrations, Seed, Reset, And Export

Purpose: review database schema changes, migration scripts, data seeding/reset/export, and production safeguards.

Files:

- `services/onboarding-service/src/database/`
- `services/onboarding-service/scripts/src/database-migrate.ts`
- `services/onboarding-service/scripts/src/database-show-secret.ts`
- `services/onboarding-service/scripts/src/data-seed.ts`
- `services/onboarding-service/scripts/src/data-seed-local.ts`
- `services/onboarding-service/scripts/src/data-reset.ts`
- `services/onboarding-service/scripts/src/data-export.ts`
- `docs/dev-plans-and-handovers/data-seeding-project.md`

Focus:

- migration ordering and repeatability
- environment/stage safety
- production reset/export guards
- seed data ownership and idempotency
- secret handling

## Review Output

# Step 0021 Review — Database Migrations, Seed, Reset, And Export

## Findings

### 1. `database-migrate.ts` builds the Flyway command via string interpolation including the raw DB password — `services/onboarding-service/scripts/src/database-migrate.ts` (the `execSync` call near the end of `main()`)
The JDBC URL, username, and password are interpolated directly into a shell command string passed to `execSync(...)`. If a generated/secret password ever contains shell metacharacters (`$`, `` ` ``, `"`, `\`), this breaks at best and is a command-injection-adjacent risk at worst, since the credentials come from Secrets Manager / SSM and aren't validated for shell-safety. The database name is validated against an identifier regex, but the credential values are not.
**Classification: recommended.** Worth tightening (e.g., pass via `execFileSync` with an args array, or via Flyway's environment-variable config `FLYWAY_PASSWORD`/`FLYWAY_USER`/`FLYWAY_URL` instead of inline CLI args) since credentials are external, not developer-controlled.

### 2. `data-seed.ts` production guard only checks for password presence, not an explicit "yes I mean production" confirmation — `services/onboarding-service/scripts/src/data-seed.ts` `assertSeedAllowed()`
```ts
function assertSeedAllowed() {
  if (getStage() === "production" && !process.env.ACO24_SEED_USER_PASSWORD) {
    throw new Error(...);
  }
}
```
This only requires `ACO24_SEED_USER_PASSWORD` to be set. That variable is also useful/likely already set as a normal habit in testing/staging workflows, so it provides much weaker protection than `data-reset.ts`'s explicit `ACO24_CONFIRM_PRODUCTION_DATA_RESET=yes` gate. More importantly, `data-seed.ts` unconditionally calls `clearExistingRows(client)` (a `DELETE FROM` of every onboarding table) before reseeding — on production this is a full destructive wipe-then-reseed gated only by an env var whose primary purpose is "what password to assign," not "I intend to destroy production data."
**Classification: blocking.** A destructive whole-table delete against production data should require the same explicit, single-purpose confirmation pattern already established in `data-reset.ts` (`ACO24_CONFIRM_PRODUCTION_DATA_RESET=yes`), not be inferred from an unrelated password variable.

### 3. `data-seed.ts` deletes/reseeds tables that don't include some currently-existing schema (evidence, tags, document_analysis) — compare `TABLES_IN_DELETE_ORDER` in `data-seed.ts` vs `TABLES_IN_RESET_ORDER` in `seedDataRepository.ts`
`data-seed.ts`'s `TABLES_IN_DELETE_ORDER` and `SEQUENCES_IN_RESET_ORDER` omit `provider_ddq_checklist_task_evidence`, `provider_ddq_checklist_task_evidence_tag`, and the `document_analysis.*` tables that `seedDataRepository.ts`'s `TABLES_IN_RESET_ORDER` (used by `data-seed-local.ts`) does include. If `data-seed.ts` runs against testing/staging more than once after evidence rows exist (e.g. uploaded files referencing checklist tasks), the `DELETE FROM provider_ddq_checklist_task` step will fail or orphan rows because evidence/tags FK-reference checklist tasks that are about to be deleted, while `document_analysis.*` rows referencing those evidence rows are never cleared at all, leaving stale cross-schema data after a reseed.
**Classification: recommended.** The two seed/reset table lists (`data-seed.ts` and `seedDataRepository.ts`) have drifted and should be kept as a single source of truth, or `data-seed.ts` should be updated to clear the same full table set `seedDataRepository.ts` already encodes correctly.

### 4. `data-seed.ts` and `data-seed-local.ts` independently reimplement the same seeding logic — `services/onboarding-service/scripts/src/data-seed.ts` vs `services/onboarding-service/src/database/seedDataRepository.ts` + `data-seed-local.ts`
`data-seed.ts` contains its own copies of `seedCorporations`, `seedUsers`, `seedApplications`, `seedAccessRequests`, `seedDDQPacks`, `seedFormTemplates`, `seedProviderDDQPacks`, `seedProviderDDQChecklists` — functions that are near-duplicates of the ones already exported from `src/database/seedDataRepository.ts` and used by `data-seed-local.ts`. The duplication is exactly how finding #3 happened: the table-reset lists and per-table insert logic diverged silently between the two seeding paths.
**Classification: recommended.** `data-seed.ts` should import and reuse `seedDataRepository.ts`'s functions (passing a Cognito-backed `getCognitoSub` callback) the same way `data-seed-local.ts` does, instead of maintaining a second copy. This directly reduces the risk in finding #3 recurring.

### 5. `database-show-secret.ts` prints raw DB credentials (including password) to stdout — `services/onboarding-service/scripts/src/database-show-secret.ts`
```ts
console.log(JSON.stringify(credentials, null, 2));
```
This dumps the database username/password plaintext to the terminal/log with no stage gate or confirmation. If this is ever invoked in a captured CI log, shared terminal session, or screen-recorded demo against a deployed (testing/staging/production) stage, the DB password is fully exposed. There's no `--confirm` flag or explicit acknowledgment step before printing secrets, unlike the reset/seed scripts which at least gate production behind an explicit flag.
**Classification: recommended.** Since this is a deliberate debug script for local developer use, consider requiring explicit `--show-secret` style confirmation or at minimum redacting the password by default (printing it only behind an extra flag) to reduce accidental shoulder-surfing/log-capture exposure, especially since output isn't restricted to local stage.

### 6. `setupRepository.ts`'s `resetOnboardingData` truncates only legacy tables, not DDQ/form-template tables — `services/onboarding-service/src/database/setupRepository.ts`
```ts
export async function resetOnboardingData(client: Client) {
  await client.query(
    `TRUNCATE TABLE corporation_access_request, corporation_application, app_user, corporation RESTART IDENTITY CASCADE`,
  );
}
```
This function truncates only the four original onboarding tables. It does not include `ddq_pack`, `ddq_pack_item`, `form_templates`, `provider_ddq_pack`, `provider_ddq_checklist*`, or `document_analysis.*`. Since `corporation` is truncated with `CASCADE`, any FK-dependent rows in those newer tables would actually cascade-delete anyway (Postgres `TRUNCATE ... CASCADE` follows FK dependency graphs even for tables not explicitly listed), so this is likely not a correctness bug, but it does mean the explicit table list here is stale/misleading relative to the current schema and creates the same kind of drift risk seen in finding #3 if a future schema change removes the FK-cascade path.
**Classification: optional.** Worth confirming `CASCADE` is doing the intended cleanup and either documenting that reliance explicitly or aligning the table list with `seedDataRepository.ts`'s `TABLES_IN_RESET_ORDER` for clarity, since two near-identical "reset everything" implementations (`resetOnboardingData` here vs `clearSeededDatabaseRows` in `seedDataRepository.ts`) exist with different table lists and no shared source of truth.

### 7. `data-export.ts` has no stage restriction and is described as "read-only" only in docs, not enforced in code — `services/onboarding-service/scripts/src/data-export.ts`
The script runs unconditionally against whatever stage `createDbClient` resolves to (via `AWS_PROFILE`/SSM), with no `getStage()` check at all. The dev-plan doc says "Staging export should be read-only," and the queries are indeed all `SELECT`, so there's no destructive risk — but there's also no explicit print of which stage is being exported from before/while running, so a developer could export from the wrong stage without an obvious signal (the only stage breadcrumb is `sourceStage: getStage()` written into the fixture file after the fact).
**Classification: optional.** Consider logging the resolved stage at the start of `main()` (e.g., `console.log(\`Exporting from stage: ${getStage()}\`)`) so the target environment is visible at the command site, consistent with the repo's "stage must be obvious at the command site" standard.

## Notes (not findings)

- `data-reset.ts`'s production guard (`ACO24_CONFIRM_PRODUCTION_DATA_RESET=yes`) is a good explicit pattern and is the right model to copy into `data-seed.ts` (finding #2).
- `seedDataRepository.ts`'s `clearSeededDatabaseRows` correctly orders tables for FK-safe truncation including the document-analysis schema and evidence/tag tables; this is the more complete and currently-correct table list.
- `data-seed-local.ts` has a sensible "only seed if `app_user` is empty" idempotency guard and correctly restricts itself to `APP_ENV=local`.
- `requireMappedId` pattern (in both `seedDataRepository.ts` and `data-seed.ts`) gives clear fail-fast errors for fixture/legacy-id mismatches — good for catching seed-fixture bugs early.
- `createRootAssociationUser` in `setupRepository.ts` correctly wraps the first-association-user bootstrap in a transaction with a re-check (`hasAssociationUser`) inside the transaction, guarding against a duplicate-root race.
- `database-migrate.ts`'s `getDatabaseName()` correctly validates the database name against a safe identifier regex before using it in `CREATE DATABASE`.
- Migration retry/backoff logic (`connectWithRetry`) is reasonable for tolerating RDS cold-start delays during deploy.

## Test Gaps

- No automated test exercises `data-seed.ts`'s production-guard logic (finding #2) or confirms its table-delete list stays in sync with `seedDataRepository.ts` (finding #3) — a schema-drift regression here would only surface as a runtime FK error during an actual seed run against a non-empty database.
- No test verifies `database-migrate.ts`'s shell-command construction is safe against credential values containing shell-special characters (finding #1).
- No test confirms `resetOnboardingData`'s `TRUNCATE ... CASCADE` actually clears DDQ/form-template/evidence data, relying entirely on implicit FK cascade behavior (finding #6).

## Review Limitations

- This review only has the bounded excerpts listed for step 0021; the actual Flyway SQL migration files under `services/onboarding-service/database/sql/` were not included, so ordering/repeatability of individual `V*__*.sql` migrations could not be directly verified beyond the runner script (`database-migrate.ts`) itself.
- `scripts/src/lib/seedFixture.ts`, `scripts/src/lib/cognitoSeed.ts`, `scripts/src/lib/onboardingDatabase.ts`, `scripts/src/lib/ssm.ts`, and `scripts/src/lib/stage.ts` were referenced but not included in the excerpts, so their correctness (e.g., `getStage()`'s source of truth, fixture file read/write safety) could not be independently verified.

