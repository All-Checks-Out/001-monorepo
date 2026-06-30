# Claude Review: Step 0006, Run 02

- Current git branch: `main`
- Reviewed at: 2026-06-30T06:37:05.375Z
- Command: `pnpm run claude:review -- 0006`

## Review Step

### 0006 Backend Identity, Authorization, Setup, Users, And Entity Workflows

Purpose: review backend request identity, local identity, authorization, tenant boundaries, bootstrap/setup, users, entities, invitations, and access-request/application lifecycle logic.

Runner note: this is a larger review step. Use at least `CLAUDE_REVIEW_TIMEOUT_MS=600000` when running this step, and raise `CLAUDE_REVIEW_MAX_SOURCE_BYTES` if Claude reports that relevant source was truncated.

Files:

- `packages/shared/permissions/`
- `services/onboarding-service/src/middleware/`
- `services/onboarding-service/src/controllers/`
- `services/onboarding-service/src/services/currentUser.ts`
- `services/onboarding-service/src/services/localIdentity.ts`
- `services/onboarding-service/src/services/localMode.ts`
- `services/onboarding-service/src/services/permissions.ts`
- `services/onboarding-service/src/services/setupService.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/services/cognitoAdmin.ts`
- `services/onboarding-service/src/database/appUserRepository.ts`
- `services/onboarding-service/src/database/accessRequestRepository.ts`
- `services/onboarding-service/src/database/corporationRepository.ts`
- `services/onboarding-service/src/database/corporationApplicationRepository.ts`
- `services/onboarding-service/src/database/setupRepository.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`
- `services/onboarding-service/src/local.ts`
- `services/onboarding-service/src/localMode.ts`

Focus:

- deployed auth claim mapping and unauthenticated route boundaries
- local-only endpoint isolation
- current-user and corporation resolution
- least privilege and permission vocabulary drift
- authorization bypasses and tenant/entity boundary checks
- empty-system bootstrap safety
- duplicate users/entities and Cognito/database consistency
- invitation, setup request, application, and access-request lifecycle rules

## Review Output

# Step 0006 Review — Backend Identity, Authorization, Setup, Users, And Entity Workflows

## Findings

### 1. Local-mode auth lets any caller impersonate any user by header — no secret required
**File:** `services/onboarding-service/src/middleware/auth.ts:30-58` (`attachLocalAuth`)
**Classification: blocking**

`attachLocalAuth` trusts the client-supplied `x-local-user-id` header completely: it looks up that user ID in the database and attaches their `cognito_sub`/`email` as the authenticated identity, with no password, token, or session check at all. Anyone who can reach the local API (including same-machine browser scripts, other local processes, or anything proxied during local dev) can become any user, including the root Association user, just by setting a header to `1`.

This is described as a "local developer path," and the guide explicitly allows a local dev path that "cannot leak into deployed environments" — `isLocalMode()` (`services/onboarding-service/src/localMode.ts`) does gate this to `APP_ENV === "local" && !AWS_LAMBDA_FUNCTION_NAME`, so it is not reachable in deployed Lambda. That mitigates the most severe risk (it cannot run in production), but within local mode itself there is no authentication concept at all — it's pure trust-the-header impersonation, with no local credential check (no password/local session token). Given this also backs `local.ts`'s CORS config (`Access-Control-Allow-Origin: *` plus allowing the `x-local-user-id` header), any web page loaded in a developer's browser could fetch `http://localhost:3001/...` with an arbitrary `x-local-user-id` and act as any local user, including the seeded root Association account. Since local dev often runs against shared or persistent local databases that may later mirror production-like data, this is worth hardening: at minimum local auth should require a fixed, non-guessable local dev secret (e.g., an env-configured shared token) in addition to the user id, rather than pure self-declared identity, OR document explicitly that this is the accepted threat model for local-only use and restrict the wildcard CORS origin.

### 2. `requirePermission`/`hasPermission` checks use the user's stored corporation, but DDQ/provider-permission vocabulary can silently drift from the corporation type after permission edits
**File:** `services/onboarding-service/src/services/onboardingService.ts` (`requirePermission`, `requireAnyPermission`) + `packages/shared/permissions/src/index.ts` (`hasPermission`)
**Classification: optional**

`hasPermission` in `@shared/permissions` already guards against stale/cross-type permissions by checking `isPermissionForCorporationType` before checking the user's list, so a PROVIDER permission stored on an ASSOCIATION user's row (e.g., from a bug or manual DB edit) won't be honored. This is good defense-in-depth. No issue found here — noted for completeness, not a finding.

### 3. `updateOtherUserPermissionsForMyCorporation` lets any user with `user-permissions:change` grant themselves admin-equivalent power over peers, including granting `user-permissions:change` itself, with no floor/ceiling check
**File:** `services/onboarding-service/src/services/onboardingService.ts` (`updateOtherUserPermissionsForMyCorporation`)
**Classification: recommended**

The function blocks a user from changing their *own* permissions (`user.id === context.user.id`), but it does not check whether the **caller's own permission set** matches or exceeds what they're about to grant to someone else. A user who has `user-permissions:change` (but, say, lacks `users:invite` or `ddq-packs:edit`) can grant another user `ddq-packs:edit`, `users:invite`, or any other permission valid for the corporation type — including escalating a peer (or an alt account they control) beyond their own privilege level. Combined with finding #4 (no protection against being the last/only such user), this allows privilege escalation within a corporation by any single `user-permissions:change` holder. Consider requiring that granted permissions be a subset of the granter's own effective permissions, or treat `user-permissions:change` as inherently equivalent to full admin for that corporation (a deliberate, documented design choice) — but right now nothing enforces a ceiling, so it should at least be a reviewed decision rather than an accident.

### 4. No "last admin" protection: removing `user-permissions:change` from the only privileged user in a corporation can lock that corporation out of self-service permission management
**File:** `services/onboarding-service/src/services/onboardingService.ts` (`updateOtherUserPermissionsForMyCorporation`)
**Classification: optional**

If a corporation has exactly one user with `user-permissions:change`, and that user edits another user's permissions in a way that doesn't preserve any holder of `user-permissions:change` (e.g., there is only one other user and the editor removes `user-permissions:change` from them — wait, the editor can't edit themselves) — actually since self-edit is blocked, the editor retains their own permission, so a full lockout isn't directly reachable via this single endpoint. Demoting this to optional/no-op observation: worth a quick confirmation there isn't a path (e.g. via Association `users:read`/other endpoints) to fully strip `user-permissions:change` from a corporation, but nothing in the provided source shows one.

### 5. `setupRootUser` / `hasAssociationUser` bootstrap check has a TOCTOU race between the public read and the create
**File:** `services/onboarding-service/src/services/setupService.ts` (`setupRootUser`), `services/onboarding-service/src/database/setupRepository.ts` (`hasAssociationUser`, `createRootAssociationUser`)
**Classification: probably not worth fixing**

`setupRootUser` calls `hasAssociationUser(client)` and then, only inside `createRootAssociationUser`, re-checks `hasAssociationUser` within a transaction before inserting — so the actual race is closed at the DB layer (the second check is inside `BEGIN`/`COMMIT` and will correctly return `null` if a concurrent caller wins). The outer check in `setupRootUser` is redundant but harmless (just an early-exit optimization), and the real guard is the second check. No defect — included only to confirm the bootstrap path is race-safe, not as an actionable finding.

### 6. `attachLocalAuth` silently proceeds unauthenticated for malformed/missing `x-local-user-id`, and silently proceeds unauthenticated for valid-looking but non-existent user IDs
**File:** `services/onboarding-service/src/middleware/auth.ts:38-58`
**Classification: probably not worth fixing**

If the header is missing, non-numeric, or references a user that doesn't exist, `attachLocalAuth` just calls `next()` without setting `req.auth`, and downstream `requireAuth`/`getCurrentUserContext` correctly return 401/404. This is consistent and not a security gap — flagged here only as a note that local-mode auth failures are silent (no 400) rather than an error finding.

### 7. Public corporation application endpoint allows an applicant to choose any `provider_corporation_id` without any uniqueness check against existing pending applications, enabling unbounded duplicate AGENT/STAKEHOLDER applications per provider/email
**File:** `services/onboarding-service/src/controllers/publicController.ts` (`createPublicCorporationApplication`), `services/onboarding-service/src/services/onboardingService.ts` (`submitCorporationApplication`), `services/onboarding-service/src/database/corporationApplicationRepository.ts` (`createCorporationApplication`)
**Classification: optional**

`submitCorporationApplication` validates that AGENT/STAKEHOLDER applications target an approved PROVIDER corporation, but does not check whether the same `applicant_email` already has a pending (or approved) application against that same provider. A public, unauthenticated caller can submit unlimited duplicate applications for the same email/provider pair, which then all show up for the provider/association to triage. This is a UX/data-hygiene gap rather than a security bypass (approval still creates a fresh corporation+user via `assertAppUserEmailAvailable`, which blocks duplicate *user* creation), so impact is limited to clutter, not unauthorized access.

### 8. `approveProviderCorporationApplication` / `approveAssociationApplication` create the Cognito identity (or local identity) *before* checking `assertAppUserEmailAvailable` failure path leaves an orphaned Cognito invite if the DB transaction later fails
**File:** `services/onboarding-service/src/services/onboardingService.ts` (`approveAssociationApplication`, `approveProviderCorporationApplication`)
**Classification: optional**

In both approval flows, the order is: `assertAppUserEmailAvailable` (DB check) → `createUserIdentity`/`inviteCognitoUser` (external Cognito call, not transactional) → `createApprovedCorporation` → `createAppUser` (which itself has a redundant `ON CONFLICT (email) DO NOTHING` race-safety net) → `markCorporationApplicationApproved`, all inside `BEGIN`/`COMMIT`. Since the Cognito invite happens outside the DB transaction, if the later DB transaction rolls back (e.g., due to a concurrent insert winning the `ON CONFLICT` race, returning `null` from `createAppUser` and triggering `ServiceError(409)` + `ROLLBACK`), the Cognito user invite that was already sent is not cleaned up — leaving an orphaned Cognito user with no corresponding `app_user` row. This is a pre-existing eventual-consistency gap inherent to mixing an external IdP call with a DB transaction; not new to this step and likely an accepted tradeoff, but worth flagging as a known gap. No automated cleanup/compensation path exists in the reviewed code.

### 9. `requireAssociationUserWithPermission` / `requireProviderUserWithPermission` (in `currentUser.ts`) duplicate logic already present in `onboardingService.ts`'s local `requirePermission`/`requireAnyPermission`, but enforce permission scoping differently (corporation-type-gated vs. raw permission check) — worth confirming no call site mismatches the wrong helper
**File:** `services/onboarding-service/src/services/currentUser.ts` vs `services/onboarding-service/src/services/onboardingService.ts`
**Classification: probably not worth fixing**

Two parallel sets of permission-gating helpers exist: HTTP-layer helpers in `currentUser.ts` (`requireAssociationUserWithPermission`, `requireProviderUserWithPermission`, `requirePermission`) that write the HTTP response directly, and service-layer helpers in `onboardingService.ts` (local `requirePermission`, `requireAnyPermission`) that throw `ServiceError`. Both correctly funnel through `hasPermission`, and call sites consistently match the expected corporation type per controller (`associationController.ts` uses the association variant, `providerController.ts` uses provider-context service-layer checks). No mismatch found in the reviewed files, but this dual-helper pattern is worth being aware of if a future controller is added under the wrong type. Flagged as a note, not a defect.

---

## Summary / Notes (confirmed-good checks, not findings)

- **Tenant boundary on `updateOtherUserPermissionsForMyCorporation`:** correctly scoped — fetches `user` by `userId`, then checks `user.corporation_id !== context.user.corporation_id` before allowing any change, preventing cross-corporation permission tampering.
- **`getProviderDDQChecklist*`/evidence endpoints:** all read corporation-scoped checklist/task context via `readProviderDDQChecklistTaskContext(client, context.corporation.id, packId, taskId)`, so a provider cannot reach another provider's checklist tasks by guessing IDs — boundary check is embedded in the repository query, consistently used across save/complete/evidence flows.
- **`decideProviderAccessRequest`/`approveProviderCorporationApplication`:** both re-fetch the target row scoped to `context.corporation.id` before acting (`listAccessRequestsForProvider(...).find(...)`, `listApplicationsForProvider(...).find(...)`), rather than trusting a raw ID against an unscoped table — correct tenant-boundary pattern, applied consistently.
- **Permission vocabulary (`@shared/permissions`)** is well-structured: `as const satisfies Record<CorporationType, readonly string[]>` gives compile-time guarantee that every corporation type has a permission list, and `hasPermission`/`isPermissionForCorporationType` jointly prevent a permission valid for one corporation type from being honored under another.
- **`createRootAssociationUser`** is correctly race-safe via a transactional re-check (see Finding 5).
- **`createAppUser`**'s `ON CONFLICT (email) DO NOTHING` is a sound belt-and-suspenders duplicate-prevention mechanism alongside the explicit `assertAppUserEmailAvailable` pre-check, correctly handled by checking for `null` return and raising `ServiceError(409)` at every call site.
- **`isLocalMode()`** gate (`APP_ENV === "local" && !AWS_LAMBDA_FUNCTION_NAME`) correctly prevents the local auth/local identity code paths from being reachable when actually deployed to Lambda, regardless of `APP_ENV` misconfiguration in a deployed stage, since `AWS_LAMBDA_FUNCTION_NAME` is set by the Lambda runtime itself and not attacker-controllable.
- **`local.ts`** correctly mounts `localDevRoutes` only under `/local-dev` and gates the actual controller (`listLocalDevUsers`) with a redundant `requireLocalMode` check inside `localDevController.ts`, providing defense-in-depth beyond just `local.ts` not being deployed.
- **`zod` body parsing (`parseBody`)** is applied consistently across all controllers reviewed, rejecting malformed bodies with 400 before reaching service logic.

## Test Gaps

- No reviewed test files cover `attachLocalAuth`'s impersonation surface (Finding 1) — a test asserting that local mode requires more than a guessable header would materially de-risk this area if local auth is hardened.
- No reviewed test coverage for `updateOtherUserPermissionsForMyCorporation`'s escalation gap (Finding 3) — a test asserting a `user-permissions:change` holder cannot grant a permission they don't themselves hold would catch regressions once/if a ceiling check is added.
- No reviewed test coverage for the Cognito/DB consistency gap on approval rollback (Finding 8).

## Review Limitations

- `services/onboarding-service/src/services/localMode.ts` was listed as both `localMode.ts` (service) and a duplicate top-level `src/localMode.ts`; only one implementation was provided in the excerpts (`isLocalMode` gating on `APP_ENV`/`AWS_LAMBDA_FUNCTION_NAME`). I treated both references as the same file per the architecture's single-source expectation; if these are genuinely two different files with diverging logic, that would need separate confirmation outside this review's source.
- `services/onboarding-service/src/database/onboardingTypes.ts` (referenced extensively for row typing) was not included in the excerpts, so permission/status enum exhaustiveness (e.g., `AppUserRow.status` values, `CorporationRow.status` values) could not be independently verified against the controllers/services that branch on them.
- `services/onboarding-service/src/database/seedDataRepository.ts` and the seed fixture schema (`scripts/src/lib/seedFixture.ts`, `testing-seed-data.json`) referenced by `setupService.ts` were not in scope/excerpts, so seed/reset idempotency and cross-environment coupling could not be assessed here (that is explicitly step 0008 territory per the guide's Data/Runtime step).
- Express route wiring (`app.ts`, middleware ordering for `attachAuth`/`requireAuth` around `protectedRoutes` vs `publicRoutes`) was not included, so I could not independently confirm that every route under `protectedRoutes` actually has `requireAuth` applied upstream — this is assumed from the route file structure and naming (`publicRoutes` vs `protectedRoutes`) but not directly verified from provided source.

