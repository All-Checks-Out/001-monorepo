# Claude Review: Step 0015, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T04:44:43.241Z
- Command: `pnpm run claude:review -- 0015`

## Review Step

### 0015 Bootstrap And Public Setup Backend

Purpose: review empty-system setup and public registration/bootstrap paths.

Files:

- `services/onboarding-service/src/services/setupService.ts`
- `services/onboarding-service/src/controllers/setupController.ts`
- `services/onboarding-service/src/controllers/publicController.ts`
- `services/onboarding-service/src/database/setupRepository.ts`
- `services/onboarding-service/src/database/corporationRepository.ts`
- `services/onboarding-service/src/database/appUserRepository.ts`
- `services/onboarding-service/src/database/corporationApplicationRepository.ts`

Focus:

- empty-system bootstrap safety
- duplicate entities/users
- public setup lifecycle
- first user and first entity ownership

## Review Output

# Step 0015 Review: Bootstrap And Public Setup Backend

## Findings

### 1. `setupController.ts` exposes destructive demo-data reset endpoints with no visible authorization check
`fullFactoryResetDemoData`, `seededFactoryResetDemoData`, and `recreateSampleData` controllers (services/onboarding-service/src/controllers/setupController.ts:35-58) call directly into `setupService` functions that truncate/clear the entire `corporation`, `app_user`, `corporation_application`, and `corporation_access_request` tables (and in deployed mode delete **all** Cognito users via `deleteAllCognitoUsers()` in services/onboarding-service/src/services/setupService.ts:109-130). None of these three controller functions reference `req` at all (the parameter is `_req`), so there is no evidence in the provided source that any permission/role check happens before the route handler runs. If these routes are reachable by any authenticated (or worse, unauthenticated) caller in a deployed environment, this is a full-tenant data-wipe and Cognito user-deletion endpoint with no req-based guard visible in this file.
**Classification: blocking** — confirm route-level middleware (e.g. an admin/root-only permission check) is applied in `onboardingRoutes.ts` before these controllers run. This file alone does not prove the gap, but the lack of any check in the controller or service layer means the entire safety burden rests on a route file not included in this step's excerpts. Given the destructive blast radius (all corporations, all users, all Cognito accounts), this needs explicit confirmation, not an assumption.

### 2. `setupRootUser` has a TOCTOU race that can create two ASSOCIATION root users
`setupService.ts:31-49` calls `hasAssociationUser(client)` as a pre-check, then separately calls `inviteCognitoUser(email)` (an external network call), and only afterward calls `createRootAssociationUser`. `createRootAssociationUser` (services/onboarding-service/src/database/setupRepository.ts:18-49) does re-check `hasAssociationUser` inside its own transaction, so the **database** insert is correctly guarded against a race. However, if two concurrent root-setup requests both pass the first `hasAssociationUser` check in `setupService.ts:35`, both will call `inviteCognitoUser(email)` and only one will win the DB insert — the loser gets a successful-looking external invite (or, in local mode, a deterministic `localCognitoSub`) but then `createRootAssociationUser` returns `null`, correctly producing a 409. The Cognito invite for the losing request is not cleaned up.
**Classification: optional** — the DB-level race is closed by the repository's internal check, so duplicate root users cannot be persisted. The residual issue is an orphaned Cognito invite on the losing concurrent request, which is a minor cleanup/ops nuisance, not a data-integrity defect, and only matters in the narrow empty-system bootstrap window.

### 3. Public corporation application accepts a `provider_corporation_id` for AGENT/STAKEHOLDER types with no validation that the referenced corporation exists or is an approved PROVIDER
`publicController.ts:8-13` defines `corporationApplicationSchema` allowing any positive integer for `provider_corporation_id`, and `createPublicCorporationApplication` (publicController.ts:19-31) passes it straight through to `submitCorporationApplication` without checking the referenced corporation's existence, type, or approval status in this file. `corporationApplicationRepository.createCorporationApplication` (corporationApplicationRepository.ts:5-21) likewise inserts the row with no existence/type check — it relies entirely on whatever FK constraint exists in the schema (not shown). If there is no FK constraint (or if the FK exists but allows referencing a non-PROVIDER or non-approved corporation), an applicant can submit an AGENT/STAKEHOLDER application against an arbitrary or unapproved `provider_corporation_id`, creating orphaned or misattributed pending applications visible to the wrong provider once approved.
**Classification: recommended** — verify in `onboardingService.submitCorporationApplication` (not included in this step's excerpts) whether the provider corporation's existence/type/approval is validated before insert. If not, add that check at the service layer, since this is a public, unauthenticated endpoint and the only gate against nonsense or cross-tenant-confusing data.

### 4. `createAppUser`'s `ON CONFLICT (email) DO NOTHING` silently swallows duplicate-email root creation, producing an ambiguous `null` that is indistinguishable from "already configured"
In `appUserRepository.ts:73-90`, `createAppUser` uses `ON CONFLICT (email) DO NOTHING`. When `createRootAssociationUser` calls this (setupRepository.ts:38-44), if the chosen root email already exists as a user row in **any** other corporation (not necessarily an ASSOCIATION user — e.g., a PROVIDER user who registered earlier with the same email), the insert returns no row, `user` is falsy, the function rolls back and returns `null`, and the controller responds with the generic `"Root user is already configured."` 409 message in `setupController.ts:25-31`. This is misleading: the actual cause is an email collision with a pre-existing non-association user, not that root setup is already complete. An operator trying to bootstrap the system would get a confusing, incorrect error message that doesn't point at the real conflict.
**Classification: recommended** — distinguish "root already configured" (the `hasAssociationUser` check) from "email collision" (the `ON CONFLICT DO NOTHING` no-op) so the bootstrap error is accurate. This matters specifically for the empty-system bootstrap flow, which depends on clear failure feedback.

### 5. `resetOnboardingData` in `setupRepository.ts` is dead/unreferenced in this step's excerpts but performs an unguarded full truncate
`setupRepository.ts:53-60` defines `resetOnboardingData`, which does a `TRUNCATE ... RESTART IDENTITY CASCADE` across `corporation_access_request`, `corporation_application`, `app_user`, and `corporation` — equivalent in scope to the demo-data wipe functions, but with no caller visible anywhere in the excerpts for this step (`setupService.ts` uses `clearSeededDatabaseRows` from a different module instead). If this function is in fact unused dead code, it should be removed per repo standards (no unused scaffolding); if it is called from elsewhere (e.g. a script not in this step), its safety depends entirely on that caller's environment guard, which is outside this review's visibility.
**Classification: optional** — likely dead code given no caller appears in the reviewed files; flag for removal if confirmed unused elsewhere in the codebase.

## Notes (not findings)

- `hasAssociationUser` + `createRootAssociationUser`'s internal re-check correctly prevents two ASSOCIATION corporations/root users from being persisted concurrently — the core "first entity ownership" safety property holds at the database layer.
- `getRootSetupStatus` is appropriately read-only and side-effect-free.
- Local-mode vs. deployed-mode branching (`isLocalMode()`) is consistently applied across `setupRootUser`, `fullFactoryResetDemoData`, `seededFactoryResetDemoData`, and `recreateSampleData` — local mode never touches real Cognito, which matches the documented local/deployed separation goal.
- `seedDemoDatabase`'s transaction wraps `clearSeededDatabaseRows` + all seed steps in one `BEGIN`/`COMMIT`/`ROLLBACK`, which is the correct pattern for all-or-nothing demo reseeding.
- The public application/access-request schemas (`publicController.ts:8-17`) correctly coerce and validate numeric IDs and constrain `type` to a fixed enum, which is good input hygiene at the boundary.

## Test Gaps

- No test coverage is visible in this step's excerpts for: concurrent root-setup races, the `ON CONFLICT DO NOTHING` collision path in `createAppUser`, or authorization enforcement on the `setupController` reset/reseed endpoints.
- No test coverage visible for public application submission against a non-existent or unapproved `provider_corporation_id`.

## Review Limitations

- `onboardingRoutes.ts` (which would show whether `setupController`'s reset/reseed endpoints are gated behind admin/root authorization middleware) was not included in this step's excerpts. Finding #1's severity depends entirely on that file's content.
- `onboardingService.submitCorporationApplication` (which would show whether provider-corporation existence/type/approval is validated before insert) was not included in this step's excerpts. Finding #3 depends on that file's content.
- The `corporation_application` table's foreign key / check constraints (schema/migration files) were not included, so it's unknown whether a DB-level constraint already mitigates Finding #3.
- Callers of `resetOnboardingData` outside the listed files were not visible, so Finding #5's "dead code" classification is provisional.

