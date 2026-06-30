# Claude Review: Step 0011, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T03:08:27.247Z
- Command: `pnpm run claude:review -- 0011`

## Review Step

### 0011 API Package And Frontend Contract

Purpose: review shared API client configuration, DTO types, and frontend/backend contract drift.

Files:

- `packages/frontend/api/package.json`
- `packages/frontend/api/src/runtime/config.ts`
- `packages/frontend/api/src/onboarding/types.ts`
- `packages/frontend/api/src/onboarding/client.ts`
- `services/onboarding-service/src/database/onboardingTypes.ts`
- `services/onboarding-service/src/controllers/http.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`

Focus:

- endpoint coverage and naming clarity
- request/response type consistency
- auth/local identity headers
- error response handling
- duplicated or stale contract types

## Review Output

# Review: Step 0011 — API Package And Frontend Contract

## Findings

### 1. Duplicate/orphaned demo-data reset endpoints and frontend aliases (recommended)

`services/onboarding-service/src/routes/onboardingRoutes.ts` registers five separate demo-data mutation routes:

```
publicRoutes.post("/data/reset", resetDemoData);
publicRoutes.post("/data/reseed", reseedDemoDatabase);
publicRoutes.post("/data/full-factory-reset", fullFactoryResetDemoData);
publicRoutes.post("/data/seeded-factory-reset", seededFactoryResetDemoData);
publicRoutes.post("/data/recreate-sample-data", recreateSampleData);
```

`packages/frontend/api/src/onboarding/client.ts` only exposes typed functions for the three newer endpoints, then re-exports the old names as bare aliases:

```ts
export const resetDemoData = fullFactoryResetDemoData;
export const reseedDemoDatabase = recreateSampleData;
```

This means the client package no longer calls `/data/reset` or `/data/reseed` under their own names at all — those backend routes are either dead or only reachable by some other caller outside this package, while the frontend re-uses the old names as compatibility aliases pointing at the new functions. Per repo standards, unexplained legacy names/aliases/dead routes should be removed rather than carried forward. Recommend deleting the unused old route handlers/routes and the two alias exports, and calling `fullFactoryResetDemoData` / `recreateSampleData` directly wherever they're currently consumed.

### 2. `listProviders` silently swallows errors as an empty list (recommended)

`packages/frontend/api/src/onboarding/client.ts`, `listProviders`:

```ts
export const listProviders = async () => {
  const response = await fetch(`${config.onboardingServiceBaseUrl}/public/providers`);
  if (!response.ok) {
    return [];
  }
  const body = await response.json() as ListProvidersResponse;
  return body.providers;
};
```

Every other read/write in this file goes through `publicJson`/`authJson`, which throws a descriptive error on non-2xx responses. `listProviders` instead treats a 500/502/timeout the same as "no providers configured," which will render an empty-state UI instead of surfacing a real backend failure to the user. Recommend routing this through `publicJson` like the rest of the client for consistent error handling.

### 3. Identical domain types duplicated verbatim between frontend and backend (recommended)

`packages/frontend/api/src/onboarding/types.ts` and `services/onboarding-service/src/database/onboardingTypes.ts` independently define the same shapes with no shared source: `FormItemType`, `FormTemplateSchema`, `FormDocument`, `FormDefinition`, `FormValues`, `FormValue`, `FormItemBase`, `FormItem` (full discriminated union), and the status enums `DDQPackItemKind`, `DDQTaskType`, `DDQPackStatus`, `DDQChecklistStatus`, `ChecklistEvidenceStatus`, `ChecklistEvidenceTagSource`.

Unlike `CorporationType`/`Permission`, which both files correctly import from `@shared/permissions`, these form/DDQ types have no shared package and no compiler-enforced link. If a backend change adds a new `FormItem` variant or a new checklist status, nothing will fail to compile on the frontend — it will just silently fall out of sync. Given this is exactly the kind of stable, cross-runtime contract the repo already has a pattern for (`@shared/permissions`), this is a reasonable candidate to consolidate into a shared package rather than two hand-maintained copies.

### 4. No frontend client function for `/auth/my-corporation` (optional)

`onboardingRoutes.ts` registers `protectedRoutes.get("/my-corporation", getMyCorporation);`, but `client.ts` has no corresponding wrapper (only `getMe`, which hits `/auth/me`). Since `@frontend/api` is meant to own all frontend API client functions, either this route is unused dead backend code, or some other code path is calling it directly and bypassing this package's auth/local-identity header handling. Worth confirming which, and either adding the missing client function or removing the unused route.

### 5. `parseId` helper is hardcoded to `req.params.id`, not generic despite its name (optional)

`services/onboarding-service/src/controllers/http.ts`:

```ts
export function parseId(req: Request, res: Response) {
  const id = Number(req.params.id);
  ...
}
```

`onboardingRoutes.ts` defines many nested routes with differently-named path params (`:packId`, `:itemId`, `:taskId`, `:evidenceId`) alongside routes using plain `:id`. A generically-named shared validator that only reads `req.params.id` is a footgun: if it's ever reused against one of the `packId`/`itemId`/`taskId`/`evidenceId` routes without modification, it will always read `undefined` and reject every request with a misleading "Invalid id." Controller files weren't in scope for this step, so this can't be confirmed as currently mis-used, but the helper's naming invites that mistake. Consider parameterizing it (e.g. `parseId(req, res, "packId")`) for clarity.

### 6. `getLocalStoredUser` does unguarded `JSON.parse` on localStorage content (probably not worth fixing)

`client.ts`:

```ts
function getLocalStoredUser() {
  const raw = window.localStorage.getItem(LOCAL_USER_STORAGE_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as LocalStoredUser;
}
```

If `LOCAL_USER_STORAGE_KEY` ever contains malformed JSON (manual edit, partial write), this throws uncaught from inside `fetchWithAuth`. This only affects the local-dev path, so the blast radius is small, but a try/catch returning `null` would fail more gracefully (forcing local user re-selection instead of a raw exception).

### 7. `AppUser` is a bare alias of `UserProfile` (probably not worth fixing)

`types.ts`: `export type AppUser = UserProfile;`. Two names for the same shape used interchangeably across the client (`GetMeResponse.user: AppUser`, etc.) adds a small amount of naming noise but isn't causing any actual drift today.

## Notes (confirmed-good / not findings)

- `authJson` correctly clears stored auth (`clearStoredAuth`) on a 401 before surfacing the error, consistent with the local/Cognito separation described in the architecture docs.
- Local vs. deployed auth header selection (`x-local-user-id` vs `Authorization`) is cleanly branched on `config.isLocal` with no fallthrough between the two paths.
- ID values are consistently `encodeURIComponent`-wrapped when interpolated into URL paths.
- snake_case field naming is consistent end-to-end between backend row types, response payloads, and frontend DTOs (e.g. `corporation_id`, `cognito_sub`, `provider_corporation_id`).
- `CorporationType` and `Permission` are correctly sourced from `@shared/permissions` on both sides rather than being duplicated — a good existing example of the pattern Finding 3 recommends extending.
- `responseErrorMessage`'s try/catch around a non-JSON error body, falling back to a generic message, is a reasonable, deliberate choice.

## Test Gaps

- No automated test/type-check is visible in the provided files asserting that frontend DTOs in `types.ts` structurally match backend row/response shapes in `onboardingTypes.ts` — the duplication in Finding 3 has no compiler or test guard against drift.
- No test coverage shown for `listProviders`' silent-failure-to-empty-array behavior (Finding 2) to catch a regression if error handling is fixed.

## Review Limitations

- Controller implementations (`associationController.ts`, `providerController.ts`, `setupController.ts`, `sharedController.ts`, `publicController.ts`, `localDevController.ts`) were not included in this step's source excerpts, so `parseId`'s actual usage pattern (Finding 5) and the real shape of responses like `getMyCorporation` (Finding 4) could not be fully verified against the route table.
- `services/onboarding-service/src/middleware/auth.ts` (Authorization header parsing/local-identity enforcement) is out of scope for step 0011 and is reviewed separately in step 0013; the `Authorization: idToken` header format sent by `fetchWithAuth` was not cross-checked against backend middleware expectations.

