# Frontend Package Layout

This document is the source of truth for shared frontend package ownership. Do not rename, merge, or broaden these packages unless Richard explicitly asks for a package architecture change.

For micro-frontend route ownership, shell top-level app selection,
shell/core/form-design responsibilities, and Module Federation contracts, use
[Module Federation Architecture](./module-federation.md) as the source of truth.

This repository is in active development and does not preserve compatibility
with historic internal frontend package layouts. Do not keep old package names,
old import paths, compatibility exports, wrapper modules, aliases, or shared
component locations solely because earlier versions used them. Move or delete
code according to the best current package boundary, and update all current
call sites directly.

## Core Rule

`packages/frontend/*` is only for code shared by more than one frontend app.

Code used by exactly one app belongs in that app under `apps/*/src`. Do not create or keep a shared frontend package just because code might become shared later.
Do not keep a shared export or re-export as a compatibility path after moving
single-owner code back into its owning app.

## Packages

```text
packages/frontend/
  api/
  app-ui/
  auth/
  shadcn/
  tailwind/
  tokens/
```

### `@frontend/shadcn`

`packages/frontend/shadcn` is exclusively for shadcn primitives and the files required by the shadcn setup.

Keep the normal shadcn structure:

```text
packages/frontend/shadcn/
  components.json
  src/
    components/
      ui/
        button.tsx
        table.tsx
        dialog.tsx
        ...
    lib/
      utils.ts
    styles.css
```

Rules:

- Only shadcn primitive components belong in `src/components/ui`.
- Keep shadcn primitive files in vanilla shadcn shape: one lowercase primitive file per component, not split into local subcomponents.
- Do not put product-specific, app-specific, workspace, table-composition, page-frame, notice, layout, or domain components in this package.
- If a shadcn primitive is missing, add it here using the shadcn default file style and export it from `@frontend/shadcn`.
- Keep imports explicit, for example:

```ts
import { Button } from "@frontend/shadcn/components/ui/button";
import { Table } from "@frontend/shadcn/components/ui/table";
```

Apps import styles from:

```css
@import "@frontend/shadcn/styles.css";
```

### `@frontend/app-ui`

`packages/frontend/app-ui` is for shared application-level UI composed from shadcn primitives.

Current examples:

```text
src/data-display/AppDataTable.tsx
```

Names in this package should be noticeably non-shadcn, such as `AppDataTable`. Avoid generic primitive names like `Table`, `Button`, `Dialog`, `PageFrame`, or `StatusMessage`.

If an app-ui component becomes single-app only, move it back into that app.

### `@frontend/api`

`packages/frontend/api` is the frontend API contract/client package.

Use domain folders:

```text
src/onboarding/client.ts
src/onboarding/types.ts
src/runtime/config.ts
```

Do not re-export unrelated shared packages through `@frontend/api`. For example, permission helpers and permission types should be imported directly from `@shared/permissions`.

### `@frontend/auth`

`packages/frontend/auth` owns shared frontend auth/session concerns:

```text
src/session/
src/cognito/
src/config.ts
```

Only shared auth/session code belongs here. App-local current-user contexts
remain app-local. The hosted Cognito callback path is part of the current MFE
routing architecture and is documented in
[Module Federation Architecture](./module-federation.md).

### `@frontend/tokens`

`packages/frontend/tokens` owns shared CSS design tokens.

### `@frontend/tailwind`

`packages/frontend/tailwind` owns shared Tailwind configuration only.

## Removed Packages

Do not recreate these old package names:

```text
@frontend/ui
@frontend/api-client
@frontend/app-layout
@frontend/tailwind-config
```

Shell-owned top-level app selection belongs in `apps/shell/src/appRegistry.ts`
and `apps/shell/src/components/AppSidebar.tsx`. Remote-owned product navigation
belongs in the owning app's in-app header, as documented in
[Module Federation Architecture](./module-federation.md). Do not move remote
route maps or remote in-app navigation into `packages/frontend/*`.

Do not preserve compatibility exports for removed packages or moved components.
Current imports should point at the current owner.

## Export And Import Rules

Prefer explicit package exports that point directly to implementation files.

Avoid barrel files and re-export aggregators:

```ts
// Do not add files whose only purpose is this:
export { Something } from "./Something";
export * from "./types";
```

Use direct imports at call sites:

```ts
import { AppDataTable } from "@frontend/app-ui/data-display/AppDataTable";
import { getMe } from "@frontend/api/onboarding/client";
import type { Corporation } from "@frontend/api/onboarding/types";
import type { Permission } from "@shared/permissions";
```

## Review Checklist

When reviewing frontend package changes, check:

- `packages/frontend/shadcn/src/components/ui` contains only vanilla-shaped shadcn primitive files.
- No imports reference `@frontend/ui`, `@frontend/api-client`, `@frontend/app-layout`, or `@frontend/tailwind-config`.
- Single-owner code lives under its owning app.
- Shared app UI uses non-shadcn names.
- Permission types/helpers come from `@shared/permissions`, not from `@frontend/api`.
- App CSS imports `@frontend/shadcn/styles.css`.
- Remote route maps, remote in-app navigation, app-local route guards,
  and app-local current-user workflow state do not move into shared packages
  merely to reduce duplication.
