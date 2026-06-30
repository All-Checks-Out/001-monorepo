# Claude Review: Step 0004, Run 02

- Current git branch: `main`
- Reviewed at: 2026-06-30T06:02:56.415Z
- Command: `pnpm run claude:review -- 0004`

## Review Step

### 0004 Frontend Platform, Auth, UI, And App Shell

Purpose: review the frontend platform as a coherent system: Module Federation shell behaviour, shared packages, UI primitives, auth/current-user state, local identity, and the app-level header/body architecture.

Runner note: this is a larger review step. Use at least `CLAUDE_REVIEW_TIMEOUT_MS=600000` when running this step, and raise `CLAUDE_REVIEW_MAX_SOURCE_BYTES` if Claude reports that relevant source was truncated.

Files:

- `docs/architecture/module-federation.md`
- `docs/architecture/frontend-package-layout.md`
- `docs/design-guides/ux-design-philosophy-for-ai-agents.md`
- `packages/frontend/`
- `packages/shared/permissions/`
- `apps/shell/`
- `apps/core/src/App.tsx`
- `apps/core/src/CoreApp.tsx`
- `apps/core/src/CoreReactContext.tsx`
- `apps/core/src/CoreRouteContent.tsx`
- `apps/core/src/components/`
- `apps/core/src/context/`
- `apps/core/src/constants/`
- `apps/core/src/hostContext.ts`
- `apps/core/src/main.tsx`
- `apps/core/src/remote.tsx`
- `apps/core/src/index.css`
- `apps/core/vite.config.ts`
- `apps/form-design/src/App.tsx`
- `apps/form-design/src/FormDesignApp.tsx`
- `apps/form-design/src/FormDesignReactContext.tsx`
- `apps/form-design/src/FormDesignRouteContent.tsx`
- `apps/form-design/src/components/`
- `apps/form-design/src/context/`
- `apps/form-design/src/constants/`
- `apps/form-design/src/hostContext.ts`
- `apps/form-design/src/main.tsx`
- `apps/form-design/src/remote.tsx`
- `apps/form-design/src/index.css`
- `apps/form-design/vite.config.ts`

Focus:

- shell versus remote ownership
- Bridge App Mounts and remote header/body surfaces
- host context contracts and permission/theme/current-user propagation
- local and deployed auth separation
- shared UI/package boundaries
- route basename and app-switching correctness
- loading, error, empty, and logged-out states
- accessibility and consistency of shared UI patterns

## Review Output

# Step 0004 Review: Frontend Platform, Auth, UI, And App Shell

## Findings

### 1. `getCognitoCallbackRedirectUri()` hardcodes `/core/callback`, creating a hidden coupling between `@frontend/auth` and core's route ownership
**File:** `packages/frontend/auth/src/cognito/oauth.ts:3-5`
```ts
export function getCognitoCallbackRedirectUri(): string {
  return `${window.location.origin}/core/callback`;
}
```
This is a shared package reaching into a specific remote's internal route (`/core/callback`, owned per `apps/core/src/constants/routes.ts` and `CORE_ROUTES.callback`). If core ever renames its callback route, this shared file must change in lockstep with no compiler-enforced link between them — exactly the kind of cross-app coupling the architecture doc warns against ("Remote internal route maps and global navigation route strings are owned by their remote, not by the shell or shared packages"). The architecture doc explicitly calls out `/core/callback` as intentional and canonical, so this isn't wrong today, but the *implementation location* is a maintainability risk: a future contributor editing `CORE_ROUTES.callback` has no reason to discover this string in `@frontend/auth`.
**Classification:** recommended — not a behavior change, but flag/document the coupling (e.g. a comment in both files pointing at each other) so a future core route rename doesn't silently break login.

### 2. Local-dev auth header trusts a client-supplied user id with no server-side session, and the docs describe it as the local auth path with no compensating control visible in this review's scope
**File:** `packages/frontend/api/src/onboarding/client.ts:537-553` (`fetchWithAuth`)
```ts
if (config.isLocal) {
  const localUserId = getLocalUserId(localUser);
  ...
  return await fetch(`${config.onboardingServiceBaseUrl}${path}`, {
    ...init,
    headers: { ..., "x-local-user-id": String(localUserId) },
  });
}
```
This is expected/by-design for local dev (per architecture docs: "a local developer path for local development"), and backend enforcement of `isLocal`-only acceptance of this header is out of scope for step 0004. Flagging only because nothing in the reviewed frontend code asserts this header is dropped/ignored outside local builds — `config.isLocal` is computed from `VITE_APP_ENV` at build time (`packages/frontend/api/src/runtime/config.ts:9`), so a deployed build with a misconfigured env var would silently start sending this trust-me header. There's no defensive check in `fetchWithAuth` to refuse sending `x-local-user-id` based on anything server-verifiable.
**Classification:** optional — this is a configuration-discipline risk rather than a code defect; flagged for awareness since `VITE_APP_ENV` misconfiguration is the only thing standing between local and deployed auth modes on the frontend side.

### 3. `ID_TOKEN_STORAGE_KEY` read directly by `@frontend/api`'s `fetchWithAuth`, duplicating/bypassing `@frontend/auth`'s session ownership boundary
**File:** `packages/frontend/api/src/onboarding/client.ts:1-5, 555-567`
```ts
import {
  AUTH_STORAGE_KEYS,
  ID_TOKEN_STORAGE_KEY,
  LOCAL_USER_STORAGE_KEY,
} from "@frontend/auth/session/storage";
...
const idToken = window.localStorage.getItem(ID_TOKEN_STORAGE_KEY);
if (!idToken || !decodeIdToken(idToken)) {
  clearStoredAuth();
  throw new Error("You must be logged in.");
}
```
`@frontend/auth` is documented as owning "shared frontend auth/session concerns." Here `@frontend/api` independently reads localStorage, decodes the token, and clears storage on failure — duplicating logic that already exists in `@frontend/auth/src/cognito/client.ts` (`getUserFromStoredToken`). This is two independent implementations of "is the user logged in," which can drift (e.g., one checks expiry via `decodeIdToken`, the other doesn't if someone edits one copy and not the other). It's a legitimate cross-package contract (api needs the token to attach to requests) but the *duplicated decode-and-validate* logic, rather than calling into `@frontend/auth`'s exported helper, is a maintainability/correctness risk: `@frontend/api`'s `package.json` already depends on `@frontend/auth` (`workspace:*`), so this isn't even crossing a new package boundary — it could call `getUserFromStoredToken()` directly instead of reimplementing the check inline.
**Classification:** recommended — consolidate the "is this token still valid" check into one place in `@frontend/auth` and have `@frontend/api` call it, since the dependency already exists and the current duplication risks silent divergence (e.g., expiry handling) between the two call sites.

### 4. Shell's logged-out redirect only special-cases `/core` and `/core/callback`, silently breaking deep-linking to `/form-design/*` for logged-out users
**File:** `apps/shell/src/App.tsx:90-101`
```ts
const useLoggedOutRoute = (...) => {
  const { isLoggedIn, loading } = useAuth();
  useEffect(() => {
    if (loading || isLoggedIn || pathname === "/core" || pathname === "/core/callback") {
      return;
    }
    navigate("/core", { replace: true });
  }, [isLoggedIn, loading, navigate, pathname]);
};
```
Any logged-out user hitting `/form-design`, `/form-design/anything`, or any `/core/...` sub-route other than the bare `/core` gets force-redirected to `/core`. Combined with `AppSidebar` showing both apps to logged-out users (`apps: shellApps` fallback when `!isLoggedIn`, `AppSidebar.tsx:21`), a logged-out user can see and click the "Forms" sidebar entry, navigate to `/form-design`, and immediately get bounced back to `/core` — a confusing UX dead end with no message explaining why. This is a concrete, reviewable UX inconsistency: the sidebar advertises an app the routing logic refuses to let logged-out users visit.
**Classification:** recommended — either gate the sidebar's `form-design` entry behind login (it's already gated behind `forms:read` permission for logged-in users, but logged-out users see it unconditionally per the `!isLoggedIn` branch), or extend the redirect allowlist to cover `/form-design`, with messaging. The current combination is internally inconsistent.

### 5. `AppDataTable`'s native `<select>` filter doesn't match the shadcn-based `Select` component used elsewhere, creating an inconsistent control inside a shared component
**File:** `packages/frontend/app-ui/src/data-display/AppDataTable.tsx:103-122`
```tsx
return (
  <select
    key={filter.column}
    aria-label={...}
    className={cn("h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs ...", ...)}
    value={value}
    onChange={...}
  >
```
The UX guide says: "Prefer shadcn primitives from `@frontend/shadcn` for buttons, tables, inputs, dropdowns..." and the shadcn `Select` component (`packages/frontend/shadcn/src/components/ui/select.tsx`) is already available and used elsewhere (e.g. `apps/form-design/src/components/ItemEditorDialog.tsx`, `apps/shell/src/components/LocalLoginDialog.tsx`). `AppDataTable` is the one shared, genuinely-reused `@frontend/app-ui` component for table filtering, yet it hand-rolls a native `<select>` with manually duplicated Tailwind classes that approximate (but don't exactly match) the shadcn `Select` trigger styling — risking visual drift (no chevron icon, no focus-ring polish, no portal-based content rendering) versus every other dropdown in the app.
**Classification:** optional — functional, accessible (has `aria-label`), and visually close, but a likely source of future inconsistency since this is the one shared list-filter UI other pages reuse.

### 6. `core`'s `CoreRouteContent` legacy permission-required redirect target duplicates `association/applications` and `association/corporations` to the same components as their renamed counterparts with no indication these are intentional aliases vs. leftover routes
**File:** `apps/core/src/CoreRouteContent.tsx:54-65`
```tsx
<Route path="association/providers" element={guard("provider-requests:read", <AssociationProviders />)} />
...
<Route path="association/applications" element={guard("provider-requests:read", <AssociationProviders />)} />
<Route path="association/corporations" element={guard("system-data:read", <AssociationSystemData />)} />
```
`association/applications` and `association/corporations` render the exact same components as `association/providers` and `association/system-data` respectively. Given the repo guide's strong stance against "old routes... unless Richard explicitly asks for a named temporary compatibility window," and given these are *not* called out in `docs/architecture/module-federation.md`'s explicit list of intentional core routes (`module-federation.md` lists `/core/association/*` generically but the routing-decisions section enumerates `/core/profile`, `/core/association/*`, `/core/provider/*` etc. without singling out `applications`/`corporations` as deliberate aliases), this looks like either: (a) leftover duplicate routes from a prior naming scheme, or (b) genuinely-intended additional URLs for the same page. Without a comment or doc note distinguishing intent, this reads as exactly the kind of unexplained route duplication the standards doc treats as a defect.
**Classification:** recommended — confirm with Richard whether `association/applications`/`association/corporations` are deliberate secondary entry points (and if so, document why) or are dead legacy paths to delete. The code gives no signal either way.

### 7. `CoreAppHeader`'s `navigateWithLocationAssign` fallback causes a full page reload (losing remote-app SPA state) whenever `hostContext.navigation.navigate` is unavailable, but core is always mounted by the shell with a navigate function — fallback path is effectively only exercised by the standalone dev harness, where it's also wrong
**File:** `apps/core/src/components/CoreAppHeader.tsx:24, 169-171`
```ts
const navigate = hostContext?.navigation.navigate ?? navigateWithLocationAssign;
...
function navigateWithLocationAssign(to: string) {
  window.location.assign(to);
}
```
When core runs standalone (direct port 5174, no shell), `hostContext` is `undefined`, so every header nav click does a full `window.location.assign`, causing a full page reload instead of client-side routing — even though core's standalone `App.tsx` sets up its own `BrowserRouter`. This means the standalone dev harness's in-app header navigation is needlessly slow/jarring (loses all React state, refetches everything) compared to using React Router's `navigate`. The same pattern repeats identically in `apps/form-design/src/components/FormDesignAppHeader.tsx:32`.
**Classification:** optional — doesn't affect the shell-mounted production experience (the focus of this app's primary usage), only standalone/dev-harness navigation, but worth a small fix (use `useNavigate()` from react-router as the fallback instead of `window.location.assign`) since it's cheap and improves the directly-developing-against-the-remote experience that the architecture doc explicitly wants preserved ("direct app development remains possible").

---

## Notes (confirmed-good / intentional / out of scope for Findings)

- Shell, core, and form-design vite configs all mark `react`, `react-dom`, `react-dom/client`, `react-router-dom`, `@frontend/auth/session/AuthProvider`, and `@frontend/auth/session/ThemeProvider` as singletons with matching keys across all three configs — this matches the documented shared-dependency contract in `module-federation.md` exactly.
- `base: "/core/"` and `base: "/form-design/"` in the respective vite configs correctly match the documented deployment prefixes.
- Shell route table (`apps/shell/src/App.tsx:113-122`) contains only the `/` → `/core` redirect and the two top-level remote mounts, with no leaked internal route maps — matches architecture doc exactly.
- `CORE_ROUTES`/`FORM_DESIGN_ROUTES` and their `toCoreShellPath`/equivalents are owned locally by each remote, not shared — correct per architecture.
- Bridge mounting (`createRemoteAppComponent` in shell, `createBridgeComponent` in core/form-design) with `RemoteLoading`/`RemoteError` fallback components gives reasonable loading/error UX for remote mount failures.
- `CurrentUserContext` in both `apps/core` and `apps/form-design` correctly branches on `hostContext` presence to either delegate to host state (when shell-mounted) or self-fetch via `getMe()` (when standalone) — this dual-mode design is sound and intentional per the "standalone remote behaviour" goal.
- Permission vocabulary is consistently sourced from `@shared/permissions` in all three apps' current-user contexts (no local reimplementation of the permission lists).
- `AppSidebar`'s `collapsible="icon"` plus `tooltip` props on `SidebarMenuButton` is a reasonable accessible pattern for a collapsed icon-only sidebar.
- `PermissionRequired` (both core and form-design copies) appropriately render a loading state, then a `Status error=...` when permission is missing, rather than silently rendering nothing — reasonable UX for permission-gated routes. The two copies are intentionally app-local duplicates per architecture guidance and not flagged as a defect.
- `RootSetupProvider` exists only in `apps/core` (not form-design or shell) — consistent with core owning bootstrap/setup-related product flows.
- `index.css` `@source` directives in shell/core/form-design correctly point to relevant shared package source directories for Tailwind class scanning, keeping each app's CSS pipeline self-contained per app.

## Test Gaps

- No automated test coverage observed (in the reviewed file set) for the shell's logged-out redirect behavior (Finding 5) — a regression here would only surface through manual QA.
- No test coverage observed for `fetchWithAuth`'s 401-triggered `clearStoredAuth()` path or the local-vs-deployed branching in `@frontend/api`'s client, despite this being the single chokepoint for all authenticated API calls across all three apps.
- No test coverage observed for permission-derived header navigation visibility logic in `CoreAppHeader`/`FormDesignAppHeader` (e.g., verifying nav items disappear/appear correctly as `corporationType`/permissions change).

## Review Limitations

- This review step's file list does not include `apps/core/src/pages/*`, `apps/form-design/src/pages/AssociationFormsPage.tsx`, or `FormTemplateDesigner.tsx` bodies (only their `.d.ts` stubs were visible via `@mf-types`), so behavior inside those pages (e.g., whether `FormTemplateDesigner` correctly handles the `mode="new"` vs `"edit"` prop, or whether `AssociationFormsPage` has its own loading/empty states) could not be assessed and is deferred to step 0005.
- Backend enforcement of `x-local-user-id` (i.e., whether the onboarding service actually rejects that header outside local mode) is out of scope for this frontend-focused step; Finding 2 is scoped to the frontend's defensive posture only, not a confirmed backend bypass.
- `apps/shell/@mf-types/**/*.d.ts` files are generated type artifacts reflecting a prior build of the remotes; they were used only to understand exposed surface shape (e.g., `RemoteAppProps`, `CoreAppHeader` signature) and were not treated as a source of findings themselves.

