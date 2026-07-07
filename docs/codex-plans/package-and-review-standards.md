# repo Package And Review Standards

repo is the current streamlined module-federation codebase. Reviews should protect that direction: improve the system in small, understandable steps without reintroducing broad compatibility layers, old package splits, legacy redirects, compatibility aliases, deprecated exports, old import paths, or comparison-driven churn.

Current good code takes priority over preserving legacy behaviour. This codebase is in flux and under active development; historic internal versions have no compatibility value by default. Do not keep old routes, old names, old file layouts, old import paths, deprecated exports, compatibility shims, fallback paths, or migration leftovers unless Richard explicitly asks for a named temporary compatibility window. When reviewing, treat unexplained legacy preservation as a defect or cleanup finding, not as a safe default. The objective is the best current code, even when that means deleting obsolete files, exports, redirects, aliases, or names outright.

## Package Boundaries

Keep the existing PNPM monorepo boundaries clear:

- `apps/*` for deployable frontend applications.
- `services/*` for backend services and their infrastructure.
- `packages/frontend/*` for shared frontend code.
- `packages/backend/*` for shared backend code.
- `packages/shared/*` for cross-runtime shared code.
- `scripts/` for root operational scripts.
- `docs/` for product, operational, architecture, and review documentation.

Prefer explicit package exports over importing another package's internal files by path.

The frontend package layout is documented in [Frontend Package Layout](../architecture/frontend-package-layout.md). Treat that document as the source of truth during review.

In particular:

- `@frontend/shadcn` is exclusively for vanilla-shaped shadcn primitives, shared shadcn styles, and `src/lib/utils.ts`.
- `@frontend/app-ui` is for shared application-level UI composed from shadcn primitives, with visibly non-shadcn names such as `AppDataTable`.
- `@frontend/api` owns frontend API client functions and shared frontend DTO types.
- `@frontend/auth` owns shared frontend auth/session/theme concerns.
- `@frontend/tokens` owns shared CSS design tokens.
- `@frontend/tailwind` owns shared Tailwind configuration.
- Code used by exactly one app belongs in that app, not in `packages/frontend/*`.
- Do not recreate `@frontend/ui`, `@frontend/api-client`, `@frontend/app-layout`, or `@frontend/tailwind-config`.
- Do not keep package exports, re-export files, wrapper modules, aliases, or import paths solely because older code once used them.
- Permission helpers and permission types should come from `@shared/permissions`.
- Avoid broad barrel files and unrelated re-export aggregators. Prefer explicit exports that point directly at implementation files.

The current micro-frontend and Module Federation architecture is documented in
[Module Federation Architecture](../architecture/module-federation.md). For
architecture questions, that document wins over implementation plans, handovers,
review notes, and generated review artifacts.

For MFE questions, that architecture document is canonical. Reviews should not
re-litigate the chosen `/core/*` and `/form-design/*` remote mounts, shell-owned
`/ -> /core` entry redirect, remote-owned route maps, or shell top-level app
selection plus remote-owned in-app navigation unless the reviewed code proves a
concrete defect against that design.

In particular, do not recommend:

- mounting core as the shell root catch-all
- preserving old unprefixed core routes
- adding compatibility redirects for old core URLs
- moving remote route maps or in-app navigation into shared packages
- making the shell own product-level internal route maps for core or form-design
- treating standalone remote harnesses as duplicated routing merely because they
  load the same remote route tree as the shell

## Review Baseline

The baseline is this repository as it exists now, plus the current architecture and UX docs. Do not use another repository as a required visual, routing, package, or component-structure reference unless Richard explicitly asks for a targeted comparison.

Good review findings should be grounded in at least one of these:

- a concrete bug or broken workflow
- a safety, authorization, tenant-boundary, data-loss, or deployment risk
- a mismatch with current repo architecture docs
- confusing code that makes future changes materially harder to review
- missing verification around important behaviour
- user-facing UX that conflicts with current product/design guidance

Do not recommend changes merely because another app did something differently.

## TypeScript

Each app, service, or package should own its own `tsconfig.json`.

Prefer local TypeScript configuration that can be read in one place. Add shared TypeScript config only if repeated local configuration becomes a real maintenance problem.

Keep strict TypeScript settings unless a reviewed package has a specific, documented reason not to.

Avoid root-level path aliases that hide package boundaries.

## Review Discipline

Reviews should be bounded to a specific subsystem. Claude review is a single-pass audit for the selected area. Capture the complete finding inventory once, then work through selected findings with Codex and Richard.

Review steps should be small enough that Richard can deliberately read and understand the listed files during `Sweep`. Prefer adding more review steps over creating broad steps that hide many unrelated files behind one review.

Claude review work happens directly on `main`. Do not create review branches or pull requests for this process. During `Sweep`, make approved file changes but leave them unstaged. During `Closeout`, stage and commit the accepted changes as one combined action after verification.

Findings should be classified as:

- `blocking`
- `recommended`
- `optional`
- `probably not worth fixing`

Richard decides which findings to accept, defer, or reject.

Review documents should reserve the Findings section for actual defects, risks, or reviewable concerns. Confirmed-good checks, intentional architecture decisions, and explanatory notes belong in summary, notes, or limitations sections.

## Product UI And React Structure

Use [UX Design Philosophy for AI Agents](../design-guides/ux-design-philosophy-for-ai-agents.md) as the product UI baseline.

Operational tools should stay quiet, dense, and work-focused. Prefer familiar controls, breadcrumbs, explicit draft/save/discard behaviour, clear destructive confirmations, and responsive layouts that preserve the user's task.

React component boundaries should earn their file and name.

A component should usually be extracted only when it is reused, represents a meaningful domain/UI concept, isolates substantial state or behaviour, or makes a large parent easier to understand. Avoid tiny unshared child components whose only purpose is to hide a few lines of JSX in another file; keep those local or inline.

Also avoid huge components that mix unrelated concerns, workflows, data loading, editing state, rendering, and small UI fragments in one hard-to-learn file. The target is cohesive, named around purpose, readable top-down, and sized so Richard can review it deliberately.

Every React component that accepts props should use a named props interface rather than an inline object type. Put that props interface directly above the component function declaration so the component's contract is visible where the reader needs it.

## Verification

Prefer deterministic local checks before merging review fixes.

The repository may not always have a single complete verification command. Choose the smallest meaningful verification command for the changed area, such as package type checks, package builds, targeted local scripts, CDK synth, API smoke tests, or local UI smoke tests.

For module-federation changes, verify the host/remote shape in addition to TypeScript when feasible. The expected host/remote shape is documented in [Module Federation Architecture](../architecture/module-federation.md).

## Runtime And Deployment

Local development should remain possible without AWS access for ordinary UI and backend work.

Development and operations are supported on macOS/Linux-style Bash shells. Do not preserve or add Windows, PowerShell, or Git Bash compatibility unless Richard explicitly changes that later.

Authentication and authorization behaviour should include a local development path that cannot leak into deployed environments.

Manual AWS deployment remains the default. Do not add GitHub Actions deployment automation unless Richard explicitly chooses that later.

Testing, staging, and production must stay deliberately separated. Any command that mutates cloud infrastructure or data should make the target environment obvious at the command site. The root command dispatcher should translate that explicit stage argument into the matching AWS profile.

## No New Unused Scaffolding

New changes should stay small and directly useful.

Avoid adding placeholder scripts, placeholder packages, empty helper modules, new local services before code needs them, shared config packages before repeated local configuration proves useful, deployment automation before the manual workflow is understood and reviewed, or compatibility shims for old layouts that are no longer the desired architecture.

Prefer deleting obsolete compatibility code to preserving it "just in case." If a legacy route, redirect, alias, shim, fallback, package export, wrapper file, or import path no longer serves the current product and architecture, remove it during the relevant sweep rather than designing around it. Do not keep code, documentation, tests, or package metadata for the sole purpose of preserving continuity with a historic internal version.

## Material That Should Not Be Committed

Do not commit secrets, generated output, local build artifacts, committed environment values, AWS credentials, database passwords, Cognito secrets, API keys, `node_modules`, `dist`, `cdk.out`, or local upload/test photos unless deliberately converted into safe fixtures.
