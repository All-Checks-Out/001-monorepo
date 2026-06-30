# Claude Review: Step 0014, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T03:44:45.349Z
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

# Review 0014 — Backend Authorization And Tenant Boundaries

## Findings

### 1. Public, unauthenticated destructive data-reset endpoints — `blocking`

`services/onboarding-service/src/routes/onboardingRoutes.ts`:

```ts
publicRoutes.post("/data/full-factory-reset", fullFactoryResetDemoData);
publicRoutes.post("/data/seeded-factory-reset", seededFactoryResetDemoData);
publicRoutes.post("/data/recreate-sample-data", recreateSampleData);
```

These are mounted on `publicRoutes`, alongside `getRootSetupStatus`/`createRootUser` (which make sense as public bootstrap endpoints). The corresponding handlers in `setupController.ts` (`fullFactoryResetDemoData`, `seededFactoryResetDemoData`, `recreateSampleData`) take `_req: Request` — they read nothing from the request and perform no permission, role, or environment check before calling the underlying service. As written at the routing/controller layer, any unauthenticated caller who can reach this service can wipe and reset all data.

This conflicts with the repo's explicit design goal: "Prefer explicit, reviewable choices over implicit fallbacks for ... destructive operations, and environment selection." Even if `setupService.ts` (not in this step's excerpts) contains an internal guard such as a local-mode or non-production check, that guard is invisible at the controller/route layer, which is exactly where this kind of safety boundary should be legible. Destructive admin operations like these should require authentication plus an explicit permission, and the production/staging reachability of these routes should be obvious from the route registration itself, not buried in service internals.

**Action**: confirm whether `setupService.ts` restricts these to local/non-production. If not, gate these three routes behind authentication + permission (or remove them from any deployed router) before this is acceptable in a non-local environment.

### 2. DDQ Pack operations have no association-corporation scoping, unlike Form Templates — `recommended`

In `associationController.ts` / `services/onboardingService.ts`, Form Templates are explicitly scoped to the caller's own association corporation:

```ts
getAssociationFormTemplates(context)          // uses context.corporation.id
getAssociationFormTemplate(context, id)       // uses context.corporation.id
createAssociationFormTemplate(context, ...)   // uses context.corporation.id
updateAssociationFormTemplate(context, id, ...)
deleteAssociationFormTemplate(context, id)
```

But the parallel DDQ Pack functions in the very same file take no corporation id at all:

```ts
getAssociationDDQPacks()
getAssociationDDQPack(id)
createAssociationDDQPack(input)
updateAssociationDDQPack(id, input)
changeAssociationDDQPackStatus(id, action)
deleteAssociationDDQPack(id)
getAssociationDDQPackItems(packId)
createAssociationDDQPackItem(context, packId, ...)   // context only used to resolve form templates
updateAssociationDDQPackItem(context, packId, itemId, ...)
deleteAssociationDDQPackItem(packId, itemId)
```

Any authenticated `ASSOCIATION`-type user holding `ddq-packs:edit`/`ddq-packs:read` can read, publish, archive, or delete a DDQ Pack regardless of which association corporation created it — there is no `corporation_id` ownership check or filter anywhere in this call chain.

This may be intentional if the product genuinely treats "the Association" as a single global entity (other association-level resources — `getAssociationCorporations`, `getAssociationUsers`, `getAssociationApplications`, `getAssociationAccessRequests` — are similarly unscoped). But the Form Template code sitting right next to it in the same controller deliberately scopes by corporation, so the inconsistency is not self-evidently correct either way. Per this repo's review standards, unexplained inconsistency between two adjacent, structurally similar resources is itself a maintainability/audit risk. This needs an explicit decision: either DDQ Packs should be scoped like Form Templates, or Form Template's corp-scoping is unnecessary and the documented architecture should say associations are a singleton so future code doesn't re-introduce scoping inconsistently.

### 3. Public access-request endpoint accepts an arbitrary `requester_corporation_id` with no authentication — `recommended`

`publicController.ts`:

```ts
publicRoutes.post("/access-requests", createPublicAccessRequest);
```

`createPublicAccessRequest` takes `requester_corporation_id` and `provider_corporation_id` directly from an unauthenticated request body, validated only for existence/approval/type (`onboardingService.submitAccessRequest`). There is no check that the caller is actually a member of `requester_corporation_id`. Since corporation ids are small sequential integers (`z.coerce.number().int().positive()`), any anonymous caller can create pending access-request records on behalf of any existing, approved AGENT/STAKEHOLDER corporation against any approved PROVIDER, simply by guessing ids.

The actual access grant still requires an authenticated Provider or Association approval, so this does not directly grant unauthorized data access, but it lets an unauthenticated party create records that *appear* to originate from a legitimate corporation, flood a provider's/association's pending-request queue, or probe which corporation ids exist and are approved. Given that authenticated users already have a `CurrentUserContext` with `context.corporation.id` available via `sharedController.ts`/`getMyAccessRequests`, the natural fix is for this action to be a protected route deriving `requester_corporation_id` from the authenticated user's own corporation rather than trusting the body.

### 4. Archived DDQ Packs remain addable/visible to providers — `optional`

In `onboardingService.ts`:

```ts
export async function addProviderDDQPack(...) {
  const pack = await getDDQPack(client, ddqPackId);
  if (!pack || pack.status === "draft") {
    throw new ServiceError(404, "DDQ Pack not found.");
  }
  ...
}

export async function getProviderDDQPackItems(...) {
  const pack = await getDDQPack(client, packId);
  if (!pack || pack.status === "draft") {
    throw new ServiceError(404, "DDQ Pack not found.");
  }
  ...
}
```

Both functions exclude only `draft` packs, so `archived` packs are still addable to a provider's pool and their items still readable. If "archived" is meant to retire a pack from active use (as the `archive`/`restore` status-transition naming in the same file suggests), providers should likely not be able to newly add an archived pack. This is a minor business-rule gap rather than an authorization bypass; confirm intended semantics for archived packs.

### 5. `requireProviderUserWithPermission` appears unused in the reviewed files — `probably not worth fixing`

`currentUser.ts` exports `requireProviderUserWithPermission`, but `providerController.ts` only ever calls `requireProviderUser`, pushing all permission checks into the service layer (`onboardingService.ts`) instead. This isn't a defect — both approaches enforce permissions — but it leaves an exported helper with no caller in the reviewed surface, and the inconsistency (association controllers gate at the controller layer, provider controllers gate inside the service layer) makes the codebase slightly harder to audit at a glance. Worth a quick check whether this helper is used outside this step's scope before treating it as dead code.

## Notes (not findings)

- Most provider-facing mutation paths (`addProviderDDQPack`, `getOrCreateProviderDDQChecklist`, `changeProviderDDQChecklistStatus`/`TaskStatus`, `saveProviderDDQChecklistTaskFormResponse`, `createProviderDDQChecklistTaskEvidenceUploadUrl`, `updateProviderDDQChecklistTaskEvidenceTags`) correctly call `requirePermission(context, ...)` inside the service layer and consistently scope all reads/writes by `context.corporation.id` via `readProviderDDQChecklistTaskContext`. This is a sound, defense-in-depth pattern for the provider side.
- `updateOtherUserPermissionsForMyCorporation` correctly checks the target user belongs to the caller's own corporation and blocks self-permission changes before validating permissions against the corporation type.
- `decideProviderAccessRequest`/`approveProviderCorporationApplication`/`rejectProviderCorporationApplication` correctly re-fetch the access request/application scoped to `context.corporation.id` before checking type-specific approve permissions, preventing a provider from acting on another provider's applications.
- `submitCorporationApplication`/`submitAccessRequest` in the public controller correctly validate corporation type/status/target before creating records, aside from the missing-caller-identity issue noted in finding 3.
- Status-transition state machines (`ddqPackTransitions`, `ddqChecklistTransitions`) are centralized and reject invalid transitions with clear errors — good for auditability.

## Test Gaps

- No visible automated tests in the reviewed files covering cross-corporation access attempts (e.g., a Provider A user trying to read/mutate Provider B's checklist, or an Association user from a hypothetical second association touching another association's DDQ Pack).
- No visible tests asserting the public `/access-requests` and `/corporation-applications` endpoints reject requests for non-existent, unapproved, or wrong-type corporations beyond what's implied by reading the service code.
- No visible tests for the `/data/*` reset endpoints' access boundary (or lack thereof).

## Review Limitations

- `setupService.ts` (which implements `fullFactoryResetDemoDataService`, `seededFactoryResetDemoDataService`, `recreateSampleDataService`, and `setupRootUser`) was not included in this step's excerpts. Finding 1's severity depends on whether that service independently enforces a local-only or non-production guard; this should be confirmed directly rather than assumed.
- `database/ddqPackRepository.ts`, `database/corporationApplicationRepository.ts`, and `database/accessRequestRepository.ts` were not included in this step. Findings 2 and 4 are based on the absence of a corporation-id parameter in the service-layer call signatures shown here, not on the underlying SQL; if those repository functions already filter by ownership internally, the practical exposure would be narrower than described.
- `@shared/permissions` (the permission vocabulary itself) is out of scope for this step and was reviewed in step 0012; the permission-naming overlap between Association's single `provider-requests:approve` gating both AGENT and STAKEHOLDER access-request decisions (versus the Provider side's split `agent-requests:approve`/`stakeholder-requests:approve`) is noted here only as a possible follow-up, not analyzed in depth.

