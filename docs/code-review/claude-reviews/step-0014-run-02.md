# Claude Review: Step 0014, Run 02

- Current git branch: `main`
- Reviewed at: 2026-06-30T04:35:12.304Z
- Command: `pnpm run claude:review -- 0014`

## Review Step

### 0014 Backend Authorization And Tenant Boundaries

Purpose: review authorization checks and tenant/entity boundary enforcement across backend controllers and services.

Files:

- `services/onboarding-service/src/controllers/sharedController.ts`
- `services/onboarding-service/src/controllers/associationController.ts`
- `services/onboarding-service/src/controllers/providerController.ts`
- `services/onboarding-service/src/controllers/setupController.ts`
- `services/onboarding-service/src/controllers/publicController.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/services/permissions.ts`
- `services/onboarding-service/src/services/currentUser.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`

Focus:

- authorization bypasses
- tenant/entity boundary checks
- dangerous endpoints missing permission checks
- public versus authenticated controller separation
- read/write ownership rules

## Review Output

# Claude Review — Step 0014: Backend Authorization And Tenant Boundaries

## Findings

### 1. Destructive demo-data reset endpoints are mounted on `publicRoutes` with no authentication — `blocking`

`services/onboarding-service/src/routes/onboardingRoutes.ts`:

```ts
publicRoutes.post("/data/full-factory-reset", fullFactoryResetDemoData);
publicRoutes.post("/data/seeded-factory-reset", seededFactoryResetDemoData);
publicRoutes.post("/data/recreate-sample-data", recreateSampleData);
```

These call straight into `setupController.ts` → `fullFactoryResetDemoDataService` / `seededFactoryResetDemoDataService` / `recreateSampleDataService`, none of which take a request context or call any permission/auth helper. They are registered on the same `publicRoutes` router as `getPublicProviders` and `createPublicCorporationApplication` — i.e. routes intended to be reachable by an unauthenticated browser. Unlike the local-only `listLocalDevUsers`, which is deliberately isolated on a separate `localDevRoutes` router (presumably mounted only in local mode), the factory-reset endpoints have no comparable isolation visible anywhere in this routing file.

If `publicRoutes` is mounted unconditionally in deployed environments (which its name and the presence of the public corporation-application/provider-browsing endpoints strongly suggests), any unauthenticated caller who can reach the API could wipe and reseed the entire database in any deployed stage, including production.

Action: confirm in `app.ts`/`setupService.ts` (out of scope for this step) whether these three routes are gated by `isLocalMode()` somewhere outside of `onboardingRoutes.ts`. If not, they must require local-mode gating (ideally moved onto `localDevRoutes`, mirroring `listLocalDevUsers`) or be removed/protected for deployed stages before this is acceptable. `getRootSetupStatus`/`createRootUser` being public is a reasonable bootstrap exception (assuming `setupRootUser` is idempotent/one-shot internally), but the reset/reseed endpoints are unambiguously destructive and should not share that exception by default.

### 2. Permission grant has no "you can't grant what you don't hold" check — privilege escalation path — `recommended`

`services/onboarding-service/src/services/onboardingService.ts`, `updateOtherUserPermissionsForMyCorporation`:

```ts
const user = await getAppUserById(client, userId);
if (!user || user.corporation_id !== context.user.corporation_id) { ... }
if (user.id === context.user.id) {
  throw new ServiceError(400, "Users cannot change their own permissions.");
}
let validatedPermissions = validatePermissionsForCorporationType(context.corporation.type, permissions);
const updatedUser = await updateAppUserPermissions(client, user.id, validatedPermissions);
```

The only checks are tenant ownership (good) and "not yourself" (good). There is no check that the calling user's own permission set is a superset of, or otherwise covers, the permissions being granted. A user who holds only `user-permissions:change` (and nothing else) can grant a colleague — or, via a colleague who then grants it back, themselves — every permission valid for the corporation type, including `user-permissions:change` itself. The "can't change your own permissions" guard only blocks direct self-escalation; it does not block a two-hop escalation through a second account.

Smallest reasonable fix: require that the granter currently holds every permission being assigned (or restrict `user-permissions:change` to a small set of "admin" permissions that themselves cannot be escalated through this path). This is a design decision worth discussing with Richard rather than auto-fixing.

### 3. Public access-request creation lets anyone submit a request "as" any approved corporation — `recommended`

`services/onboarding-service/src/controllers/publicController.ts` → `createPublicAccessRequest`, routed unauthenticated via `publicRoutes.post("/access-requests", ...)`, and `submitAccessRequest` in `onboardingService.ts`:

```ts
const accessRequest = await createAccessRequest(client, {
  requesterCorporationId: requester.id,
  providerCorporationId: provider.id,
});
```

The only validation is that both corporation ids exist, are `approved`, and have the right types (`AGENT`/`STAKEHOLDER` requester, `PROVIDER` target). There is no proof that the caller is actually associated with `requester_corporation_id` — corporation ids are small sequential integers, so any unauthenticated caller can create access requests "on behalf of" any approved agent/stakeholder corporation toward any provider simply by guessing ids. By the time a corporation is `approved`, it already has at least one real app user (created during application approval), so this action should plausibly go through an authenticated endpoint scoped to `context.corporation.id`, the same way `getMyAccessRequests` already is. The current public path is purely a nuisance/spam vector bounded by the provider's subsequent explicit approval, but it doesn't match the read/write-ownership pattern used everywhere else in this controller set.

### 4. Provider DDQ pack listing endpoints have no permission check, unlike the equivalent association endpoints — `recommended`

`services/onboarding-service/src/controllers/providerController.ts` → `listProviderDDQPacks`, `listAvailableProviderDDQPacks`, `listProviderDDQPackItems` all call only `requireProviderUser` (i.e. "is this a PROVIDER corp user"), and the corresponding service functions (`getProviderDDQPacks`, `getAvailableProviderDDQPacks`, `getProviderDDQPackItems` in `onboardingService.ts`) call no `requirePermission`/`requireAnyPermission` at all.

Compare with the association side, where the parallel read endpoint is explicitly gated:

```ts
export async function listAssociationDDQPacks(req: Request, res: Response) {
  const context = await requireAssociationUserWithPermission(req, res, "ddq-packs:read");
  ...
```

Any user in a provider corporation — regardless of which permissions have been assigned to them — can list the corporation's DDQ packs and pack items, while the equivalent association-side action requires `ddq-packs:read`. This is an inconsistency in least-privilege enforcement between the two sides of essentially the same feature. Worth confirming with Richard whether provider-side pack visibility is intentionally open to all corp members (in which case this is fine and should be left alone) or whether it should be gated the same way the association side is.

## Notes / Confirmed-Good Checks (not findings)

- Association-owned resources (DDQ packs, pack items, form templates) are consistently scoped through `*ForAssociation(client, context.corporation.id, …)` repository calls, so one association corporation cannot read/write another association's packs or templates.
- Provider-owned checklist/evidence/form-response flows (`readProviderDDQChecklistTaskContext`, `createProviderDDQChecklistTaskEvidenceUploadUrl`, `updateProviderDDQChecklistTaskEvidenceTags`, `saveProviderDDQChecklistTaskFormResponse`, etc.) all scope reads/writes through `context.corporation.id` and correctly gate on `ddq-packs:perform-checks` / `providerChecklistViewPermissions` before touching data.
- `updateOtherUserPermissionsForMyCorporation` and `inviteUserForMyCorporation` both correctly scope target users to the caller's own `corporation_id`, preventing cross-tenant user management.
- `decideProviderAccessRequest` / `approveProviderCorporationApplication` / `rejectProviderCorporationApplication` all look up the target row scoped to `context.corporation.id` before checking type-specific approve permissions (`agent-requests:approve` vs `stakeholder-requests:approve`), which correctly prevents one provider from approving/rejecting another provider's applications.
- `getAssociationCorporations` / `getAssociationUsers` / `getAssociationAccessRequests` / `decideAssociationAccessRequest` return system-wide data with no per-association scoping. This is consistent with the system only ever having a single ASSOCIATION corporation (the public application schema only allows `PROVIDER`/`AGENT`/`STAKEHOLDER` applications, and `approveAssociationApplication` only ever creates the root association during bootstrap), so this is treated as an intentional single-tenant admin view rather than a tenant-boundary defect.
- `getProviderDDQPackItems` ignoring tenant scoping (param literally named `_context`) is consistent with the existing "open catalog" design already used by `getAvailableProviderDDQPacks` (any provider can browse any published pack from any association before adding it to their pool), so it is not flagged as a defect on its own — only the missing permission check (#4 above) is.

## Test Gaps

- No tests were in scope/visible for this step covering: (a) cross-corporation access attempts to association or provider DDQ pack/item/template endpoints returning 404 rather than leaking data, (b) the permission-escalation path described in Finding 2, (c) unauthenticated reachability of the `/data/*` reset endpoints.

## Review Limitations

- `services/onboarding-service/src/services/setupService.ts`, `src/app.ts`, and `src/database/*Repository.ts` files referenced by `onboardingService.ts` (e.g. `listCorporations`, `approveAccessRequest`, `listAccessRequestsForProvider`) were not part of this step's file list and were not inspected. Finding 1 in particular should be confirmed against `app.ts`/`setupService.ts` mounting/guard logic before treating it as fully proven, though the routing file alone already shows no environment gating at the route-registration level.
- `@shared/permissions` (the actual permission vocabulary and `PERMISSIONS_BY_CORPORATION_TYPE` table) was reviewed in step 0012 and was not re-fetched here; Finding 4's comparison assumes a provider-side `ddq-packs:read`-equivalent permission exists, based on the parallel association code path.

