# Module Federation Architecture

This document is the source of truth for the current micro-frontend architecture,
routing ownership, and global navigation contract. Future Codex work, Claude
review sweeps, implementation plans, and handoff documents should treat this file
as canonical and should not copy these decisions into a second competing source
of truth.

If another document appears to conflict with this one, prefer this document and
update the other document to point back here.

## Decisions To Preserve

- The shell owns only global sidebar chrome, top-level routing, remote loading, and
  deployment infrastructure for the shared website.
- The shell route table contains only the shell-owned `/` entry redirect and
  top-level remote mounts: `/core/*` and `/form-design/*`.
- `/` redirects to `/core`. This does not make core a shell-root catch-all.
- Core owns all product routes under `/core/*`.
- Form Design owns all product routes under `/form-design/*`.
- Remotes own their internal route maps. The shell must not duplicate them.
- Shell global navigation is limited to choosing the active top-level app. Remote
  apps own their own in-app header/navigation.
- Route declarations stay readable and explicit. Keep React Router `<Route>`
  elements visible in shell and remote route files.
- Do not move remote route maps, route guards, page composition, app-local
  providers, current-user workflow state, or remote navigation into shared
  packages merely to remove duplicated strings or similar-looking code.
- Do not create shared app-state packages for shell/core/form-design current-user
  or workflow state unless Richard explicitly makes that architecture decision.
- Do not preserve old unprefixed core URLs such as `/profile`,
  `/association/ddq-packs`, or `/provider/ddq-packs`.
- Do not add redirects from old core URLs to `/core/...`, and do not add
  redirects that strip `/core`.
- Use React Router `Link`/`NavLink` for in-shell navigation. Use plain anchors
  only for genuine external URLs or intentional browser-level navigation.
- Shared packages should stay boring: API clients and DTOs, auth/session
  primitives, shadcn primitives, app-level UI that is genuinely shared, design
  tokens, Tailwind config, and permission vocabulary.
- This repository is in active development and does not preserve compatibility
  with its own historic internal versions. Do not keep legacy routes, aliases,
  redirects, package exports, remote names, old import paths, wrapper modules,
  or fallback code to support old architecture shapes. The objective is the
  cleanest current architecture.

These decisions are intentional even when they create a little local duplication
inside apps. Independence is a safety boundary.

## Goals

The frontend uses Module Federation so that:

- `apps/shell`, `apps/core`, and `apps/form-design` remain independently buildable.
- each app remains independently understandable and changeable by a programmer working in that app.
- The shell owns the production browser chrome: the global sidebar and remote mounting.
- Route apps own their product workflows and expose full app surfaces to the shell.
- Shared code flows through workspace packages, never by importing another app's internals.
- Local development uses the same host/remote shape as deployment.

Independence is a safety boundary. A change inside one route app should not accidentally break another route app through hidden source imports, shared route metadata, shared app-local state, or broad shared abstractions. Prefer a little simple duplication inside each app over extracting code that would make unrelated apps change together.

The architecture does not preserve legacy route shapes by default. User-facing routes should express current product concepts, not old implementation boundaries. Do not keep redirects for old unprefixed core routes, stale remote names, old mounting assumptions, old package exports, or old import paths unless Richard explicitly asks for a named temporary transition for a specific external dependency.

## Responsibilities

```text
apps/shell
  owns BrowserRouter, global sidebar, root redirect, top-level app selection,
  remote mount points, remote entry configuration, and shared website
  infrastructure.

apps/core
  owns the core route tree, core product URL helpers, core page guards, core
  local providers, core account links, and core in-app header.

apps/form-design
  owns the form-design route tree, form-design URL helpers, form-design page
  guards, form-design local providers, and form-design in-app header.

packages/frontend/*
  own stable shared contracts and primitives only. They do not own app route
  maps or app-local workflow state.
```

## Applications

```text
apps/shell        host application
apps/core         remote application exposing the core app
apps/form-design  remote application exposing the form-design app
```

### Shell

`apps/shell` is the Module Federation host.

It:

- renders the global sidebar
- owns the top-level `BrowserRouter`
- lazy-loads remote app surfaces
- redirects `/` to `/core` as the default shell entry route
- mounts `core` at `/core/*`
- mounts `form-design` at `/form-design/*`
- reads remote entry URLs from Vite environment variables
- offers top-level app selection for core and form-design through
  `apps/shell/src/appRegistry.ts` and `apps/shell/src/components/AppSidebar.tsx`

Current shell remote imports:

```ts
const CoreRemote = createRemoteAppComponent({
  loader: () => import("core/app"),
});

const FormDesignRemote = createRemoteAppComponent({
  loader: () => import("form_design/app"),
});
```

Current shell route shape:

```text
/              -> /core
/core/*        -> core/app
/form-design/* -> form_design/app
```

The shell may know remote names, top-level route prefixes, exposed federation modules, and remote entry URLs. It must not import source files from `apps/core` or `apps/form-design`, and it must not duplicate remote internal route maps.

The shell must not add routes such as `/core/association/ddq-packs` or
`/form-design/association/forms`. Those are remote-owned internal routes reached
through the remote mount points.

### Core Remote

`apps/core` is a Module Federation remote named `core`.

It exposes:

```ts
"./app": "./src/remote.tsx"
```

The exposed app owns the main onboarding/product routes, app-local providers, and
the core in-app header. It is mounted by the shell at `/core/*`. The standalone
app entry uses the same `CoreApp` component with its own `BrowserRouter` so
direct app development remains possible.

`apps/core` uses:

```ts
base: "/core/"
```

This keeps its built remote assets and `remoteEntry.js` under `/core/` when deployed.

### Form Design Remote

`apps/form-design` is a Module Federation remote named `form_design`.

It exposes:

```ts
"./app": "./src/remote.tsx"
```

The exposed app owns the form-design routes, app-local providers, and the
form-design in-app header. The shell mounts it at `/form-design/*`. The
standalone app entry uses the same `FormDesignApp` component with its own
`BrowserRouter` so direct app development remains possible.

`apps/form-design` uses:

```ts
base: "/form-design/"
```

This keeps its built remote assets and `remoteEntry.js` under `/form-design/` when deployed.

## Runtime URLs

The shell reads remote entry URLs from:

```text
VITE_CORE_REMOTE_ENTRY_URL
VITE_FORM_DESIGN_REMOTE_ENTRY_URL
```

Local values:

```text
VITE_CORE_REMOTE_ENTRY_URL=http://localhost:5174/core/remoteEntry.js
VITE_FORM_DESIGN_REMOTE_ENTRY_URL=http://localhost:5175/form-design/remoteEntry.js
```

Deployed values:

```text
https://{website-domain}/core/remoteEntry.js
https://{website-domain}/form-design/remoteEntry.js
```

`scripts/generate-ui-env.sh` is responsible for generating these values. For deployed stages it reads the website domain from SSM and builds route-app remote URLs from that shared domain.

## Local Development

Local frontend ports are fixed:

```text
shell        5173
core         5174
form-design  5175
```

The normal local frontend command starts all three apps:

```bash
pnpm run dev -- local
```

The root command runs:

```bash
pnpm --parallel -F @apps/shell -F @apps/core -F @apps/form-design run dev
```

Open local UI through the shell:

```text
http://localhost:5173
```

Direct remote ports are useful for development and debugging, but the normal integrated user experience should be checked through the shell.

## Deployment

The three frontend apps are independently buildable and uploadable, but they deploy into one website bucket/distribution shape.

This is the current AWS deployment model:

```text
apps/shell        provisions shared website infrastructure with CDK
apps/core         builds and uploads route-app assets
apps/form-design  builds and uploads route-app assets
```

So the apps are independently deployable as frontend artefacts, but they do not currently each own an independent CDK-provisioned website stack. The shell owns the shared S3 bucket, CloudFront distribution, certificate, DNS records, SPA route rewrite, and SSM website parameters. Route apps deploy by syncing their built assets into prefixes in that shared website bucket.

Do not describe the current state as "three independent CDK frontend stacks." If that becomes a goal later, it should be an explicit architecture change because it would affect remote entry URLs, CloudFront behaviours or distributions, invalidation scope, DNS/certificate ownership, and deployment ordering.

Current upload layout:

```text
shell dist        -> s3://{website-bucket}/
core dist         -> s3://{website-bucket}/core/
form-design dist  -> s3://{website-bucket}/form-design/
```

The shell upload excludes route-app folders so deploying the shell does not delete remote app assets:

```text
--exclude "core/*"
--exclude "form-design/*"
```

Route app uploads use their own prefixes and CloudFront invalidations:

```text
/core
/core/*
/form-design
/form-design/*
```

This gives each app a separate build/upload path while keeping the user-facing website on one domain.

The full stage deploy currently runs in this order:

```text
1. deploy shell-owned frontend infrastructure in the management account
2. deploy backend services in the target workload account
3. generate, build, and upload shell
4. generate, build, and upload core
5. generate, build, and upload form-design
6. invalidate the shared CloudFront distribution
```

Individual app deploy scripts are still useful:

```bash
pnpm run app -- shell deploy testing
pnpm run app -- core deploy testing
pnpm run app -- form-design deploy testing
```

Those commands update each app's frontend artefacts independently. Only the shell app has the active shared website infrastructure deploy/destroy commands.

## Shared Dependencies

The Module Federation config marks these as singleton shared dependencies:

```text
react
react-dom
react-router-dom
@frontend/auth/session/AuthProvider
@frontend/auth/session/ThemeProvider
```

The intent is to avoid duplicate React/router/auth/theme instances across the shell and remotes.

When shared package export paths are renamed, update all three Vite federation configs together. A stale shared key can produce duplicate provider instances even when TypeScript imports are correct.

## Routing Decisions

The shell owns the top-level route split.

The core remote intentionally owns most product routes, including:

```text
/core
/core/callback
/core/profile
/core/association/*
/core/provider/*
/core/agent/*
/core/stakeholder/*
```

The form-design remote owns:

```text
/form-design
/form-design/association/forms/new
/form-design/association/forms/:templateId/designer
```

Remote route declarations should remain readable React Router route maps. Inside each remote route tree, routes are declared relative to the remote mount point. For example, core declares `association/ddq-packs`, and the shell mount makes the production URL `/core/association/ddq-packs`.

Route files may use literal relative paths because they are route maps and
should be immediately readable. URL helper constants remain useful for links,
redirects, and dynamic URL construction inside the owning app.

The `/core/callback` route is the hosted Cognito callback route. The frontend
authorization redirect URI and token exchange redirect URI must agree with that
path. Do not reintroduce `/callback` as a compatibility route unless Richard
explicitly asks for a temporary migration window and the operational Cognito app
client settings are updated deliberately.

Do not move route ownership between remotes casually. If a workflow needs code from another app, either:

- move truly shared code to a shared package, or
- move the workflow to the app that owns it.

Do not import one app's source files from another app.

## Sidebar And Layout Decisions

The shell owns the production global sidebar.

The shell sidebar contains only top-level app selection and shell-level user/theme
controls. It does not own remote internal navigation maps or remote account links.
Remote apps render their own in-app headers as part of their exposed app surface.

Remote app surfaces should render product content, guards, pages, route-local
providers, and their own in-app header. They should not render a second global
shell sidebar when mounted by the shell.

Standalone remote entries may keep enough provider setup to support direct development on their own ports.

Standalone remote app harnesses and shell remote mounting both loading the same
remote app component is the expected Module Federation pattern. Do not flag that
as duplicated routing.

App-local context providers are allowed, even when their names or shapes resemble providers in another app. For example, shell navigation state and a remote's route-local current-user state may both read the current user, but they remain app-owned unless there is an explicit architecture decision to make that state a shared contract. Reviewers should flag duplicated providers only when they cause a concrete user-visible bug, unsafe data boundary, excessive network behaviour, or accidental cross-app coupling.

## Shared Code Rules

Apps may depend on shared workspace packages, for example frontend API, auth, shadcn primitives, app-level shared UI, and tokens.

Apps must not depend on each other:

```text
apps/shell        -> apps/core          forbidden
apps/shell        -> apps/form-design   forbidden
apps/core         -> apps/form-design   forbidden
apps/form-design  -> apps/core          forbidden
```

The shell may reference remote names in federation config and remote import specifiers, such as `core/app` and `form_design/app`. That is the federation contract, not a source import.

Federation contracts currently include:

```text
core/app
form_design/app
```

Shared packages should stay stable and intentionally owned. Use them for API contracts, auth primitives, design primitives, tokens, and other cross-app contracts. Do not move app-local workflow state, route tables, page composition, or permission wrappers into a shared package merely to remove duplication.

## Review Checklist

When reviewing MFE changes, check:

- each app still builds independently
- shell remote names match remote `name` values
- shell remote import specifiers match exposed modules
- `base` values match deployment prefixes
- generated remote entry URLs match local ports and deployed prefixes
- shared singleton keys match the package export paths actually imported by the apps
- shell remains the only production owner of the global sidebar
- no app imports source files from another app
- shell upload still excludes route-app prefixes
- route app uploads still target their own prefixes
- route apps remain independently buildable/uploadable without implying independent CDK website stacks
- shared website infrastructure remains shell-owned unless an explicit architecture change says otherwise
- shell routes mention only top-level remote mount points and the shell-owned `/` entry redirect
- shell sidebar navigation does not duplicate remote internal route maps
