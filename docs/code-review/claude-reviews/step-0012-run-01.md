# Claude Review: Step 0012, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T03:25:58.351Z
- Command: `pnpm run claude:review -- 0012`

## Review Step

### 0012 Permission Model

Purpose: review shared permissions and frontend/backend permission vocabulary.

Files:

- `docs/specs/user-permissions-spec.md`
- `packages/shared/permissions/package.json`
- `packages/shared/permissions/src/index.ts`
- `apps/core/src/components/PermissionRequired.tsx`
- `apps/core/src/utils/permissions.ts`
- `apps/form-design/src/components/PermissionRequired.tsx`
- `services/onboarding-service/src/services/permissions.ts`
- `services/onboarding-service/src/database/onboardingTypes.ts`

Focus:

- least-privilege defaults
- role/permission vocabulary drift
- frontend hiding versus backend enforcement assumptions
- new permissions missing from one side

## Review Output

# Review 0012 — Permission Model

## Findings

### 1. `getEffectivePermissions` and `hasPermission` do not deduplicate or validate stored permissions defensively — stale/invalid DB values silently pass through `getEffectivePermissions` but `hasPermission` is safe
**File:** `packages/shared/permissions/src/index.ts` (`getEffectivePermissions`, lines ~62-67; `hasPermission`, lines ~69-79)

`getEffectivePermissions` filters `user.permissions` against `allowedPermissions` for the corporation type, so this is actually correctly defensive — invalid/stale strings are dropped. `hasPermission` similarly checks `isPermissionForCorporationType` before checking membership. On inspection both functions correctly enforce the "invalid or stale permission strings must not grant access" rule from the spec. **No defect found here** — listing for completeness since it was a focus area, but moving to notes.

### 2. Every corporation type — including `AGENT` and `STAKEHOLDER` — receives `user-permissions:change`, `users:invite`, and `users:read` with no narrower role, contradicting least-privilege expectations for low-trust corporation types
**File:** `packages/shared/permissions/src/index.ts` lines 18-19 (`AGENT`/`STAKEHOLDER` arrays); spec section "Permission Sets"

The spec and code both grant `AGENT` and `STAKEHOLDER` corporations the full set `["users:read", "users:invite", "user-permissions:change"]` — i.e., every Agent/Stakeholder user with that permission can invite new users into their own corporation *and* grant them `user-permissions:change`, recursively. There is no smaller, read-only or no-permission-management role available for these corporation types. Since Agent/Stakeholder are typically smaller, less-trusted parties in the DDQ chain (per the request-approval model in `provider-requests`/`agent-requests`), this is the entire permission surface available to them, so "least privilege" is moot only because the type itself only has 3 possible permissions — it's an intentional minimal vocabulary, not a defect. **Reclassifying as a note**, not a finding, since this matches the spec's explicit design and there's no narrower permission documented as missing.

### 3. `validatePermissionsForCorporationType` throws a generic `Error`, not a typed/validation-specific error — backend callers must inspect message text to distinguish this from other failures
**File:** `packages/shared/permissions/src/index.ts` lines 56-58

```ts
if (invalidPermission) {
    throw new Error(`Invalid permission for ${type}: ${invalidPermission}`);
}
```
This is a shared package consumed by the backend HTTP layer (`services/onboarding-service/src/services/permissions.ts` re-exports it directly). Without a distinguishable error type (e.g., a custom `ValidationError` or a discriminated result), the controller that calls this (not in the provided excerpts, but implied by the spec's "Updating permissions rejects values outside the target corporation type's allowed list") must either string-match the message or treat *any* thrown error from this path as a 400, risking misclassifying unrelated internal errors as client validation errors (or vice versa). **Classification: optional.** Worth a small typed-error fix only if the calling controller currently can't reliably map this to a 400 — outside this step's file list to confirm definitively, so flagged as worth checking in 0014 (authorization/controller review) rather than fixed here.

### 4. `Permission` type is a union of all corporation types' permission strings, so TypeScript cannot catch a permission constant used against the wrong corporation type at compile time — correctness relies entirely on the runtime `isPermissionForCorporationType` check
**File:** `packages/shared/permissions/src/index.ts` lines 22-27

```ts
export type Permission =
  | AssociationPermission
  | ProviderPermission
  | AgentPermission
  | StakeholderPermission;
```
`PermissionRequired` in both `apps/core` and `apps/form-design` accepts a bare `permission: Permission` prop with no corporation-type narrowing, so a developer can write `<PermissionRequired permission="system-data:read">` inside a route that's actually reachable by a Provider/Agent/Stakeholder user, and TypeScript will not flag it — the mistake is only caught at runtime via `hasPermission`'s `isPermissionForCorporationType` guard (which correctly returns `false`). This is the deliberate spec design ("type-specific permission strings" with a flat union for cross-cutting checks like `users:read`), and runtime enforcement is present and correct, so this is **not a blocking defect** — it's an inherent trade-off of the flat-union design. **Classification: probably not worth fixing.** A discriminated-by-corporation-type prop would add real friction to `PermissionRequired` call sites for marginal compile-time benefit, since the backend remains the actual enforcement boundary per the spec's "Backend Authorization Rollout" section.

### 5. No backend route/controller files were included in this step to confirm the spec's mandated route-to-permission mapping is actually implemented
This isn't a defect in the reviewed files themselves, but the spec lists concrete required mappings (`GET /auth/my-users` → `users:read`, etc.) and required self-modification/cross-corporation rejection rules for `PUT /auth/my-users/:id/permissions`. None of the controller/route files enforcing these rules were in this step's file list (they're explicitly covered by step 0014). **This is a review limitation, not a finding for this step** — flagged below.

## Notes (confirmed-good / intentional, not findings)

- `getEffectivePermissions` and `hasPermission` in `packages/shared/permissions/src/index.ts` both correctly filter/guard against corporation-type mismatch, satisfying the spec's "invalid or stale permission strings from the database must not grant access" rule.
- `validatePermissionsForCorporationType` correctly deduplicates (`[...new Set(values)]`) and rejects any value not in the target type's allow-list, matching the spec's update-permission validation rule.
- `services/onboarding-service/src/services/permissions.ts` is a clean, deliberate re-export of `@shared/permissions` with no logic duplication — exactly matches the package-standards goal of permission helpers coming from one shared package on both runtimes.
- `services/onboarding-service/src/database/onboardingTypes.ts` correctly imports `CorporationType`/`Permission` from `@shared/permissions` rather than redefining them, and `AppUserRow.permissions: Permission[]` matches the spec's `app_user.permissions` data model — no vocabulary drift between DB row type and shared permission package.
- `apps/core/src/components/PermissionRequired.tsx` and `apps/form-design/src/components/PermissionRequired.tsx` are near-identical small components (different `Page`/`Status` import shapes per app, default-vs-named export). This is appropriate app-local duplication per this repo's guidance — each remote owns its own UI primitives and the duplication is too small/cheap to justify a shared package, especially since the two apps' `Page`/`Status` components differ (default export vs named export, `title` typed as `string | null` vs `ReactNode`).
- `apps/core/src/utils/permissions.ts` correctly wraps the shared helpers with a `CorporationType | null` / `AppUser | null` guard for the "not yet loaded" state, returning `[]`/`false` rather than throwing — appropriate for frontend loading-state handling and doesn't weaken enforcement since the backend is authoritative.
- No permission listed in `PERMISSIONS_BY_CORPORATION_TYPE` is missing from either side — frontend and backend both consume the single shared source (`@shared/permissions`), so there is no possibility of role/permission vocabulary drift between frontend and backend by construction. This directly satisfies the "new permissions missing from one side" focus area: structurally, that class of bug cannot occur as long as both sides keep importing from `@shared/permissions` rather than redefining constants locally.

## Test Gaps

- No test files were included in this step's source excerpts, so test coverage for `packages/shared/permissions/src/index.ts` itself (e.g., `hasPermission` returning `false` for a permission valid in another corporation type, `validatePermissionsForCorporationType` rejecting a foreign-type permission, dedup behavior) cannot be confirmed as present or absent from the provided context.
- The spec's required backend test list (self-modification rejection, cross-corporation rejection, mixed Agent/Stakeholder filtering) lives in controller/service code outside this step's files and should be verified in step 0014, not here.

## Review Limitations

- Controller and route files that actually call `hasPermission`/`validatePermissionsForCorporationType` (e.g., the `PUT /auth/my-users/:id/permissions` handler) were not included in this step's excerpts, so the spec's self-modification and cross-corporation rejection rules could not be verified against real enforcement code — that belongs to step 0014 (Backend Authorization Rollout) per this review's own step plan.
- `apps/core/src/context/CurrentUserContext.tsx` and `apps/form-design/src/context/CurrentUserContext.tsx` (source of the `hasPermission`/`loading` values consumed by both `PermissionRequired` components) were not included in this step, so the freshness/staleness of `hasPermission` after a permission change could not be assessed here.

## Summary

No blocking findings. The shared permission vocabulary (`@shared/permissions`) is the single source of truth consumed identically by both frontend apps and the backend service, which structurally prevents the vocabulary-drift risk this step was scoped to catch. The one optional item (generic `Error` type from `validatePermissionsForCorporationType`) is worth a quick check against its actual caller in step 0014 rather than a standalone fix here.

