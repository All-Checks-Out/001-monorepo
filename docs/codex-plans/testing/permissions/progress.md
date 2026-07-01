# Permission Audit and Test Harness Progress

Status: Permission matrix tests and permission API cleanup complete

This document tracks progress for the permission audit and test harness work.
It is intentionally small: a checklist, audit notes, decisions, and open
questions. The source specifications remain:

- `docs/codex-plans/testing/permissions/full-spec.md`
- `docs/codex-plans/testing/permissions/unit-tests.md`

## Working Rules

- Complete one step at a time.
- Do not change application code during Step 0.
- Keep tests beside the production code they verify.
- Use only Vitest, Vitest `vi`, React Testing Library, and jsdom.
- Prefer small, direct tests over a shared/generated framework.

## Step Checklist

| Step | Description | Status |
| --- | --- | --- |
| 0 | Permission audit | Complete |
| 1 | Implement missing backend permission checks | Complete |
| 2 | Add backend permission tests | Complete |
| 3 | Implement missing frontend permission checks | Complete |
| 4 | Add frontend permission tests | Complete |

## Repository Baseline

| Area | Finding |
| --- | --- |
| Existing colocated tests | Permission tests now exist in shared permissions, onboarding service, and core app packages |
| Existing Vitest config | Package-local Vitest scripts are used where tests exist |
| Backend package test script | `services/onboarding-service/package.json` has `test: vitest run` |
| Frontend package test script | `apps/core/package.json` has `test: vitest run --environment jsdom` |
| Root test scripts | `pnpm test`, `pnpm test:backend`, and `pnpm test:frontend` are available |
| Permission source of truth | `packages/shared/permissions/src/index.ts` |
| Backend route registration | `services/onboarding-service/src/routes/onboardingRoutes.ts` |
| Frontend route protection | `apps/core/src/CoreRouteContent.tsx` |
| Frontend nav protection | `apps/core/src/components/CoreAppHeader.tsx` |

## Backend Audit

| Location | Operation | Required Permission | Status | Notes |
| --- | --- | --- | --- | --- |
| `controllers/sharedController.ts` | Get current user | Authenticated user | OK | Uses `getCurrentUserContext`. |
| `controllers/sharedController.ts` | Get current corporation | Authenticated user | OK | Uses `getCurrentUserContext`. |
| `controllers/sharedController.ts` | List users in my corporation | `own-users:read` | OK | Controller calls `requirePermission`. |
| `controllers/sharedController.ts` | Invite user to my corporation | `own-users:invite` | OK | Controller calls `requirePermission`. |
| `controllers/sharedController.ts` | Update another user's permissions | `own-user-permissions:change` | OK | Controller calls `requirePermission`; service blocks self-edit and cross-corporation edits. |
| `controllers/sharedController.ts` | List my access requests | Authenticated user | OK | Own corporation data only. |
| `controllers/associationController.ts` | List provider setup applications | `association-provider-requests:read` | OK | Association-only permission check. |
| `controllers/associationController.ts` | Approve/reject provider setup application | `association-provider-requests:approve` | OK | Association-only permission check. |
| `controllers/associationController.ts` | List association corporations/users | `all-corporations:read` / `all-users:read` | OK | Association-only permission check. |
| `controllers/associationController.ts` | List provider access requests | `association-provider-requests:read` | OK | Association-only permission check. |
| `controllers/associationController.ts` | Approve/reject provider access request | `association-provider-requests:approve` | OK | Association-only permission check. |
| `controllers/associationController.ts` | Read/list DDQ packs/items | `association-ddq-packs:read` | OK | Association-only permission check. |
| `controllers/associationController.ts` | Create/update/delete/publish DDQ packs/items | `association-ddq-packs:edit` | OK | Association-only permission check. |
| `controllers/associationController.ts` | Read/list form templates | `association-forms:read` | OK | Association-only permission check. |
| `controllers/associationController.ts` | Create/update/delete form templates | `association-forms:edit` | OK | Association-only permission check. |
| `controllers/providerController.ts` | List provider setup applications | `provider-agent-requests:read` / `provider-stakeholder-requests:read` | OK | Service filters by requester type permission. |
| `controllers/providerController.ts` | Approve/reject provider setup application | `provider-agent-requests:approve` / `provider-stakeholder-requests:approve` | OK | Service checks after loading target application type. |
| `controllers/providerController.ts` | List provider access requests | `provider-agent-requests:read` / `provider-stakeholder-requests:read` | OK | Service filters by requester type permission. |
| `controllers/providerController.ts` | Approve/reject provider access request | `provider-agent-requests:approve` / `provider-stakeholder-requests:approve` | OK | Service checks after loading target access request type. |
| `controllers/providerController.ts` | List provider DDQ packs | Authenticated provider user | OK | Lists provider's own pool. |
| `controllers/providerController.ts` | List available DDQ packs | `provider-ddq-packs:add-new` | FIXED | Service now calls `requirePermission`. |
| `controllers/providerController.ts` | Add DDQ pack to provider pool | `provider-ddq-packs:add-new` | OK | Service calls `requirePermission`. |
| `controllers/providerController.ts` | List DDQ pack items during provider add flow | `provider-ddq-packs:add-new` | FIXED | Service now calls `requirePermission`. |
| `controllers/providerController.ts` | Read provider checklist/task | Any of `provider-ddq-packs:perform-checks`, `provider-ddq-packs:review-checks`, `provider-ddq-packs:approve-checks` | OK | Service calls `requireAnyPermission`. |
| `controllers/providerController.ts` | Create checklist | `provider-ddq-packs:perform-checks` | OK | Service calls `requirePermission`. |
| `controllers/providerController.ts` | Change checklist/task status | `provider-ddq-packs:perform-checks` | OK | Service calls `requirePermission`. |
| `controllers/providerController.ts` | Save/complete task form response | `provider-ddq-packs:perform-checks` | OK | Service calls `requirePermission`. |
| `controllers/providerController.ts` | Create evidence upload URL | `provider-ddq-packs:perform-checks` | OK | Service calls `requirePermission`. |
| `controllers/providerController.ts` | Update evidence tags | `provider-ddq-packs:perform-checks` | OK | Service calls `requirePermission`. |

## Frontend Audit

| Location | Operation | Required Permission | Status | Notes |
| --- | --- | --- | --- | --- |
| `CoreRouteContent.tsx` | Association providers/access requests routes | `association-provider-requests:read` | OK | Wrapped with `PermissionRequired`. |
| `CoreRouteContent.tsx` | Association system data route | `all-corporations:read` + `all-users:read` | OK | Wrapped with `PermissionRequired` all-of gate and Association route type. |
| `CoreRouteContent.tsx` | Association/provider/agent/stakeholder users routes | `own-users:read` | OK | Wrapped with `PermissionRequired` and matching corporation type. |
| `CoreRouteContent.tsx` | Association DDQ pack routes | `association-ddq-packs:read` | OK | Wrapped with `PermissionRequired`. |
| `CoreRouteContent.tsx` | Provider DDQ packs route | Provider user with mixed page-level actions | OK | Page hides or blocks checklist actions by permission. Add flow has separate finding below. |
| `CoreRouteContent.tsx` | Provider setup requests route | Any setup request read permission | FIXED | Route now uses `PermissionRequired` with any-of read permissions. |
| `CoreRouteContent.tsx` | Provider access requests route | Any access request read permission | FIXED | Route now uses `PermissionRequired` with any-of read permissions. |
| `CoreRouteContent.tsx` | Provider checklist/task routes | Any checklist view permission | OK | Pages show permission error and avoid API load without view permission. |
| `CoreAppHeader.tsx` | Association navigation | Matching read permissions | OK | Navigation items hidden by permission. |
| `CoreAppHeader.tsx` | Provider setup requests navigation | `provider-agent-requests:read` or `provider-stakeholder-requests:read` | OK | Navigation item hidden by permission. |
| `CoreAppHeader.tsx` | Provider users navigation | `own-users:read` | OK | Navigation item hidden by permission. |
| `CoreAppHeader.tsx` | Agent/stakeholder users navigation | `own-users:read` | OK | Navigation item hidden by permission. |
| `UsersPage.tsx` | Invite user panel | `own-users:invite` | OK | Panel hidden without permission. |
| `UsersPage.tsx` | Edit permissions button/dialog | `own-user-permissions:change` | OK | Edit disabled without permission and for self-edit. |
| `AssociationSystemData.tsx` | Invite association staff | `own-users:invite` | OK | Panel hidden without permission. |
| `AssociationProviders.tsx` | Approve/reject provider requests | `association-provider-requests:approve` | OK | Actions disabled without permission. |
| `AssociationAccessRequests.tsx` | Approve/reject provider access requests | `association-provider-requests:approve` | OK | Actions disabled without permission. |
| `AssociationDDQPacks.tsx` | Create/edit/status DDQ packs | `association-ddq-packs:edit` | OK | Edit controls hidden or disabled without permission. |
| `AssociationDDQPackContent.tsx` | Edit DDQ pack content | `association-ddq-packs:edit` | OK | Read-only mode without permission. |
| `ProviderSetupRequests.tsx` | Approve/reject agent/stakeholder setup requests | `provider-agent-requests:approve` / `provider-stakeholder-requests:approve` | OK | Actions disabled by requester type permission. |
| `ProviderAccessRequests.tsx` | Approve/reject agent/stakeholder access requests | `provider-agent-requests:approve` / `provider-stakeholder-requests:approve` | OK | Actions disabled by requester type permission. |
| `ProviderDDQPacks.tsx` | Show add DDQ pack flow | `provider-ddq-packs:add-new` | FIXED | Add button and add-flow entry are gated by permission. |
| `ProviderDDQPacks.tsx` | Save selected DDQ pack | `provider-ddq-packs:add-new` | FIXED | Save handler and button are gated by permission. |
| `ProviderDDQPacks.tsx` | View/create checklist from pack list | checklist view/perform permissions | OK | Buttons are gated by view/perform permissions. |
| `ProviderDDQChecklist.tsx` | View checklist | Any checklist view permission | OK | Page sets permission error and avoids load. |
| `ProviderDDQChecklist.tsx` | Mutate checklist/tasks | `provider-ddq-packs:perform-checks` | OK | Buttons and handlers gated. |
| `ProviderDDQChecklistTaskPage.tsx` | View task detail | Any checklist view permission | OK | Page sets permission error and avoids load. |
| `ProviderDDQChecklistTaskPage.tsx` | Mutate evidence/forms/tags | `provider-ddq-packs:perform-checks` | OK | Mutating controls and handlers gated. |

## Test User Model

Create representative users in test helpers or local test fixtures:

| Corporation Type | Allowed User | Disallowed User |
| --- | --- | --- |
| Association | Has permission under test | Lacks permission under test |
| Provider | Has permission under test | Lacks permission under test |
| Agent | Has permission under test | Lacks permission under test |
| Stakeholder | Has permission under test | Lacks permission under test |

The helper should remain small. Prefer explicit test data over a generalized
framework.

## Remaining Follow-Up Targets

1. Consider adding broader interaction tests for page-local controls in
   `CoreAppHeader.tsx` and `UsersPage.tsx`. Route-level permission coverage now
   exists in `CoreRouteContent.permissions.test.tsx`.

## Open Questions

| Question | Default Recommendation |
| --- | --- |
| Should `GET /provider/ddq-packs/available` require `provider-ddq-packs:add-new`? | Decided yes; implemented in service layer. |
| Should `GET /provider/ddq-packs/:packId/items` require `provider-ddq-packs:add-new` when used as an add-flow preview? | Decided yes; implemented in service layer. |
| Should provider setup/access request routes be wrapped at route level? | Decided yes; implemented with any-of route guards. |
| Should root package get `test`, `test:backend`, and `test:frontend` scripts? | Decided yes; implemented. |

## Commands Run

| Command | Result |
| --- | --- |
| `rg --files -g '*.test.ts' -g '*.test.tsx' -g 'vitest.config.*'` | Initial audit command used to locate existing tests/config before adding the permission coverage. |
| `rg "permission|permissions|hasPermission|Permission|requirePermission|can\\(" services/onboarding-service/src apps/core/src -n` | Identified backend and frontend permission surfaces. |
| `rg "protectedRoutes\\." services/onboarding-service/src/routes/onboardingRoutes.ts -n` | Enumerated backend protected routes. |
| `rg "path=|element=|hasPermission\\(|can[A-Z]|onClick=|disabled=|PermissionRequired" apps/core/src/pages apps/core/src/CoreRouteContent.tsx apps/core/src/components -n` | Enumerated frontend route/action gates. |
| `rg "listAvailableProviderDDQPacks|listProviderDDQPackItems|getAvailableProviderDDQPacks|getProviderDDQPackItems" -n` | Confirmed the frontend usage is the provider add flow. |
| `pnpm --filter @services/onboarding-service type-check` | Passed. |
| `pnpm --filter @services/onboarding-service test` | Passed initial backend permission tests. |
| `pnpm --filter @services/onboarding-service type-check` | Passed after adding backend tests. |
| `pnpm --filter @apps/core type-check` | Passed after frontend permission checks. |
| `pnpm --filter @apps/core test` | Passed initial frontend permission tests. |
| `pnpm --filter @apps/core type-check` | Passed after adding frontend tests. |
| `pnpm test` | Passed after the initial backend/frontend test harness was added. |
| `pnpm --filter @shared/permissions test` | Passed: shared permission matrix. |
| `pnpm --filter @services/onboarding-service test` | Passed: backend permission matrix and controller/service guard tests. |
| `pnpm --filter @apps/core test` | Passed: frontend `PermissionRequired`, route matrix, and provider DDQ tests. |

## Changes Made

| Step | File | Change |
| --- | --- | --- |
| 1 | `services/onboarding-service/src/services/onboardingService.ts` | Added `provider-ddq-packs:add-new` checks to `getAvailableProviderDDQPacks` and `getProviderDDQPackItems`. |
| 2 | `services/onboarding-service/package.json` | Added package-local `test` script using Vitest. |
| 2 | `services/onboarding-service/src/services/onboardingService.test.ts` | Added allowed/disallowed tests for provider DDQ available-pack and item-preview permission checks. |
| 2 | `pnpm-lock.yaml` | Added Vitest dependency lock entries for the onboarding service. |
| 3 | `apps/core/src/components/PermissionRequired.tsx` | Added support for any-of permission route guards. |
| 3 | `apps/core/src/CoreRouteContent.tsx` | Wrapped provider setup/access request routes with any-of read permission guards. |
| 3 | `apps/core/src/pages/ProviderDDQPacks.tsx` | Hid and guarded the provider DDQ add flow behind `provider-ddq-packs:add-new`. |
| 4 | `apps/core/package.json` | Added package-local Vitest/jsdom test script. |
| 4 | `apps/core/src/components/PermissionRequired.test.tsx` | Added allowed, denied, and any-of permission rendering tests. |
| 4 | `apps/core/src/pages/ProviderDDQPacks.test.tsx` | Added allowed/denied visibility tests for the provider DDQ add action. |
| 4 | `pnpm-lock.yaml` | Added frontend Vitest, React Testing Library, and jsdom dependency lock entries. |
| 4 | `package.json` | Added root `test`, `test:backend`, and `test:frontend` scripts. |
| Later cleanup | `packages/shared/permissions/src/index.test.ts` | Added shared permission matrix tests for all corporation types. |
| Later cleanup | `services/onboarding-service/src/services/currentUser.test.ts` | Added backend current-user guard matrix tests. |
| Later cleanup | `services/onboarding-service/src/controllers/*.permissions.test.ts` | Added controller permission gate wiring tests. |
| Later cleanup | `apps/core/src/CoreRouteContent.permissions.test.tsx` | Added route-level corporation and permission matrix tests. |
| Later cleanup | `apps/core/src/components/PermissionRequired.tsx` | Replaced loose `permission`/`permissions`/`requireAll` props with explicit single, `anyOf`, and `allOf` permission requirements plus corporation-type gates. |
