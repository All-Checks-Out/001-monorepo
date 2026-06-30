# Claude Review: Step 0016, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T04:48:56.289Z
- Command: `pnpm run claude:review -- 0016`

## Review Step

### 0016 Users, Business Entities, And Access Requests Backend

Purpose: review user/entity management, invitations, Cognito admin operations, and access-request lifecycles.

Files:

- `services/onboarding-service/src/controllers/associationController.ts`
- `services/onboarding-service/src/controllers/providerController.ts`
- `services/onboarding-service/src/database/corporationApplicationRepository.ts`
- `services/onboarding-service/src/database/accessRequestRepository.ts`
- `services/onboarding-service/src/database/appUserRepository.ts`
- `services/onboarding-service/src/database/corporationRepository.ts`
- `services/onboarding-service/src/services/cognitoAdmin.ts`

Focus:

- invitation and setup request lifecycle
- Cognito/database consistency
- entity ownership and approval rules
- duplicate users or entities

## Review Output

# Step 0016 Review: Users, Business Entities, And Access Requests Backend

## Findings

### 1. `createAppUser` silently no-ops on duplicate email, but caller cannot tell — blocking
`services/onboarding-service/src/database/appUserRepository.ts` — `createAppUser`

```ts
const result = await client.query<AppUserRow>(
  `INSERT INTO app_user (corporation_id, cognito_sub, email, status, permissions)
   VALUES ($1, $2, $3, 'invited', $4)
   ON CONFLICT (email) DO NOTHING
   RETURNING id, corporation_id, cognito_sub, email, status, permissions`,
  [input.corporationId, input.cognitoSub, input.email, input.permissions ?? []],
);

return result.rows[0] ?? null;
```

`ON CONFLICT (email) DO NOTHING` means a second invite/approval attempt for an email that already exists in `app_user` returns `null` with no error and no row. The Cognito side has already created/fetched a user (`inviteCognitoUser` runs first in the approval flow per `cognitoAdmin.ts`), so by the time this resolves to `null`, a Cognito identity may exist with nothing tying it to a corporation row, or — worse — the corporation the caller intended is silently *not* the corporation actually attached to that email (e.g., an email already belongs to a different corporation). The caller (`onboardingService.ts`, not in this excerpt) needs to check for `null` and produce a clear conflict response; if it instead treats `null` as success or crashes downstream on `result.id`, this is a defect. At minimum, this repository function should make the "did this insert actually happen" outcome unambiguous to its caller, and the calling service should explicitly reject with a clear "email already in use" error rather than silently dropping the request.

### 2. Cross-tenant email collision is not guarded against at approval time — recommended
`appUserRepository.ts` `createAppUser` enforces a global-unique `email` constraint across all corporations. Combined with finding #1, if Provider A invites `jane@example.com` and is later approved, and a different corporation (Association or Provider B) also tries to invite `jane@example.com`, the second `INSERT ... ON CONFLICT DO NOTHING` silently fails — but the second corporation's admin has no way to know the email is already claimed by an unrelated corporation. There's no repository function to check "is this email already associated with a different corporation" before calling Cognito (`inviteCognitoUser` would happily return the same `sub` for both). This can let an admin believe they invited a user to their corporation when the user is actually wired to a different one (or not wired at all). Worth a deliberate, explicit conflict check and error message rather than relying on `ON CONFLICT DO NOTHING` as the boundary.

### 3. `approveAccessRequest` / `rejectAccessRequest` provider-scoping is optional and silently permissive when omitted — recommended
`services/onboarding-service/src/database/accessRequestRepository.ts`

```ts
export async function approveAccessRequest(client: Client, id: number, providerCorporationId?: number) {
  const params: Array<number> = [id];
  const providerClause = providerCorporationId ? " AND provider_corporation_id = $2" : "";
  if (providerCorporationId) params.push(providerCorporationId);
  ...
```

These functions take an *optional* `providerCorporationId` tenant-scoping parameter. From `associationController.ts`, `decideAssociationAccessRequest` is called without a provider id (association-side, expected — associations can decide any). But the same repository function is reused by the provider-side decision path (`decideProviderAccessRequest` in `providerController.ts`), which presumably passes `context.corporationId` as the scoping argument to prevent a provider from approving/rejecting another provider's access request. Because the scoping is `?:` optional at the repository layer, a future caller (or a refactor) can trivially forget to pass it and the function will quietly perform an unscoped global update with no compile-time signal. This is a tenant-boundary-sensitive function expressed as "safe by convention" rather than "safe by type." Recommend requiring the scoping id as a non-optional parameter (or splitting into two explicitly-named functions: `approveAccessRequestAsAssociation` / `approveAccessRequestForProvider`) so the call site can't silently drop the boundary check.

### 4. `rejectCorporationApplicationForProvider` exists but unscoped `markCorporationApplicationApproved`/`rejectCorporationApplication` are also exported and reused across both association and provider approval flows — recommended
`corporationApplicationRepository.ts` has three related functions:
- `markCorporationApplicationApproved(client, id)` — unscoped, used for association-side approval of provider applications.
- `rejectCorporationApplication(client, id)` — unscoped.
- `rejectCorporationApplicationForProvider(client, id, providerCorporationId)` — scoped, presumably used by `rejectProviderCorporationApplication` in `providerController.ts`.

But there is no `approveCorporationApplicationForProvider` (scoped) counterpart — `approveProviderCorporationApplicationService` (called from `providerController.ts`) is not shown in this excerpt, but if it calls the unscoped `markCorporationApplicationApproved`, a provider could approve an AGENT/STAKEHOLDER application belonging to a *different* provider corporation by guessing/iterating application ids, since nothing in the repository call enforces `provider_corporation_id` ownership on approval — only on reject. This asymmetry (scoped reject, unscoped approve) is a concrete tenant-boundary risk worth confirming against `onboardingService.ts` (out of scope for this excerpt) and fixing if confirmed: add a scoped `approveCorporationApplicationForProvider` mirroring the reject function.

### 5. `recreateSeedCognitoUser` default password fallback is a committed, well-known credential — recommended
`services/onboarding-service/src/services/cognitoAdmin.ts`

```ts
export function getSeedUserPassword() {
  return process.env.ACO24_SEED_USER_PASSWORD ?? "Pass44$$";
}
```

If `ACO24_SEED_USER_PASSWORD` is unset in any deployed environment (staging, or — by misconfiguration — production), every seed user gets the hardcoded password `Pass44$$`, which is now public in this review document and the repo history. This function is presumably only invoked by seed scripts (out of this step's file list), but `cognitoAdmin.ts` itself doesn't gate this against deployment stage. Recommend asserting `ACO24_SEED_USER_PASSWORD` is required (throw if unset) at minimum in any non-local stage, rather than having a fallback that could fire silently in a misconfigured deployed environment. This is a config-default-safety concern matching the repo's "prefer explicit, reviewable choices… for authentication" guidance.

### 6. `deleteAllCognitoUsers` is a wide-blast-radius destructive operation with no scoping/confirmation built into the function itself — recommended
`cognitoAdmin.ts` `deleteAllCognitoUsers()` iterates the entire user pool and deletes every user, with no filter by environment, seed-tag, or corporation. This function's safety entirely depends on which script/route calls it and what guards that caller applies — none of which are in this step's file list. As written, the function itself offers no defense if accidentally wired into a reachable controller route or a misconfigured stage script. Worth confirming (in the relevant data-reset review step, 0021) that no HTTP-reachable controller calls this directly, and that it's gated to local/test stages only. Flagging here because it lives in the file reviewed for this step and is the most destructive primitive in it.

### 7. `inviteCognitoUser` reuse of an existing Cognito user does not check or sync `email_verified` / attribute drift — optional
`cognitoAdmin.ts` `inviteCognitoUser`: if `AdminGetUserCommand` finds an existing user, it returns the existing `sub` immediately without checking the user's current attributes (e.g., the user could be in `FORCE_CHANGE_PASSWORD` state from a prior incomplete invite, or have a different email_verified value). This is a minor consistency gap, not a security hole, since invite flow re-runs against the same UserPoolId/email.

## Notes (not findings)

- `appUserRepository.listUsersForCorporation` and `listUsersWithCorporations` correctly scope by `corporation_id` or join through it; no cross-tenant leakage observed in the read paths shown.
- `corporationApplicationRepository.listApplicationsForProvider` correctly scopes by `provider_corporation_id` and additionally filters `type IN ('AGENT', 'STAKEHOLDER')`, which looks intentional (providers only see applications against their own provider relationship, not top-level PROVIDER applications against the association).
- `accessRequestRepository.listAccessRequestsForProvider` / `listAccessRequestsForRequester` are both properly scoped reads.
- Controllers in both `associationController.ts` and `providerController.ts` consistently call `requireAssociationUserWithPermission` / `requireProviderUser` before any service call, and consistently validate path-parameter ids via `parseId`/`parseNamedId` before passing them on — good defensive parameter handling at the controller boundary.
- Zod body schemas in both controllers are reasonably tight (positive-int constraints, non-empty strings, enum-constrained actions).
- `cognitoAdmin.ts` correctly treats `UserNotFoundException` as a non-fatal "doesn't exist yet" signal rather than swallowing all errors.

## Test Gaps

- No test coverage visible in this excerpt for the duplicate-email invite/approval path (`createAppUser` returning `null`) — this is exactly the scenario in Finding 1 and would be cheap to add as a service-level unit test.
- No test coverage visible for provider-scoped vs. unscoped access-request/application decision functions verifying that a provider cannot act on another provider's request/application by id-guessing (Findings 3–4).
- No visibility into whether `deleteAllCognitoUsers` has any stage/environment guard test.

## Review Limitations

- `services/onboarding-service/src/services/onboardingService.ts` was referenced by both controllers but not included in this step's excerpts, so I could not directly confirm whether `createAppUser`'s `null` return is handled, or whether provider approval (`approveProviderCorporationApplicationService`) calls the scoped or unscoped application-repository function. Findings 1 and 4 are flagged as risks based on the repository-layer contracts shown; confirming them requires reading `onboardingService.ts` (in scope for step 0014/0015, not 0016).
- `onboardingTypes.ts` was not included, so I could not verify the exact DB constraint shape behind `ON CONFLICT (email)` (e.g., whether it's a partial/unique index scoped some other way) beyond what the SQL implies.
- No test files for this step's repositories/services were included, so "test gaps" above are inferred from absence in the provided excerpts, not confirmed by inspecting a test directory.

