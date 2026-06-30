# UX Design Philosophy for AI Agents

This document captures the UX rules developed while building the DDQ Pack Editor. It is intended for AI agents making future product/UI changes in this repository.

## Generic Approach

Design operational tools as quiet, work-focused interfaces. Avoid decorative layouts, marketing-style sections, and repeated page titles that duplicate the active navigation tab. Use the available workspace for the task itself: filters, forms, tables, breadcrumbs, and direct actions.

Use standard components and familiar patterns wherever possible. Prefer shadcn primitives from `@frontend/shadcn` for buttons, tables, inputs, dropdowns, and breadcrumbs. If a needed shadcn component is missing, add it to `packages/frontend/shadcn/src/components/ui` using the normal shadcn structure rather than hand-rolling one page-specific approximation.

Do not put product-specific components in `@frontend/shadcn`. Shared application-level UI belongs in `@frontend/app-ui` and should have names that cannot be confused with shadcn primitives, such as `AppDataTable`.

Every page should have a breadcrumb. Breadcrumbs should look and behave like breadcrumbs, not like an improvised title. The current page should be non-clickable. Earlier breadcrumb links should be disabled and visually muted when following them would discard unsaved edits.

Avoid top-level page headings that merely repeat the selected nav tab or breadcrumb. If a heading adds no information, omit it. Let the breadcrumb and surrounding controls orient the user.

Separate draft edits from immediate commands:

- Field/form edits are draft-based. Users change values, then explicitly save or discard.
- Discrete commands happen immediately after the user intentionally triggers them.
- Destructive immediate commands require clear confirmation copy.
- Disable immediate commands while a draft edit is open or dirty.
- Model lifecycle as a status workflow when there is more than one state. Prefer `status: "draft" | "published" | "archived"` plus explicit transition actions over multiple booleans.

Make dirty state visible and actionable. Save buttons should only enable when there are valid unsaved changes. Discard/cancel buttons should only enable when they have meaningful work to do. If there are unsaved changes, show concise status text such as `Unsaved changes`.

Apply edit-awareness generically to every draft editor, including dialogs. Opening a dialog with default or saved values should not itself count as an edit. Cancel, close, or backdrop-dismiss confirmation should only appear when the user has made unapplied changes, and the dialog save button should only enable when the current draft differs from its starting state and is valid. Put this behavior in shared dialog/editor state where possible so every item type follows the same rule.

Place save/discard controls at the level of the thing being edited. For a page-level or section-level form, put the action row outside the fields and aligned with the form. Do not bury primary save controls inside a small metadata area if the user experiences the whole page as the editor.

Use immediate-command labels that communicate scope. Prefer `Publish Pack`, `Unpublish Pack`, `Delete item`, or `Delete pack` over vague verbs. For destructive confirmations, mention immediacy: `Delete X now? This change is immediate.`

For row insertion, prefer direct manipulation near the insertion point. The insertion affordance should appear before the first row, between rows, after the last row, and in the empty state. If a persistent add button becomes redundant, remove it. Make insertion controls discoverable enough to stand on their own.

When using table-adjacent controls that protrude outside table rows, account for clipping. Shared table components may use overflow for responsiveness; add page-level or component-level escape hatches rather than hacking around clipping in one cell.

## DDQ Editor Example

The DDQ editor uses a two-page model:

- `DDQ Packs` list page: find packs, create a new draft pack, open a pack, and run the one lifecycle action allowed by the pack's current status.
- DDQ pack editor page: edit one pack's metadata and ordered item list.

The list page has no large `DDQ Packs` title because the tab and breadcrumb already provide that context. It uses a shadcn breadcrumb with `DDQ Packs` as the current page. Creating a pack is draft-based: the user fills fields and clicks `Create Pack`. Row commands are disabled while the create form has unsaved values.

The pack editor page uses a breadcrumb:

```text
DDQ Packs / {pack name}
```

`DDQ Packs` links back to the list only when there are no unsaved edits. If metadata or an item form is dirty, the breadcrumb link becomes visually muted and non-clickable.

Pack metadata follows the draft-edit rule. The metadata fields are:

- pack name
- valid from
- valid to

The action row sits outside the metadata field area:

```text
Unsaved changes        Publish Pack / Archive Pack / Restore Pack   Discard changes   Save Pack
```

`Save Pack` only saves metadata fields and preserves the current lifecycle status. `Discard changes` resets metadata fields to the saved pack. Both are disabled when there are no metadata changes.

Lifecycle is a small explicit state machine:

```text
draft     --publish--> published
published --archive--> archived
archived  --restore--> published
```

These lifecycle actions are immediate commands, not metadata fields. The action button is disabled while metadata is dirty or an item form is open. This keeps the model clear: form edits are saved; lifecycle commands happen now.

Item add/edit follows the draft-edit rule. Clicking an insertion `+` opens an item form. The user chooses the task type, fills the title/config, and then clicks `Add Item` or `Save Item`. The button only enables when the item form has valid unsaved changes.

Item deletion is an immediate destructive command. It asks for confirmation with immediacy in the copy:

```text
Delete {item title} now? This change is immediate.
```

The insertion UI is the primary way to add items. A circular plus appears in the left gutter before, between, and after rows. It stands slightly proud of the table, with a primary-tinted insertion line. The old persistent `Add Item` button was removed because it duplicated the insertion controls and made the insertion model less clear.

The insertion behavior maps directly to backend semantics:

- plus before first row sends `insert_after_item_id: null`
- plus between rows sends the row-above item id
- plus after the last row sends the last item id

The table allows visible overflow on this page so the protruding insertion control is not clipped, while the shared table keeps its normal responsive overflow behavior elsewhere.
