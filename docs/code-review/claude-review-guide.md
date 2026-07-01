# repo Claude Review Guide

## Purpose

This repo is reviewed as its own streamlined module-federation system. The goal is to keep improving this repository in small, reviewable chunks while protecting the current architecture Richard is happy with.

The review has three primary objectives:

1. Improve code quality, safety, maintainability, and verification.
2. Help Richard deliberately learn almost every line of the codebase.
3. Protect the streamlined module-federation and package layout documented in `docs/architecture/`.

Claude reviews should identify defects, security risks, maintainability problems, weak tests, unclear operational choices, UX issues against current repo guidance, and places where the code can be made safer without changing the product direction by accident.

Each review is a single-pass audit of one bounded area. Claude writes a review document, then Codex and Richard work through the findings one by one. Richard decides which findings are accepted, deferred, or rejected.

Richard's learning goal is at least as important as the code improvement goal. Agents must not optimize for speed by making automatic changes. Each finding should become a short, concrete walkthrough of the relevant code, why it matters, and what choices are available.

## Current Baseline

The review baseline is this repository as it exists now, plus:

- [Module Federation Architecture](../architecture/module-federation.md)
- [Frontend Package Layout](../architecture/frontend-package-layout.md)
- [Package And Review Standards](./package-and-review-standards.md)
- [UX Design Philosophy for AI Agents](../design-guides/ux-design-philosophy-for-ai-agents.md)
- current product specs under `docs/specs/`

Do not compare to another repository or use another repository as a source of required parity unless Richard explicitly asks for a targeted comparison.

Review findings should move the current system forward. They should not regress package streamlining, module-federation ownership, local/deployed stage clarity, or the current app boundaries.

Module-federation independence is a safety goal, not only a build/deploy detail. Reviews should protect the ability to change one app or workflow without accidentally breaking an app the programmer does not understand. Do not treat all duplicated code across shell/core/form-design as a defect. Small duplicated route guards, app-local providers, or app-local workflow state can be the right trade-off when sharing them would couple independently owned apps. Recommend shared packages only for stable contracts, primitives, or genuinely cross-app behaviour whose shared ownership is worth the coupling.

The detailed MFE decisions are centralized in [Module Federation Architecture](../architecture/module-federation.md). Claude reviews and Codex sweeps must treat that file as canonical. Do not recommend reverting to core-as-root, preserving old unprefixed core routes, adding legacy redirects, moving route maps into shared packages, or making shell navigation a registry of remote internal routes unless Richard explicitly asks for a new architecture decision.

Clean current code is more important than preserving legacy behaviour. This
repository is in active development and has no production compatibility promise
to historic versions of itself. Do not preserve old routes, old package names,
old component names, old file layouts, compatibility aliases, redirect shims,
fallback code paths, migration leftovers, deprecated exports, or old import
paths for legacy reasons. The objective is the best current code, not continuity
with previous internal versions. Treat unexplained legacy preservation as a
defect. Prefer deleting obsolete compatibility code over documenting it,
wrapping it, re-exporting it, redirecting it, or making new code accommodate it.
Only keep a legacy path when Richard explicitly asks for a named, temporary
compatibility window for a specific external dependency.

## Rules Of Engagement For Claude

- Review only the requested step and the files listed for that step.
- Use this repository's architecture and standards docs as the source of truth.
- Do not ask for a broad rewrite, framework replacement, repo reorganization, or architectural reset unless there is a concrete severe risk in the reviewed area.
- Do not suggest changing product behaviour unless the current behaviour is insecure, broken, internally inconsistent, contradicted by current docs/specs, or confusing enough to create a realistic user/data-safety risk.
- Preserve existing repo domain language unless the review step explicitly asks for naming changes.
- Treat local, testing, staging, and production behaviour as deliberate concerns. Flag hidden environment defaults, unsafe deployment assumptions, and configuration that is hard to audit.
- Do not suggest GitHub Actions deployment automation. Deployment is manual unless Richard explicitly changes that later.
- Prefer explicit, reviewable choices over implicit fallbacks for authentication, authorization, persistence, external systems, destructive operations, and environment selection.
- Prefer small fixes that can be reviewed independently.
- Do not recommend unused scaffolding, placeholder packages, compatibility shims, legacy redirects, legacy exports, alias modules, or abstractions without a near-term current-system consumer.
- Do not defend legacy preservation as a virtue. If code exists only to support an old route shape, old package split, old naming scheme, old import path, deprecated export, or speculative backwards compatibility, recommend removing it unless Richard has explicitly chosen to keep it for a named temporary compatibility window.
- Do not recommend copying secrets, committed `.env` values, generated output, local build artifacts, AWS credentials, database passwords, Cognito secrets, or API keys.
- Treat generated and local-only areas as out of scope unless the step explicitly includes them: `node_modules`, `dist`, `cdk.out`, local upload photos, local environment files, and local AWS/CDK cache output.
- Prefer findings tied to exact files and lines.
- Classify each finding as `blocking`, `recommended`, `optional`, or `probably not worth fixing`.
- Only list actual defects, risks, or reviewable concerns under Findings. Put confirmed-good checks, intentional differences, and explanatory notes in a separate summary or notes section, not as findings.
- Do not classify missing source excerpts, omitted sibling files, or other review-context gaps as blocking/recommended findings. Put them under review limitations unless the provided source proves a concrete defect.
- Include test gaps and review limitations.
- Do not ask to rerun Claude after fixes unless there is a specific high-risk reason.

## Design Goals To Keep In Mind

- The software supports DDQ work between associations, providers, agents, stakeholders, and administrators.
- The shell owns global browser chrome and mounts route apps through Module Federation.
- Core owns the main product routes and workflows.
- Form Design owns form-template design workflows.
- Shell owns only the root entry redirect, top-level remote mounts, global
  chrome, and top-level app selection.
- Core routes live under `/core/*`; Form Design routes live under
  `/form-design/*`.
- Remote internal route maps and global navigation route strings are owned by
  their remote, not by the shell or shared packages.
- Each frontend app should remain understandable and changeable on its own. Avoid changes that make a remote depend on another app's source, route table, local state shape, or implementation details.
- Shared code flows through workspace packages; apps must not import another app's internals.
- Authentication uses Cognito in deployed environments and a local developer path for local development.
- Authorization and tenant/entity boundaries are central product safety concerns.
- The system must support bootstrapping from an initially empty installation to a first usable user/entity setup.
- The system should run locally enough to exercise ordinary development flows without AWS access.
- Testing, staging, and production should remain deliberately separated.
- AWS infrastructure is CDK-based and should be auditable before deployment.
- Database migrations and seed/reset flows should avoid cross-environment coupling and accidental production data mutation.
- Frontend code should stay practical, clear, accessible, and consistent with the existing UI stack.
- Backend service boundaries should remain boring, observable, and explicit.
- The required default is a clean current system, not compatibility with earlier iterations of this repository.

## Review Workflow

### Command: Kickoff

`Kickoff <step-id>` is the standard command for starting a review step.

When Richard asks an agent to `Kickoff <step-id>`, the agent should run the standard main-only review sequence for that review step.

For example, `Kickoff 0003` means:

```bash
git switch main
git pull --ff-only
pnpm run claude:review -- 0003
```

Claude reviews are performed directly on `main`. Do not create, switch to, or target feature review branches, pull-request branches, `testing` branches, or `staging` branches for this review process.

If `Kickoff` starts while the current branch is not `main`, stop and report the current branch before running the review.

If `Kickoff` starts while the working tree has uncommitted changes, stop and ask Richard whether to close out, discard, or otherwise handle the existing changes before pulling or running a new review.

### Command: Sweep

`Sweep <step-id>` is the standard command for applying as much of a completed review step as possible.

By default, `Sweep` includes only findings classified as `blocking` or
`recommended`. Findings classified as `optional`, `probably not worth fixing`,
notes, test gaps, and review limitations are out of scope and should be
discarded without asking Richard for an explicit reject decision, unless
Richard specifically asks to widen the sweep.

`Sweep` is not a mechanical implementation pass. Codex must act as a second
reviewer before bringing items to Richard. After discarding lower-priority
Claude findings, Codex should independently evaluate each remaining `blocking`
or `recommended` finding and bring forward only the items Codex believes are
worth doing or worth discussing. If Codex believes a `blocking` or
`recommended` finding should be rejected as stale, incorrect, too risky, not
worth the churn, or outside the current direction, Codex should discard it from
the sweep summary rather than asking Richard to decide it.

When Richard asks an agent to `Sweep <step-id>`, the agent should:

1. Read the latest `docs/code-review/claude-reviews/step-<step-id>-run-*.md` review.
2. Discard all findings below `recommended` scope: `optional`, `probably not worth fixing`, notes, test gaps, and review limitations.
3. Independently evaluate each remaining `blocking` or `recommended` finding.
4. Discard any `blocking` or `recommended` finding Codex does not believe is worth doing or discussing, and do not ask Richard for a decision on those discarded findings unless the discard itself is surprising or high risk.
5. Before starting the walkthrough, give Richard a short sweep preamble:
   - the count of findings Codex recommends reviewing together;
   - one concise line per finding Codex recommends reviewing, in Claude's original order;
   - the count of lower-priority findings discarded by sweep scope, if any;
   - the count of `blocking` or `recommended` findings Codex discarded after independent evaluation, if any.
6. Process only the findings Codex recommends reviewing, in Claude's original order, using the Finding Walkthrough Rule below.
7. Do not implement findings automatically. The default is always discussion first, because the walkthrough is part of Richard learning the codebase.
8. For each finding brought to Richard, ask whether to implement, defer, reject, or discuss it before changing files.
9. Do not stage changes during `Sweep`. Leave all approved edits unstaged so Richard can inspect the complete working tree plainly.
10. Run the smallest meaningful verification available for each implemented finding or approved bundle.
11. Report what was implemented, what was deferred or rejected by Richard, what Codex discarded before discussion, and what still needs Richard's decision.

`Sweep` does not run a new Claude review. It works from the latest completed review document for the step.

Sweep agents must not run `git add`, `git commit`, or any command that stages files. Staging is reserved for `Closeout`, after Richard has finished deciding what belongs in the accumulated review changes.

If Richard asks to `review <step-id> then sweep <step-id>`, run the review first, then stop and begin the Finding Walkthrough Rule. Do not treat "sweep" as permission to apply findings without discussion.

If Richard asks simply for `Sweep`, use `main` and the latest review document in `docs/code-review/claude-reviews/`. If the current branch is not `main`, stop and report the current branch before editing files.

### Command: Closeout

`Closeout <step-id>` is the standard command for finishing accumulated review changes after `Sweep` is complete.

When Richard asks an agent to `Closeout <step-id>`, the agent should:

1. Confirm the current branch is `main`, or clearly report if it is not.
2. Confirm the working tree contains only changes Richard wants in the review commit.
3. Run the smallest meaningful verification for the accumulated changes.
4. Summarize the review findings that were implemented, deferred, rejected, or skipped.
5. Stage and commit the approved changes as one combined closeout action, using a concise review-step commit message.
6. Report the commit hash and a short closeout summary.

`Closeout` should not run a new Claude review unless Richard explicitly asks for one. If verification fails, stop before committing and report the failure.

If Richard asks simply for `Closeout`, use `main` and infer the step from the latest review document.

### Finding Walkthrough Rule

After Claude writes a review document, agents must process Claude's findings in the order Claude listed them.

During a standard `Sweep`, first discard `optional` and `probably not worth
fixing` findings without requiring Richard to say "reject" for each one. Then
Codex must independently evaluate the remaining `blocking` and `recommended`
findings and walk Richard through only the items Codex believes are worth doing
or discussing. If Richard asks for a broader sweep, use the scope he names.

For each finding:

1. Restate the finding briefly in plain language.
2. Give Codex's recommendation for that finding.
3. Ask Richard whether to implement, defer, reject, or discuss it.
4. Only implement the current finding after Richard agrees.
5. Run the smallest meaningful verification for the change.
6. Move to the next finding only after the current finding is implemented, deferred, rejected, or explicitly skipped by Richard.

Do not reorder findings by severity, convenience, or agent preference unless Richard explicitly asks to change the order. Do not bundle multiple findings into one implementation unless Richard explicitly approves that bundle.

The walkthrough should be educational and concrete. For each finding, agents should point to the relevant files, explain what the code currently does, why Claude thinks it is risky or weak, what the smallest reasonable change would be, and what trade-offs or operational effects Richard should consider.

### Claude Review Runner Notes

The `scripts/claude-review.mjs` wrapper is responsible for writing review files. Claude should return review text on stdout; it should not try to call its own Write/Edit tools.

If Claude review runs fail or return tool-use narration instead of findings:

1. Use `pnpm run claude:review -- --smoke` to verify the wrapper with a tiny prompt before spending quota on a full review.
2. Use `CLAUDE_REVIEW_TIMEOUT_MS=<milliseconds>` to raise the default timeout when a bounded review needs more than ten minutes.
3. Use `CLAUDE_REVIEW_MAX_SOURCE_BYTES=<bytes>` when a bounded step genuinely needs more source context.
4. Keep the Claude invocation in print mode with tools disabled (`claude -p --tools=`) so Claude cannot try to write the review file itself.
5. Make the prompt explicitly say to use only the provided context, not inspect memory, not ask for permissions, and return the final review immediately.
6. If a run writes an unusable artifact, such as a permission request or tool-use narration, delete that bad `step-<step-id>-run-XX.md` before retrying so the successful review keeps the expected run number.
7. Do not repeatedly rerun Claude when quota is a concern. After one failed full retry, stop and ask Richard before spending another full review call.

Normal sequence:

1. Richard chooses the next review step.
2. Run Claude for that step.
3. Claude writes the review to `docs/code-review/claude-reviews/`.
4. Codex reads the review and summarizes the findings in Claude's order.
5. Codex and Richard walk through the findings one by one using the Finding Walkthrough Rule.
6. When all findings are implemented, deferred, rejected, or skipped, Richard decides whether the review step is complete.

## Review Step Status

Steps 0001 and 0002 are retired. The repo-native plan starts at 0003.

All remaining review steps run directly on `main`. Step completion is tracked by the generated review document, the sweep decisions, and the closeout commit.

## Review Step Plan

### 0003 Frontend Federation, Routing, And App Entrypoints

Purpose: review the streamlined shell/core/form-design Module Federation shape and route ownership.

Files:

- `docs/architecture/module-federation.md`
- `apps/shell/src/App.tsx`
- `apps/shell/src/appRegistry.ts`
- `apps/shell/src/components/AppSidebar.tsx`
- `apps/shell/src/main.tsx`
- `apps/shell/src/remotes.d.ts`
- `apps/shell/src/vite-env.d.ts`
- `apps/shell/src/hostContext.ts`
- `apps/shell/src/index.css`
- `apps/shell/vite.config.ts`
- `apps/shell/package.json`
- `apps/core/src/App.tsx`
- `apps/core/src/CoreApp.tsx`
- `apps/core/src/CoreReactContext.tsx`
- `apps/core/src/CoreRouteContent.tsx`
- `apps/core/src/components/CoreAppHeader.tsx`
- `apps/core/src/constants/routes.ts`
- `apps/core/src/hostContext.ts`
- `apps/core/src/main.tsx`
- `apps/core/src/remote.tsx`
- `apps/core/src/index.css`
- `apps/core/src/vite-env.d.ts`
- `apps/core/vite.config.ts`
- `apps/core/package.json`
- `apps/form-design/src/App.tsx`
- `apps/form-design/src/FormDesignApp.tsx`
- `apps/form-design/src/FormDesignReactContext.tsx`
- `apps/form-design/src/FormDesignRouteContent.tsx`
- `apps/form-design/src/components/FormDesignAppHeader.tsx`
- `apps/form-design/src/constants/routes.ts`
- `apps/form-design/src/hostContext.ts`
- `apps/form-design/src/main.tsx`
- `apps/form-design/src/remote.tsx`
- `apps/form-design/src/index.css`
- `apps/form-design/src/vite-env.d.ts`
- `apps/form-design/vite.config.ts`
- `apps/form-design/package.json`

Focus:

- host/remote route ownership
- remote names and exposed modules
- singleton shared dependencies
- local standalone remote behaviour
- basename/base-path correctness
- loading/error states around remote mounting

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

### 0005 Frontend Product Workflows And API Contract

Purpose: review the user-facing frontend workflows and their shared API contract end to end.

Runner note: this is a larger review step. Use at least `CLAUDE_REVIEW_TIMEOUT_MS=600000` when running this step, and raise `CLAUDE_REVIEW_MAX_SOURCE_BYTES` if Claude reports that relevant source was truncated.

Files:

- `packages/frontend/api/`
- `services/onboarding-service/src/controllers/http.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`
- `services/onboarding-service/src/database/onboardingTypes.ts`
- `apps/core/src/pages/`
- `apps/core/src/tables/`
- `apps/core/src/utils/`
- `apps/form-design/src/pages/`
- `apps/form-design/src/components/`
- `docs/specs/user-permissions-spec.md`
- `docs/specs/file-upload-evidence-spec.md`
- `docs/specs/auto-tagging-spec.md`
- `docs/specs/form-designer-spec.md`

Focus:

- public setup, callback, profile, and registration-facing flows
- users, provider directory, setup requests, and access requests
- association DDQ pack authoring and publishing
- provider checklist, evidence, tagging, and form-completion workflows
- form-designer draft/edit/publish workflows
- frontend/backend DTO drift
- permission-gated UI versus backend enforcement assumptions
- route constants, local navigation, error states, and destructive-action clarity

### 0006 Backend Identity, Authorization, Setup, Users, And Entity Workflows

Purpose: review backend request identity, local identity, authorization, tenant boundaries, bootstrap/setup, users, entities, invitations, and access-request/application lifecycle logic.

Runner note: this is a larger review step. Use at least `CLAUDE_REVIEW_TIMEOUT_MS=600000` when running this step, and raise `CLAUDE_REVIEW_MAX_SOURCE_BYTES` if Claude reports that relevant source was truncated.

Files:

- `packages/shared/permissions/`
- `services/onboarding-service/src/middleware/`
- `services/onboarding-service/src/controllers/`
- `services/onboarding-service/src/services/currentUser.ts`
- `services/onboarding-service/src/services/localIdentity.ts`
- `services/onboarding-service/src/services/localMode.ts`
- `services/onboarding-service/src/services/permissions.ts`
- `services/onboarding-service/src/services/setupService.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/services/cognitoAdmin.ts`
- `services/onboarding-service/src/database/appUserRepository.ts`
- `services/onboarding-service/src/database/accessRequestRepository.ts`
- `services/onboarding-service/src/database/corporationRepository.ts`
- `services/onboarding-service/src/database/corporationApplicationRepository.ts`
- `services/onboarding-service/src/database/setupRepository.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`
- `services/onboarding-service/src/local.ts`
- `services/onboarding-service/src/localMode.ts`

Focus:

- deployed auth claim mapping and unauthenticated route boundaries
- local-only endpoint isolation
- current-user and corporation resolution
- least privilege and permission vocabulary drift
- authorization bypasses and tenant/entity boundary checks
- empty-system bootstrap safety
- duplicate users/entities and Cognito/database consistency
- invitation, setup request, application, and access-request lifecycle rules

### 0007 Backend DDQ, Forms, Evidence, Document Analysis, And Events

Purpose: review backend DDQ/form-template/checklist/evidence/document-analysis behaviour and cross-service event boundaries.

Runner note: this is a larger review step. Use at least `CLAUDE_REVIEW_TIMEOUT_MS=600000` when running this step, and raise `CLAUDE_REVIEW_MAX_SOURCE_BYTES` if Claude reports that relevant source was truncated.

Files:

- `services/onboarding-service/src/database/ddqPackRepository.ts`
- `services/onboarding-service/src/database/ddqChecklistRepository.ts`
- `services/onboarding-service/src/database/ddqChecklistEvidenceRepository.ts`
- `services/onboarding-service/src/database/ddqChecklistFormResponseRepository.ts`
- `services/onboarding-service/src/database/formTemplateRepository.ts`
- `services/onboarding-service/src/services/evidenceStorage.ts`
- `services/onboarding-service/src/services/formTemplateValidation.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/controllers/associationController.ts`
- `services/onboarding-service/src/controllers/providerController.ts`
- `services/onboarding-service/src/events/`
- `services/onboarding-service/src/consumers/`
- `packages/backend/events/`
- `services/document-analysis-service/`
- `docs/specs/file-upload-evidence-spec.md`
- `docs/specs/auto-tagging-spec.md`
- `docs/specs/form-designer-spec.md`
- `docs/dev-plans-and-handovers/ddq-pack-form-completion-development-plan.md`
- `docs/dev-plans-and-handovers/provider-ddq-packs-tab-implementation-brief.md`

Focus:

- form-template schema validation and lifecycle semantics
- DDQ pack draft/publish/archive and task ordering semantics
- checklist generation and provider/association boundary checks
- evidence upload authorization, metadata integrity, and storage boundaries
- form response validation and ownership
- event schema stability, idempotency, retries, and failure visibility
- document-analysis ownership and tag suggestion persistence

### 0008 Data, Runtime, Deployment, Verification, Docs, And Final System Review

Purpose: review data/migration/seed/reset/export safety, local runtime scripts, deployment/CDK/stage isolation, verification coverage, documentation consistency, and final cross-system risks.

Runner note: this is intentionally broad. Use at least `CLAUDE_REVIEW_TIMEOUT_MS=900000` and `CLAUDE_REVIEW_MAX_SOURCE_BYTES=1000000` unless Richard asks for a narrower final pass.

Files:

- `package.json`
- `pnpm-workspace.yaml`
- root and package package.json files
- `README.md`
- `scripts/`
- `apps/shell/cdk/`
- `apps/shell/scripts/`
- `apps/core/cdk/`
- `apps/core/scripts/`
- `apps/form-design/scripts/`
- `services/cognito-service/cdk/`
- `services/onboarding-service/cdk/`
- `services/document-analysis-service/cdk/`
- `services/onboarding-service/database/`
- `services/onboarding-service/src/database/`
- `services/onboarding-service/scripts/`
- `services/onboarding-service/src/app.ts`
- `services/onboarding-service/src/index.ts`
- `services/onboarding-service/src/local.ts`
- `services/onboarding-service/src/controllers/healthController.ts`
- `docs/architecture/`
- `docs/code-review/`
- `docs/design-guides/`
- `docs/specs/`
- `docs/dev-plans-and-handovers/`

Focus:

- migration ordering and repeatability
- seed/reset/export ownership, idempotency, and production safeguards
- secret handling and command-site stage clarity
- local startup without AWS and local/deployed behaviour drift
- manual deployment safety, stage isolation, domains, and CloudFront/S3 layout
- verification command consistency, health checks, logs, and missing high-value tests
- stale documentation, stale architecture claims, and future-agent regression risks
- unresolved cross-cutting risks before declaring the review sequence complete
