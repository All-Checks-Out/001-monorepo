# Claude Review: Step 0005, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-29T20:04:36.295Z
- Command: `pnpm run claude:review -- 0005`

## Review Step

### 0005 Frontend Auth, Shell State, And Local Developer Identity

Purpose: review shared auth/theme code plus shell-level current-user/root-setup state and local login behaviour.

Files:

- `packages/frontend/auth/package.json`
- `packages/frontend/auth/src/`
- `apps/shell/src/components/UserMenu.tsx`
- `apps/shell/src/components/LocalLoginDialog.tsx`
- `apps/shell/src/context/CurrentUserContext.tsx`
- `apps/core/src/context/CurrentUserContext.tsx`
- `apps/core/src/context/RootSetupContext.tsx`
- `apps/form-design/src/context/CurrentUserContext.tsx`
- `services/onboarding-service/src/controllers/localDevController.ts`
- `services/onboarding-service/src/services/localIdentity.ts`
- `services/onboarding-service/src/localMode.ts`

Focus:

- deployed versus local auth separation
- token/session storage
- current-user loading and stale state
- root setup visibility
- local identity leakage risks
- logout/reset behaviour

## Review Output

# Review 0005: Frontend Auth, Shell State, And Local Developer Identity

## Findings

### 1. `decodeIdToken` never verifies the JWT signature — `packages/frontend/auth/src/cognito/oauth.ts:69-87`
The ID token returned from Cognito's `/oauth2/token` endpoint is decoded client-side with `atob`/`JSON.parse` and trusted directly (`sub`, `email`, `email_verified`). There is no signature verification anywhere in this frontend path. In this architecture that is **probably acceptable** because the token came directly from a TLS connection to Cognito's token endpoint in `client.ts:handleOAuthCallback`, not from an untrusted source — the backend is presumably the place that re-verifies the token on each API call. But this file provides no comment or guarantee of that, and if any future code path ever calls `decodeIdToken` on a token from a less trusted origin (e.g. a value echoed back from another browser tab via `postMessage`, or a token replayed from storage that could be tampered with by another script with localStorage access), there's no defense in depth. Confirm that every backend endpoint independently verifies the Cognito JWT (this is in scope for step 0013, not here) — but flagging because nothing in this auth package states that assumption, and a reader could mistake `decodeIdToken`'s result as authoritative.
**Classification: optional** (likely fine given backend re-verification, but undocumented trust boundary).

### 2. Local auth user object is fully attacker/user-controlled via localStorage with no server validation on use — `packages/frontend/auth/src/session/AuthProvider.tsx:99-102`, `apps/shell/src/components/LocalLoginDialog.tsx:38-47`
`selectLocalUser` writes whatever `AuthenticatedUser` it's given straight into `localStorage` and into React state; `getLocalUserFromStorage` (`AuthProvider.tsx:120-126`) only checks that `sub` and `localUserId` are present, not that they correspond to a real seeded user. Since `isLocalAuth` already gates this whole path to local dev (`authConfig.isLocal`, driven by `VITE_APP_ENV`), and the backend's local dev identity is resolved server-side from `localCognitoSub`/the DB (out of scope here, but should be checked in 0013), this is a low-risk local-only convenience. Still worth flagging: a user could open devtools on a local instance and manually set `local_user` to `{sub: "local:someone-else@example.com", localUserId: 999}` and the frontend will happily render as that user without ever confirming the user exists. If the backend's local-mode auth middleware trusts a client-supplied `localUserId`/email header without checking it against the DB, this becomes a real impersonation vector even in local mode (cross-user data leakage on a shared local/dev/demo box). This needs to be checked against `services/onboarding-service/src/middleware/auth.ts` in step 0013, but the frontend half of the trust boundary is visible here and should be called out now.
**Classification: recommended** (flag now, verify backend trust assumption in 0013).

### 3. `localCognitoSub` lowercases/trims email but the frontend's `LocalLoginDialog` sends `selectedUser.cognito_sub` directly, not derived from email — `services/onboarding-service/src/services/localIdentity.ts:1-3` vs `apps/shell/src/components/LocalLoginDialog.tsx:38-44`
This is consistent (the dialog uses the already-computed `cognito_sub` returned by `listLocalDevUsers`), so no defect — noted only because it's worth confirming in 0013 that no other code path constructs a local sub from raw email without normalization, which could create duplicate/mismatched identities. No action needed here; informational.

### 4. `RootSetupProvider` polls setup status only once on mount, no refresh after the system transitions out of "not configured" — `apps/core/src/context/RootSetupContext.tsx:48-55`
`refreshRootSetupStatus` is exposed and presumably called after setup completes elsewhere, so this is fine as designed — moving on, no defect found here on the given excerpt.

### 5. Three near-identical `CurrentUserContext` implementations duplicated across shell/core/form-design
`apps/shell/src/context/CurrentUserContext.tsx`, `apps/core/src/context/CurrentUserContext.tsx`, and `apps/form-design/src/context/CurrentUserContext.tsx` are almost line-for-line the same logic (permission computation, `getMe` fetch, loading/error handling), differing mainly in whether they support a `hostContext` prop. Per this repo's architecture guidance, duplicated app-local state across independently-owned remotes is often the *correct* trade-off to avoid coupling — and indeed core/form-design's `hostContext` prop exists specifically so the shell can inject a shared current-user state when mounted as remotes, while still letting each remote run standalone. This is consistent with the documented MFE design and is **not a finding**; noted here only as a confirmed-good pattern, not a defect.

### 6. Silent error swallowing in `refreshCurrentUser` across all three contexts — e.g. `apps/core/src/context/CurrentUserContext.tsx:73-78`
`catch { setUser(null); setCorporation(null); }` discards the actual error (network failure vs. 401 vs. 500) with no logging and no user-visible message. If `getMe()` fails for a transient reason (e.g. a flaky network request, not actually logged out), the user is silently treated as logged-out/no-corporation with no indication of *why*, and no retry affordance. Contrast with `RootSetupContext.tsx`, which does capture and expose `rootSetupError`. This makes a real backend outage indistinguishable from "you're not authorized," which could confuse users and make support/debugging harder.
**Classification: recommended** — at minimum log the error (e.g. `console.error`) so it's visible in browser devtools/observability tooling, even if the UI continues to show a generic logged-out-like state.

### 7. `doLogout` clears storage but does not reset `isLocalAuth`'s local user storage key consistency — already handled correctly
Checked: `AUTH_STORAGE_KEYS` in `storage.ts:7-13` includes `LOCAL_USER_STORAGE_KEY`, and `doLogout()` (`client.ts:90-94`) clears all of them before redirecting to Cognito logout. For local auth, `AuthProvider.logout()` (`AuthProvider.tsx:81-89`) separately removes `LOCAL_USER_STORAGE_KEY` and does a hard `window.location.assign("/")` instead of calling `doLogout()` (correct — there's no Cognito session to revoke locally). No defect here.

### 8. `UserMenu`'s "System Reset" actions clear `AUTH_STORAGE_KEYS` directly instead of calling `logout()` — `apps/shell/src/components/UserMenu.tsx:60-92`
`resetData`, `seededFactoryReset`, and `recreateSamples` each independently call `AUTH_STORAGE_KEYS.forEach(...)` (duplicating logic already in `doLogout`/`AuthProvider.logout`) rather than calling the `logout()` function from `useAuth()`. This isn't a security bug, but it bypasses the `AuthProvider`'s `setUser(null)` state update — after `fullFactoryResetDemoData()`, the code clears localStorage and does a full `window.location.assign("/")`, so the stale React state doesn't matter since the page reloads. Functionally fine, but it's a maintenance smell: if `AuthProvider.logout()`'s clearing logic changes (e.g. additional keys, additional side effects) in the future, this duplicate clearing logic in `UserMenu.tsx` could silently drift out of sync. `recreateSamples` (line 84-93) notably does *not* clear auth storage at all — described as preserving "existing Cognito users," which is consistent given it doesn't log the user out, so that's intentional, not a bug.
**Classification: optional** — minor duplication; could call `logout()`-adjacent shared clearing helper instead of inlining `AUTH_STORAGE_KEYS.forEach` twice in the same file, but low risk since both call sites are in the same file and easy to audit together.

### 9. `listLocalDevUsers` has no current-user/auth check beyond `isLocalMode()` — `services/onboarding-service/src/controllers/localDevController.ts:7-22`
The only gate is `requireLocalMode`, which checks `APP_ENV === "local"` server-side (good — this can't be local in a deployed environment unless someone deliberately sets `APP_ENV=local` in a deployed environment, which would be a deployment misconfiguration, not a frontend code defect). Given that gate, exposing the full user/corporation list with no further auth check is appropriate for local dev convenience and matches the documented local developer identity design. Not a finding, but flag for 0013/0023 reviewers: this endpoint's safety depends entirely on `APP_ENV` being correctly excluded from deployed environment variables — worth double-checking deployment scripts/CDK never set `APP_ENV=local` in deployed stacks (out of scope for this step).

## Notes / Confirmed-Good

- Deployed vs. local auth separation is cleanly centralized in `authConfig.isLocal` (`packages/frontend/auth/src/config.ts`) and consistently checked in `AuthProvider` before taking any Cognito action — no risk of local login UI being reachable in a deployed build as long as `VITE_APP_ENV` is set correctly at build time (a deploy-script concern, out of scope for 0005).
- PKCE flow (`startLogin`/`handleOAuthCallback`) correctly uses S256 code challenge, validates `state` against stored value, and clears `CODE_VERIFIER_KEY`/`STATE_KEY` in a `finally` block regardless of success/failure — good practice, no replay risk found.
- Token storage uses `localStorage`, not cookies — consistent with an SPA/PKCE flow without a backend session; reasonable given this is a static-hosted frontend in front of Cognito Hosted UI.
- `CurrentUserProvider` host/remote dual-mode pattern (own state when standalone, host-injected `hostContext` when mounted under shell) correctly matches the documented MFE remote-independence goal.

## Test Gaps

- No tests evident for PKCE state/code-verifier mismatch handling, expired-token decoding (`decodeIdToken`'s `exp` check), or the `getLocalUserFromStorage` validation logic — these are exactly the kind of small, pure-logic paths that would benefit from unit tests given their security relevance.
- No test coverage visible for `requireLocalMode` 404 behavior in `localDevController.ts`, which is the only gate preventing this endpoint from leaking user data outside local mode.

## Review Limitations

- The `services/onboarding-service/src/middleware/auth.ts` (current-user resolution for local mode) was not included in this step's source and is explicitly scheduled for step 0013 — finding #2's full risk assessment depends on that file and cannot be confirmed here.
- `apps/core/src/utils/permissions.ts` (referenced by `apps/core/src/context/CurrentUserContext.tsx`) was not included; its `getEffectivePermissions`/`hasPermission` logic is assumed equivalent to `@shared/permissions` but not verified line-by-line in this step.
- `apps/shell/src/hostContext.ts` and `apps/core/src/hostContext.ts` (the `HostCurrentUserContext` type referenced by core/form-design contexts) were not included in this step's excerpts, so the exact host/remote handoff contract could not be fully verified.

