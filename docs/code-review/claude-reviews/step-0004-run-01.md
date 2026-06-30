# Claude Review: Step 0004, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-29T15:41:11.430Z
- Command: `pnpm run claude:review -- 0004`

## Review Step

### 0004 Frontend Packages, UI Primitives, Tokens, And Navigation

Purpose: review the streamlined frontend package layout and shared UI/navigation contracts.

Files:

- `docs/architecture/frontend-package-layout.md`
- `packages/frontend/shadcn/package.json`
- `packages/frontend/shadcn/src/`
- `packages/frontend/app-ui/package.json`
- `packages/frontend/app-ui/src/`
- `packages/frontend/tokens/package.json`
- `packages/frontend/tokens/src/tokens.css`
- `packages/frontend/tailwind/package.json`
- `packages/frontend/tailwind/tailwind.config.ts`
- `apps/shell/src/appRegistry.ts`
- `apps/shell/src/components/AppSidebar.tsx`
- `apps/shell/src/components/ThemeButton.tsx`
- `apps/shell/src/components/UserMenu.tsx`
- `apps/core/src/components/Page.tsx`
- `apps/core/src/components/TableIntro.tsx`
- `apps/core/src/tables/ApprovalTable.tsx`
- `apps/core/src/tables/SimpleTable.tsx`
- `docs/design-guides/ux-design-philosophy-for-ai-agents.md`

Focus:

- package ownership and export clarity
- generic UI versus app-specific UI
- shell top-level app selection and active state
- table/control density and accessibility
- token/style loading across host and remotes

## Review Output

# Step 0004 Review: Frontend Packages, UI Primitives, Tokens, And Navigation

## Findings

### 1. Destructive system-reset commands live in shared `UserMenu`, gated only by `window.confirm` — `apps/shell/src/components/UserMenu.tsx:60-130`
`SystemResetMenu` exposes "Full Factory Reset," "Seeded Factory Reset," and "Recreate sample data" to any logged-in user from a dropdown that also contains ordinary Login/Logout. There is no permission check (no `requiredPermission`, no role gate) before these items even render — only a `window.confirm` dialog stands between any authenticated user and wiping all users/data. This is inconsistent with the "least-privilege defaults" and "destructive immediate commands require clear confirmation" guidance, and `window.confirm`/`window.alert` are not part of this repo's shadcn dialog vocabulary (no `AlertDialog`/`Dialog` primitive is used here, unlike the rest of the UX guide's destructive-confirmation pattern). If this is meant to be a developer/admin-only tool, it currently has no authorization boundary in the UI layer.
**Classification: blocking** (data-safety risk — full factory reset reachable by any logged-in user with no permission gate).

### 2. `resetRedirectHref` reload uses `window.location.assign("/")`, discarding SPA state across both remotes — `apps/shell/src/components/UserMenu.tsx:46,55,75,90,106`
This is a full page reload rather than client-side navigation, which is reasonable for a hard reset, but it's worth flagging that this couples shell-local reset logic to a hardcoded root path. Since shell owns `/ -> /core` redirect per architecture, this is consistent, not a bug — moving to notes.

### 3. `AppDataTable` select filter uses raw `<select>` instead of the shadcn `Select` primitive — `packages/frontend/app-ui/src/data-display/AppDataTable.tsx:121-141`
The package guide requires shared UI to be "composed from shadcn primitives." `AppDataTableSelectFilter` renders a native HTML `<select>` styled by hand rather than importing `Select`/`SelectTrigger`/`SelectContent` from `@frontend/shadcn`. This duplicates shadcn's focus/invalid/disabled styling by hand (note the copy-pasted Tailwind string overlapping `input.tsx`'s classes) and produces a visually inconsistent control next to the shadcn `Input` text filter right beside it.
**Classification: recommended.**

### 4. `AppDataTable` table cells force `whitespace-nowrap` with no wrapping affordance for long content — `packages/frontend/shadcn/src/components/ui/table.tsx:74,89` consumed by `AppDataTable.tsx`
`TableHead`/`TableCell` both hardcode `whitespace-nowrap`. This is vanilla shadcn behavior and not itself a defect, but combined with `AppDataTable`'s lack of any column-width or truncation strategy, any long string (e.g., long pack names, descriptions) in `SimpleTable`/`ApprovalTable` usages will force horizontal scroll on every row rather than wrapping or truncating with a tooltip. Given DDQ/provider data often includes longer free-text fields, this is a real density/accessibility concern for the tables this package is meant to standardize.
**Classification: optional** (no concrete current overflow bug shown in excerpts, but a foreseeable density issue worth tracking before more tables adopt `AppDataTable`).

### 5. `Sidebar` primitive in `@frontend/shadcn` is not a vanilla shadcn sidebar — `packages/frontend/shadcn/src/components/ui/sidebar.tsx`
The architecture doc requires shadcn primitive files to stay in "vanilla shadcn shape." The real shadcn `sidebar.tsx` ships with `SidebarProvider` context, `SidebarTrigger`, `SidebarRail`, collapsible state, mobile sheet behavior, `SidebarGroup`, `SidebarMenuSub`, etc. This file is a much-reduced custom rewrite (fixed icon-only width, no collapse/expand, no context, no `SidebarTrigger`) reusing shadcn names. That's a defensible product choice (shell only needs an icon rail), but it means a future shadcn re-sync or another shadcn doc/example will not match this file's actual behavior, and the file violates "keep shadcn primitive files in vanilla shadcn shape" pretty directly — it's a bespoke app-rail component wearing shadcn's name and folder location.
**Classification: recommended** — either rename this to an app-ui-style name (e.g. `AppIconSidebar`) and move it out of `@frontend/shadcn`, or explicitly document in `frontend-package-layout.md` that this is an intentionally trimmed sidebar variant kept under the shadcn name. As-is it's inconsistent with the package's own stated rule and could mislead a future contributor trying to add real shadcn sidebar features here.

### 6. `getActiveApp` defaults unconditionally to `"core"` for any unrecognized path — `apps/shell/src/appRegistry.ts:30-34`
`getActiveApp` returns `"core"` for everything that isn't `/form-design*`, including paths unrelated to either app. This matches the documented `/ -> /core` redirect default and isn't a defect, but it does mean the sidebar will show `core` as "active" even on a stray/unknown path rather than visually indicating "no app selected." Minor and likely intentional; noting only because `AppSidebar` uses this for `aria-current="page"`, so a typo'd URL would falsely mark DDQ as the current page.
**Classification: probably not worth fixing.**

## Notes (non-findings)

- Package boundaries are otherwise clean: `@frontend/shadcn` primitives (`badge`, `breadcrumb`, `button`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `scroll-area`, `select`, `table`, `textarea`) are vanilla-shaped single-file components with no app-specific logic, matching the layout doc.
- `@frontend/app-ui`'s `AppDataTable` is correctly named non-shadcn-style and is the only export, consistent with "code used by exactly one app belongs in that app" — `core`'s `ApprovalTable`/`SimpleTable` correctly live in `apps/core/src/tables`, not in a shared package, since they're core-specific wrappers.
- No imports of removed package names (`@frontend/ui`, `@frontend/api-client`, `@frontend/app-layout`, `@frontend/tailwind-config`) appear anywhere in the reviewed excerpts.
- `apps/core/src/components/Page.tsx` and `TableIntro.tsx` correctly avoid duplicating shell-level navigation titles, consistent with the UX guide's "avoid headings that repeat the nav tab" rule.
- Shell's top-level app selection (`appRegistry.ts` + `AppSidebar.tsx`) correctly keeps permission-based visibility (`forms:read`) and active-state logic shell-local, not pushed into a shared package — matches the architecture doc.
- Token loading (`@frontend/shadcn/styles.css` importing `@frontend/tokens/tokens.css`) is centralized in one place rather than duplicated per-app, which is the correct shared ownership shape for CSS variables.
- `@frontend/tailwind`'s config is appropriately minimal (just radius theme extension), matching "shared Tailwind configuration only," not a kitchen-sink design system config.

## Test Gaps

- No tests are visible (or referenced) for `AppDataTable`'s filter/sort behavior, the select-filter branch, or the create-button disabled state.
- No tests visible for `SystemResetMenu`'s confirm/cancel branches — given finding #1's severity, this is the more important gap: there is no way to verify in CI that an unauthorized user is blocked from reaching factory-reset actions, because there is currently no authorization check to test.
- No accessibility test/check confirms the native `<select>` in `AppDataTable` (finding #3) has equivalent keyboard/screen-reader behavior to the shadcn `Select` used elsewhere in the app.

## Review Limitations

- The full contents of `packages/frontend/app-ui/src/` and `packages/frontend/shadcn/src/` beyond the files excerpted above were not all shown; only the files included in the bounded excerpt were reviewed.
- `apps/shell/src/components/LocalLoginDialog.tsx` (referenced by `UserMenu.tsx`) was not included in this step's file list, so its dialog pattern could not be checked against the destructive-confirmation flow in `UserMenu.tsx`'s reset commands.
- Permission/authorization logic for system-reset actions, if it exists elsewhere (e.g., a backend check on the `fullFactoryResetDemoData` endpoint), was not in scope for this step; finding #1 is scoped to the UI-layer gating only and should be cross-checked against backend authorization findings (step 0014) before deciding remediation.

