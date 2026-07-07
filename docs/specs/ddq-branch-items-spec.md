# DDQ Branch Items Specification

## Purpose

This document specifies `branch` DDQ pack items. Branches let an Association
author define mutually exclusive paths in a DDQ pack. A Provider chooses one
branch option during checklist execution and only receives the tasks for that
selected path.

Branches build on the existing DDQ pack editor and Provider checklist routes:

```text
/core/association/ddq-packs/:packId
/core/provider/ddq-packs/:packId/checklist
/core/provider/ddq-packs/:packId/checklist/tasks/:taskId
```

## Product Behavior

### Association DDQ Pack Editor

The existing `Add item` dropdown must include a new option:

```text
Branch
```

When an Association user adds a branch:

- The current table ends with a branch row.
- The branch mini form asks for radio option labels, not a checkpoint message.
- A branch must have at least 2 options and at most 8 options.
- Option labels must be non-empty after trimming.
- Option labels should be unique within the branch after trimming and
  case-insensitive comparison.
- After the branch is added, the UI renders one tab per option below the branch
  row.
- Each tab owns an independent child table for that option path.
- Adding, editing, deleting, or inserting items inside one branch tab must not
  affect sibling option tabs.
- Branches are nestable. A branch tab may contain another branch, and nested
  branch behavior is recursive.
- Checkpoints continue to work inside every branch path. Within a branch path,
  checkpoints split that path into sequential tables and lock later sections in
  the Provider checklist until earlier work is complete.

When an Association user deletes a branch:

- The branch row is deleted.
- Every item under every branch option is deleted.
- Deletion is recursive: nested branch rows and all of their descendants are
  deleted as well.
- Deleting a branch does not merge child items back into the parent table.

When an Association user edits a branch:

- Renaming an option should preserve the option's child items.
- Adding a new option creates a new empty option tab.
- Removing an option deletes every child item under that option recursively.
- If option edit semantics are too large for the first implementation, the
  minimum acceptable first version is to allow editing the branch title only and
  require delete/recreate for option changes.

### Provider DDQ Checklist

When a Provider reaches a branch row:

- The branch row appears in the table that contains it.
- Below the branch row, the Provider is asked to select one of the branch
  options configured by the Association.
- The Provider does not see all branch tabs.
- After selection, only the table/path corresponding to the selected option is
  visible.
- Non-selected branch option tasks must not be created or activated in the
  Provider checklist.
- Branches are nestable. If the selected path contains another branch, the
  Provider repeats the same selection flow for that nested branch.

When a Provider changes a branch selection:

- All checklist work associated with the previously selected option path is
  deleted.
- This deletion is recursive for nested branch selections and their tasks.
- Checklist tasks for the newly selected option path are created or activated.
- The UI should make the destructive consequence clear before changing an
  existing branch selection.

Provider branch paths must respect checkpoints:

- If a selected branch path contains checkpoints, later tables in that selected
  path are locked until all rows above the checkpoint are complete or withdrawn.
- Locked rows display status `Pending`.
- Locked rows are not executable, reviewable, or status-changeable.

## Domain Model

### DDQ Pack Item Kind

Extend the shared item kind:

```ts
type DDQPackItemKind = "ddq-task" | "checkpoint" | "branch";
```

Branch items have:

```ts
type DDQBranchItem = DDQPackItemBase & {
  kind: "branch";
  task_type: null;
  config: DDQBranchConfig;
};

type DDQBranchConfig = {
  options: DDQBranchOption[];
};

type DDQBranchOption = {
  id: string;
  label: string;
};
```

Option `id` must be stable and must not be derived from the label. A UUID or
short generated identifier is acceptable.

### Storing Branch Child Items

The current DDQ item list is linear. Branches require hierarchical placement.
The implementation should add explicit parent-path metadata to DDQ pack items
rather than encoding hierarchy in `position` alone.

Recommended columns on `ddq_pack_item`:

```text
parent_branch_item_id integer null references ddq_pack_item(id) on delete cascade
parent_branch_option_id text null
```

Rules:

- Top-level items have both parent columns null.
- Items inside a branch option have `parent_branch_item_id` set to the branch
  item id and `parent_branch_option_id` set to one of the branch config option
  ids.
- `position` is scoped to siblings with the same parent branch item and option.
- For top-level items, `position` is scoped to the DDQ pack where both parent
  columns are null.
- For nested branches, descendants point to their direct parent branch and
  option, not the root branch.

The API response should expose enough metadata for the frontend to reconstruct
the tree:

```ts
type DDQPackItem = {
  id: number;
  pack_id: number;
  position: number;
  kind: "ddq-task" | "checkpoint" | "branch";
  task_type: DDQTaskType | null;
  title: string;
  config: Record<string, unknown>;
  parent_branch_item_id: number | null;
  parent_branch_option_id: string | null;
  created_at: string;
};
```

The draft save endpoint may accept a nested tree or a flat list with parent
metadata. Prefer the shape that keeps validation explicit and easy to test.

## Provider Checklist Model

Provider checklist tasks should only exist for visible/selected work:

- Top-level tasks are created when the checklist is created.
- Tasks under a branch option are created only after the Provider selects that
  option.
- Tasks under nested branches are created only after each ancestor option is
  selected.
- Non-selected option tasks do not exist in the checklist.

Add branch selection persistence. A dedicated table is recommended:

```text
provider_ddq_checklist_branch_selection
  id
  checklist_id
  branch_pack_item_id
  selected_option_id
  created_at
  updated_at
```

Unique constraint:

```text
(checklist_id, branch_pack_item_id)
```

When changing `selected_option_id`, delete all checklist tasks and nested branch
selection rows that belong to the old selected option subtree, then create tasks
for the new selected option's immediate path. If that new path includes nested
branches, create branch rows/selection prompts but do not create nested option
tasks until the nested selection is made.

## Backend API

Association endpoints must support:

- Creating, updating, saving, and listing branch items.
- Validating branch config with 2 to 8 stable options.
- Saving branch child items with parent branch metadata.
- Recursive deletion for branch items and removed branch options.

Provider endpoints must support:

- Reading checklist tasks plus branch selection state.
- Selecting/changing a branch option.
- Creating selected-path checklist tasks after selection.
- Deleting old selected-path work when a Provider changes selection.

Recommended provider route:

```text
PUT /auth/provider/ddq-packs/:packId/checklist/branches/:branchTaskId/selection
```

Payload:

```json
{
  "option_id": "stable-option-id"
}
```

Response should return the refreshed checklist state used by
`getProviderDDQChecklist`.

## Frontend Implementation Notes

### Association Page

File:

```text
apps/core/src/pages/AssociationDDQPackContent.tsx
```

The current frontend already splits top-level content into multiple tables for
checkpoints. Branch rendering should generalize the display model from a linear
section list to a recursive tree:

- Render sibling items in a table until a structural row (`checkpoint` or
  `branch`) changes the layout.
- Checkpoints create a single next section.
- Branches create tabbed option sections.
- Each branch option tab renders its child siblings recursively.

The branch mini form should support:

- Title.
- 2 to 8 radio option label fields.
- Add option button until 8 options exist.
- Remove option button while more than 2 options remain.
- Validation before `Add Item` / `Save Item` enables.

### Provider Page

File:

```text
apps/core/src/pages/ProviderDDQChecklist.tsx
```

The current frontend already:

- Splits tables at checkpoints.
- Locks sections below unopened checkpoints.
- Displays locked rows as `Pending`.

Branch support should extend this display model:

- Render available checklist tasks in tree order.
- At a branch row, render a branch option selector if no option has been chosen.
- If an option has been chosen, render only tasks belonging to that selected
  option path.
- Do not render sibling option paths.
- Preserve checkpoint locking within the selected path.

## Testing Requirements

Backend tests should cover:

- Branch config validation.
- Recursive branch deletion in DDQ pack drafts.
- Saving branch child positions scoped to parent option.
- Provider checklist creation does not create non-selected option tasks.
- Provider branch selection creates selected-path tasks.
- Changing selection deletes old selected-path tasks and nested selections.
- Nested branch selection works recursively.

Frontend tests should cover:

- Association Add item dropdown includes Branch.
- Branch mini form validates 2 to 8 options.
- Saving a branch creates option tabs.
- Items added in one branch tab do not appear in sibling tabs.
- Deleting a branch removes all descendant UI rows.
- Provider checklist shows a branch selector.
- Provider selected branch shows only the selected path.
- Locked checkpoint sections inside a selected branch show `Pending`.

## Suggested Implementation Sequence

1. Add shared/backend types for `branch`.
2. Add database migrations for branch parent metadata and provider branch
   selections.
3. Update Association repository/service validation and draft save behavior.
4. Update Provider checklist creation and branch selection services.
5. Update API client types and methods.
6. Update Association editor UI with recursive branch/tab rendering.
7. Update Provider checklist UI with branch selectors and selected-path display.
8. Add backend tests, then frontend tests.
9. Run `pnpm --filter @apps/core type-check`,
   `pnpm exec vitest run --project @apps/core`,
   backend unit tests, and relevant builds.

