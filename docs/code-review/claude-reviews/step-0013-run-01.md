# Claude Review: Step 0013, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-30T03:32:50.626Z
- Command: `pnpm run claude:review -- 0013`

## Review Step

### 0013 Backend Auth And Current User

Purpose: review backend request authentication, current-user resolution, and local-only identity paths.

Files:

- `services/onboarding-service/src/middleware/auth.ts`
- `services/onboarding-service/src/services/currentUser.ts`
- `services/onboarding-service/src/services/localIdentity.ts`
- `services/onboarding-service/src/controllers/localDevController.ts`
- `services/onboarding-service/src/controllers/healthController.ts`
- `services/onboarding-service/src/controllers/http.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`
- `services/onboarding-service/src/local.ts`
- `services/onboarding-service/src/localMode.ts`

Focus:

- deployed auth claim mapping
- local-only endpoint isolation
- unauthenticated route boundaries
- current-user entity resolution
- error response clarity

## Review Output

# Review 0013 — Backend Auth And Current User

## Findings

### 1. Destructive demo-data reset routes are fully public with no visible auth or local-mode gate — `blocking`

`services/onboarding-service/src/routes/onboardingRoutes.ts`:

```ts
publicRoutes.post("/data/full-factory-reset", fullFactoryResetDemoData);
publicRoutes.post("/data/seeded-factory-reset", seededFactoryResetDemoData);
publicRoutes.post("/data/recreate-sample-data", recreateSampleData);
```

These three handlers are registered on `publicRoutes`, with no `requireAuth` and no local-mode middleware applied at this layer — unlike `localDevRoutes`, which is a separate router mounted only in `local.ts`, or `localDevController.listLocalDevUsers`, which calls `requireLocalMode(res)` itself. Nothing in the files provided for this step shows an equivalent guard for the three data-reset endpoints. If `setupController.ts` (not in this step's file set) does not internally call `isLocalMode()` before performing the reset, any unauthenticated caller could wipe or overwrite production data via a bare `POST /data/full-factory-reset`.

This is exactly the "unauthenticated route boundaries" risk this step is meant to catch. Recommend making the local-only intent explicit and enforced at the route/middleware layer (e.g., a dedicated `requireLocalModeRoute` middleware mounted in front of these three routes, mirroring the `localDevRoutes` pattern) instead of relying solely on logic inside a controller this step doesn't include. Treat this as needing confirmation against `setupController.ts`/`setupService.ts` (step 0015 scope) before closing.

### 2. Local auth bypass is gated by a single environment variable — `recommended`

`services/onboarding-service/src/localMode.ts`:

```ts
export function isLocalMode() {
  return process.env.APP_ENV === "local";
}
```

`auth.ts:attachAuth` uses this single check to decide whether to trust real Cognito claims or to instead trust a client-supplied `x-local-user-id` header and look up *any* user by raw integer id with no further credential check (`attachLocalAuth`, `auth.ts:34-56`). If `APP_ENV` were ever set to `"local"` on a deployed stage by misconfiguration, this would silently disable Cognito-based authentication for the whole service and let any caller impersonate any user just by guessing a small integer id. There is no secondary signal (region check, stage name, presence of AWS Lambda context, etc.) backing up this gate. Recommend adding a second, independent check (e.g., asserting local mode is only valid when not running under Lambda/`getCurrentInvoke()`) so a single mis-set env var can't silently disable auth in a deployed environment.

### 3. Errors are swallowed with no server-side logging — `recommended`

`services/onboarding-service/src/services/currentUser.ts:31-34`:

```ts
} catch {
  res.status(500).json({ error: "Could not read current user." });
  return null;
}
```

and `services/onboarding-service/src/controllers/http.ts` `handleError`'s fallback branch (non-`ServiceError` case) likewise responds with a generic 500 and logs nothing. None of the catch blocks in this step's files call `console.error` or any logger before responding. In a deployed Lambda, this means unexpected failures (DB errors, bugs) leave no trace beyond a generic client-facing message, making operational debugging and incident response materially harder. Recommend logging the caught error (e.g., `console.error`) before sending the generic response in both places.

### 4. Local dev server CORS is wide open, compounding finding #1 — `recommended`

`services/onboarding-service/src/local.ts:6-10`:

```ts
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-local-user-id");
res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
```

The wildcard origin plus an explicit allow-list that includes `x-local-user-id` means any third-party page open in a developer's browser can issue a CORS-preflighted cross-origin request to `localhost:3001` and (a) impersonate any local user via `x-local-user-id`, or (b) hit the unauthenticated reset routes from finding #1 and wipe the local database. This is local-only blast radius, but it's a concrete cross-origin attack surface against a running dev environment. Recommend scoping `Access-Control-Allow-Origin` to the known local frontend origin(s) (e.g., `http://localhost:5173`) instead of `*`.

### 5. `local.ts` mounts the identical `app` under both `/public` and `/auth` with no explanation — `optional`

```ts
localApp.use("/public", app);
localApp.use("/auth", app);
```

Both prefixes route to the same combined router (presumably `publicRoutes` + `protectedRoutes` + `attachAuth`, per `app.ts`, not in this step's files), so the prefixes don't actually separate public from authenticated handling at this layer — that separation, if any, happens elsewhere (e.g., per-route `requireAuth` calls, or API Gateway stage config in deployed mode). Read on its own, this file suggests a routing boundary that doesn't exist here. A short comment explaining why the same app is mounted twice (e.g., mirroring deployed API Gateway `/public` vs `/auth` stage separation) would prevent a future reader from assuming `/public/*` is unauthenticated by construction.

### 6. `getCurrentUserContext` dereferences `req.auth` without a defined-check — `optional`

`services/onboarding-service/src/services/currentUser.ts:14-15,21`:

```ts
const auth = (req as any).auth as AuthUser;
...
const row = await getCurrentAppUser(client, auth.sub);
```

If this is ever called on a path where `requireAuth` didn't run first, `auth` is `undefined` and `auth.sub` throws, which is caught by the generic `catch` and reported as "Could not read current user." (500) rather than a clear 401. Given `requireAuth` already exists and presumably guards `protectedRoutes`, this is a low-probability defensive gap, but an explicit `if (!auth?.sub) { res.status(401)...; return null; }` at the top of `getCurrentUserContext` would make the failure mode self-evident regardless of how it's wired upstream.

## Notes (not findings)

- `requireAuth` (`auth.ts:67-74`) correctly returns a clean 401 when `req.auth` is absent, and `localDevController.requireLocalMode` correctly returns 404 (not 403) to avoid revealing the local-dev routes exist in non-local environments — both good patterns.
- Deployed-mode claim extraction via `getCurrentInvoke()?.event?.requestContext?.authorizer?.claims` fails closed (no claims → no `req.auth` → 401 via `requireAuth`), which is the right default.
- `requireAssociationUser`/`requireProviderUser`/`requirePermission*` helpers correctly derive corporation type and permissions from the authenticated user's own row rather than from request input, which is the correct tenant-boundary pattern at this layer.

## Test Gaps

- No tests in scope exercise `attachLocalAuth`'s header-driven impersonation path, `requireAuth`'s 401 path, or `getCurrentUserContext`'s not-found/error paths.
- No test verifies that the local-only routes (`localDevRoutes`, and the data-reset routes from finding #1) are actually unreachable when `APP_ENV !== "local"`.

## Review Limitations

- `services/onboarding-service/src/app.ts` was not included in this step's files, so the exact wiring of `attachAuth`/`requireAuth` onto `publicRoutes`/`protectedRoutes` could not be directly confirmed; findings above note where this affects certainty.
- `services/onboarding-service/src/controllers/setupController.ts` and `src/services/setupService.ts` (step 0015 scope) were not included, so whether the data-reset controllers internally check `isLocalMode()` could not be confirmed — see finding #1.
- `services/onboarding-service/src/database/appUserRepository.ts` (`getCurrentAppUserById`, `getCurrentAppUser`) was not included, so user-status filtering (e.g., suspended/pending users) on these lookups could not be confirmed.

