# Provider DDQ Packs Tab Implementation Brief

## Goal

Add a Provider-facing top navigation tab named `DDQ Packs`, positioned before `Setup Requests` for Provider users. The page lets a Provider user start adding a DDQ pack by selecting an existing Association-authored DDQ pack, then reviewing the tasks contained in the selected pack.

DDQ packs now have three statuses: `draft`, `published`, and `archived`. Provider users must never see `draft` packs in this flow. When the `Only show currently valid packs` filter is on, a pack is valid only when today's date is between `valid_from` and `valid_to` inclusively and `status === "published"`. When that filter is off, the table may show both `published` and `archived` packs, but still never `draft` packs.

Follow the current
[Module Federation Architecture](../architecture/module-federation.md) for
shell/core/form-design route ownership and global navigation.

Follow the UX rules in
[UX Design Philosophy for AI Agents](../design-guides/ux-design-philosophy-for-ai-agents.md),
and use the existing Association DDQ editor/list implementation as the closest
product example.

## Existing Code To Reuse

- Provider in-app navigation lives in
  `apps/core/src/components/CoreAppHeader.tsx`.
- Core route helpers live in `apps/core/src/constants/routes.ts`; route
  declarations live in `apps/core/src/CoreRouteContent.tsx`.
- Existing Association DDQ pack list page: `apps/core/src/pages/AssociationDDQPacks.tsx`.
- Existing Association DDQ pack editor, including dirty breadcrumb behavior: `apps/core/src/pages/AssociationDDQPackContent.tsx`.
- Existing table/filter wrapper: `packages/frontend/app-ui/src/data-display/AppDataTable.tsx`.
- Corporation table filters to mimic: `apps/core/src/pages/AssociationSystemData.tsx`.
- Shared shadcn-style table primitives: `packages/frontend/shadcn/src/components/ui/table.tsx`.
- Shared breadcrumb primitives: `packages/frontend/shadcn/src/components/ui/breadcrumb.tsx`.
- Existing DDQ API client functions and types:
  `packages/frontend/api/src/onboarding/client.ts` and
  `packages/frontend/api/src/onboarding/types.ts`.
- Existing DDQ backend repository: `services/onboarding-service/src/database/ddqPackRepository.ts`.

## UX Requirements

The page must be quiet and work-focused. Do not add a large page heading that repeats the tab name. The breadcrumb and controls are enough.

At the top of the page, render a shadcn breadcrumb. For the default Provider page, it should be:

```text
DDQ Packs
```

When the add/select flow is active, it should be:

```text
DDQ Packs / Add DDQ Pack
```

The first crumb must be aware of active edits/flow state in the same spirit as the DDQ editor. If leaving the add flow would discard the current selected row or any future draft state, render the earlier crumb visually muted and non-clickable using the existing pattern from `AssociationDDQPackContent.tsx`:

```tsx
<BreadcrumbLink
  asChild
  className="pointer-events-none opacity-50"
  aria-disabled="true"
>
  <span>DDQ Packs</span>
</BreadcrumbLink>
```

Below the breadcrumb, the default page should contain a single primary button labeled `Add DDQ Pack`.

When the user presses `Add DDQ Pack`, everything below the breadcrumb is replaced by the DDQ pack selection screen. Do not open a modal or append the selection UI below the original button.

The selection screen contains:

- A short scrollable DDQ packs table.
- Filters above the packs table, styled/positioned like the filters in the Association System Data corporations table.
- A second Tasks table populated from the selected DDQ pack.

## Navigation Work

Add a new route constant:

```ts
providerDDQPacks: "/core/provider/ddq-packs"
```

Register it in `apps/core/src/CoreRouteContent.tsx` with a new page component,
likely `ProviderDDQPacks`.

Update the Provider branch in
`apps/core/src/components/CoreAppHeader.tsx` so the tab order is:

```text
DDQ Packs | Setup Requests | Users
```

Keep the existing admin check for `Setup Requests`. The new `DDQ Packs` tab should be available to Provider users unless the product owner decides it is admin-only; if making it admin-only, match the `Setup Requests` guard and document that decision in the PR.

## Backend/API Work

Do not make Provider UI call `/auth/association/ddq-packs`; those endpoints require Association authorization and would fail for Provider users.

Add Provider read-only endpoints for selecting packs:

- `GET /auth/provider/ddq-packs`
- `GET /auth/provider/ddq-packs/available`
- `GET /auth/provider/ddq-packs/:packId/items`
- `POST /auth/provider/ddq-packs`

Recommended behavior:

- Require `requireProviderUser` or `requireProviderAdminUser` in `services/onboarding-service/src/controllers/providerController.ts`. Use admin-only only if the add action is intended to be administrative.
- `GET /auth/provider/ddq-packs` returns the provider corporation's saved DDQ pack list.
- `GET /auth/provider/ddq-packs/available` returns non-draft packs that are not already in the provider corporation's saved list: `published` and `archived`. A Provider should never see or select Association `draft` packs.
- `POST /auth/provider/ddq-packs` saves a selected pack to the current provider corporation's independent DDQ pack list. Reject unknown packs, `draft` packs, and duplicate additions.
- Let the frontend's `Only show currently valid packs` filter narrow the non-draft list to packs where today's date is inclusively between `valid_from` and `valid_to` and `status === "published"`.
- Reuse `listDDQPacks` and `listDDQPackItems` from `ddqPackRepository.ts`, but add service-layer filtering so draft packs do not leak.
- For `items`, reject unknown pack IDs and draft pack IDs with a 404-style service error. Published and archived packs are readable if they are visible in the Provider list.

Add matching frontend API client functions in
`packages/frontend/api/src/onboarding/client.ts`, for example:

```ts
export const listProviderDDQPacks = async () => {
  return authJson<ListDDQPacksResponse>(
    "/auth/provider/ddq-packs",
    "Could not read DDQ Packs.",
  );
};

export const listProviderDDQPackItems = async (packId: number) => {
  return authJson<ListDDQPackItemsResponse>(
    `/auth/provider/ddq-packs/${encodeURIComponent(packId)}/items`,
    "Could not read DDQ Pack Items.",
  );
};
```

Persist provider selections with a join table such as `provider_ddq_pack(provider_corporation_id, ddq_pack_id, created_at)`, with a unique constraint on `(provider_corporation_id, ddq_pack_id)`.

## Provider Page Behavior

Create `apps/core/src/pages/ProviderDDQPacks.tsx`.

State shape should cover:

- `mode`: `"list"` or `"add"`.
- `providerPacks`: `DDQPack[]` for the provider corporation's saved list.
- `availablePacks`: `DDQPack[]` for the add flow.
- `selectedPackId`: `number | null`.
- `items`: `DDQPackItem[]`.
- `loadingProviderPacks`, `loadingAvailablePacks`, `savingPack`, `loadingItems`, `message`, `error`.
- Filter state if not using `DataTable`'s internal column filters.

On initial page load, the default mode should show the provider corporation's saved DDQ packs plus the `Add DDQ Pack` button.

When entering add mode:

1. Set `mode` to `"add"`.
2. Clear old selection and items.
3. Load available Provider-visible DDQ packs that are not already saved for this provider.
4. Default the currently valid filter to true, unless product wants all non-draft packs by default.

When a pack row is selected:

1. Set `selectedPackId`.
2. Load items for that pack with `listProviderDDQPackItems(selectedPackId)`.
3. Populate the Tasks table.
4. If loading fails, keep the selected row visible but show an error and empty the Tasks table.

## DDQ Packs Table

Columns:

- Select checkbox/radio column, using the normal TanStack/shadcn row selection pattern.
- `Name`
- `Valid From`
- `Valid To`
- `Status`

The table should be short and scrollable. Use a constrained wrapper such as:

```tsx
<div className="max-h-72 overflow-auto border">
  <Table>...</Table>
</div>
```

Keep the header visible only if easy to do cleanly; sticky headers are nice but not required.

Filters above the table:

- Text filter by name.
- Boolean filter labeled/announced as `Only show currently valid packs`.

Style the filters like `DataTable` filters in `AssociationSystemData.tsx`: flex row on larger screens, stacked on mobile, shadcn `Input`, and standard control sizing.

The currently valid filter should compare today's local date to the pack's date-only fields and require `status === "published"`:

```ts
function isCurrentlyValid(pack: DDQPack, today = new Date()) {
  const todayKey = toDateKey(today);
  return (
    pack.status === "published" &&
    pack.valid_from <= todayKey &&
    pack.valid_to >= todayKey
  );
}

function isProviderVisiblePack(pack: DDQPack) {
  return pack.status !== "draft";
}

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
```

Prefer date-key string comparison because `valid_from` and `valid_to` are already `YYYY-MM-DD` strings from the backend.

Apply the visibility rules in this order:

1. Always exclude `draft` packs, even when the valid-only filter is off.
2. Apply the name filter.
3. If `Only show currently valid packs` is on, require `isCurrentlyValid(pack)`.
4. If `Only show currently valid packs` is off, include all remaining non-draft packs, including `archived` packs.

For row selection, either:

- Extend `DataTable` with optional single-row selection support if the abstraction stays clean; or
- Build a small page-local TanStack table using `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, and `TableHead`.

The page-local table is likely lower risk because the current `DataTable` does not support row selection.

Use `data-state={selectedPackId === pack.id ? "selected" : undefined}` on selected rows so the existing shadcn table styling applies. Make the row clickable as well as the selection control. Use a checkbox if the shared UI package has a checkbox primitive; otherwise use an accessible radio or native checkbox styled conservatively. If adding a missing shadcn checkbox primitive, add it to `packages/frontend/shadcn` instead of creating a page-only imitation.

## Tasks Table

The Tasks table is read-only and populated from `DDQPackItem[]`.

Recommended columns:

- `Position`
- `Task`
- `Type`
- `Document Type` where relevant, otherwise `-`

Map item kinds/types consistently with the DDQ editor:

- `checkpoint` -> `Checkpoint`
- `document-upload` -> `Document upload`
- `form-completion` -> `Form completion`
- `photo-upload` -> `Photo upload`

For `document-upload`, `config.document_type` may contain a value such as `passport`, `driving-license`, `head-and-shoulders-photo`, or `other`. Reuse `DDQ_DOCUMENT_TYPES` labels from the API client where practical.

Empty states:

- No selected pack: `Select a DDQ Pack to view its tasks.`
- Selected pack with no tasks: `This DDQ Pack has no tasks.`
- Loading items: use concise status text near/in the table, not a large panel.

## Dirty/Active Flow Handling

For the first version, selecting a row is not a persistent edit, but the add flow itself is an active flow. Treat it as active state for breadcrumb behavior:

- In `mode === "add"`, render the `DDQ Packs` crumb as disabled/muted.
- Provide a visible `Cancel` or `Close` button in the selection screen action row to return to the default page and clear `selectedPackId`/`items`.

The selected row is a draft choice until the user confirms it:

- Enable the final action only when a pack is selected.
- Disable navigation/previous breadcrumbs while selection is active.
- Show concise status text such as `Unsaved selection` if useful.

## Suggested Implementation Slices

### Slice 1: Provider Read API

Files:

- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/controllers/providerController.ts`
- `services/onboarding-service/src/routes/onboardingRoutes.ts`
- `packages/frontend/api/src/onboarding/client.ts`

Deliverable:

- Provider users can list published DDQ packs.
- Provider users can list non-draft DDQ packs.
- Provider users can list their own saved DDQ packs.
- Provider users can add a non-draft DDQ pack to their own saved list.
- Provider users can list items for a non-draft DDQ pack.
- Association-only endpoints remain unchanged.

Tests/checks:

- Existing onboarding service tests if present.
- Manual API check as Provider user.
- Verify Association draft packs do not appear through Provider endpoints.
- Verify archived packs can appear when the valid-only filter is off, and do not appear when it is on.

### Slice 2: Route And Navigation

Files:

- `apps/core/src/constants/routes.ts`
- `apps/core/src/CoreRouteContent.tsx`
- `apps/core/src/components/CoreAppHeader.tsx`
- New `apps/core/src/pages/ProviderDDQPacks.tsx`

Deliverable:

- Provider header displays `DDQ Packs` before `Setup Requests`.
- `/core/provider/ddq-packs` renders the new page with breadcrumb, `Add DDQ Pack`, and the provider corporation's saved DDQ pack list.

Tests/checks:

- Login as Provider admin and Provider member if fixtures support both.
- Confirm current tab styling follows nested route behavior.

### Slice 3: Selection Screen

Files:

- `apps/core/src/pages/ProviderDDQPacks.tsx`
- Possibly `packages/frontend/shadcn/src/components/ui/checkbox.tsx` and package exports, only if no shared checkbox exists and a checkbox is chosen.

Deliverable:

- Pressing `Add DDQ Pack` replaces page content below breadcrumb.
- Packs table has name and currently-valid filters.
- Current-valid filtering means `status === "published"` and today's date is inclusively between `valid_from` and `valid_to`.
- Turning current-valid filtering off shows all non-draft packs subject to the name filter, including archived packs.
- `Add selected DDQ Pack` persists the selected pack to the current provider corporation's saved DDQ pack list and returns to the default page.
- Packs table is short, scrollable, row-selectable, and uses shadcn table selected styling.
- Selecting a pack loads and displays its tasks.
- Breadcrumb previous item is disabled/muted while in add flow.

Tests/checks:

- Filter by partial name.
- Toggle `Only show currently valid packs` and verify date boundaries are inclusive.
- Select each visible pack and confirm tasks update.
- Confirm narrow viewport does not overlap controls or table text.

## Acceptance Checklist

- Provider nav order is `DDQ Packs`, `Setup Requests`, `Users`.
- The new page uses shadcn breadcrumb primitives.
- No redundant `DDQ Packs` page heading is added.
- `Add DDQ Pack` gives the full below-breadcrumb workspace to the selection UI.
- DDQ pack filters match the style and placement of the corporations table filters.
- Current-valid filtering compares today's date inclusively against `valid_from` and `valid_to` and requires `status === "published"`.
- Turning off current-valid filtering shows all non-draft packs subject to other filters, including `archived`.
- DDQ pack rows are selectable using shadcn/TanStack-style row selection.
- The Tasks table refreshes when a different pack is selected.
- Provider DDQ API access does not rely on Association-only endpoints.
- Draft Association packs are never visible to Provider users.
