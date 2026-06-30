# Claude Review: Step 0010, Run 01

- Current git branch: `main`
- Reviewed at: 2026-06-29T20:38:53.323Z
- Command: `pnpm run claude:review -- 0010`

## Review Step

### 0010 Form Design Frontend

Purpose: review the form-design remote as its own application workflow.

Files:

- `apps/form-design/src/FormDesignRouteContent.tsx`
- `apps/form-design/src/pages/AssociationFormsPage.tsx`
- `apps/form-design/src/pages/FormTemplateDesigner.tsx`
- `apps/form-design/src/components/DesignerShell.tsx`
- `apps/form-design/src/components/ItemEditorDialog.tsx`
- `apps/form-design/src/components/FormPreview.tsx`
- `apps/form-design/src/components/PreviewField.tsx`
- `apps/form-design/src/components/Page.tsx`
- `apps/form-design/src/components/PermissionRequired.tsx`
- `apps/form-design/src/components/Status.tsx`
- `docs/specs/form-designer-spec.md`

Focus:

- designer draft/edit/publish behaviour
- field ordering and validation
- dialog dirty-state and cancellation
- preview correctness
- route and permission boundaries

## Review Output

# Form Design Frontend Review (Step 0010)

## Findings

### 1. `AssociationFormsPage` delete uses `window.confirm` for a destructive action — `blocking` → reconsider as `recommended`
`apps/form-design/src/pages/AssociationFormsPage.tsx` (`deleteTemplate`) uses `window.confirm` for permanent template deletion. This is consistent with `FormTemplateDesigner.tsx` (`deleteItem`, `closeDesigner`) and `ItemEditorDialog`'s `closeItemDialog` — the whole app relies on native browser confirm dialogs for destructive/discard actions. Native `confirm()` blocks the JS thread, cannot be styled, is easy to dismiss accidentally with Enter/Escape muscle memory, and is inconsistent with the shadcn `Dialog` primitives already used elsewhere in this same app (`ItemEditorDialog.tsx`). Given the spec explicitly calls out destructive-action clarity as a focus area, and a real shadcn `AlertDialog`-style component is one import away, this is worth a small, consistent fix rather than three different inline judgment calls scattered across files.
Classification: `recommended`.

### 2. Deleting a form template performs no check for in-use templates — `recommended`
`apps/form-design/src/pages/AssociationFormsPage.tsx` `deleteTemplate` calls `deleteAssociationFormTemplate(template.id)` directly behind a generic confirm message ("This will remove the form template for this Association."). Per `docs/specs/form-designer-spec.md`, DDQ pack items copy the form document at creation time and are not supposed to reference the template afterward, so deletion should be safe for already-created tasks. However, the confirm text doesn't reflect this guarantee, and nothing in this frontend code confirms the backend actually enforces copy-on-create semantics (out of scope here, backend-side). The UI message is slightly misleading either way: it implies removal risk to in-progress packs that, per spec, shouldn't exist. Worth tightening the copy so users aren't worried about an effect that (per spec) cannot occur, or confirming the backend behavior matches before finalizing copy.
Classification: `recommended`.

### 3. `closeDesigner`'s `canNavigateBackToAppPage` heuristic is unreliable and can navigate to an unexpected location — `recommended`
`apps/form-design/src/pages/FormTemplateDesigner.tsx` lines ~190–205. This function inspects `document.referrer` to decide whether `navigate(-1)` is safe, falling back to the templates list otherwise. Problems:
- `document.referrer` reflects the page that linked to the *current document load*, not SPA-internal navigation history. Inside a client-side-routed remote mounted via Module Federation, the referrer will frequently be stale/incorrect (e.g., still pointing at the shell's initial load), making the "same origin, different pathname" check unreliable for typical in-app navigation.
- Even when the heuristic says "go back," `navigate(-1)` could pop the user out of the form-design app entirely (e.g., back into shell chrome history, or to an unrelated previous route) since this remote shares browser history with the host shell. There's no bound on how far back `-1` goes relative to entering the designer.
- This produces inconsistent UX: sometimes "Cancel/Close" returns to the forms list, sometimes to some arbitrary prior page, depending on how the user arrived.

A simpler, deterministic alternative — always navigate to `FORM_DESIGN_ROUTES.associationForms` (or `associationFormDesignerReadOnly`/list with `replace: true`) — would match this app's "route ownership is owned by the remote" architecture goal and avoid referrer-based guessing entirely.
Classification: `recommended`.

### 4. Dirty-check normalization functions are fragile/duplicated and could silently misreport "no changes" — `optional`
`apps/form-design/src/pages/FormTemplateDesigner.tsx` has three structurally similar but separately maintained normalization functions: `normalizeItemForDirtyCheck`, `normalizeItemForDraftSave`, and `normalizeSchemaForSave`. They independently decide trimming/undefined-collapsing rules for `placeholder`, `helpText`, and `options`. If one is updated without updating the others (e.g., a new field type is added with its own optional string field), the dirty check can silently diverge from what's actually saved — e.g., a real edit might not mark `dirty`, or `closeItemDialog`'s confirm could incorrectly think there are no changes to discard. This is a maintainability risk more than a live bug today, but it's exactly the kind of thing likely to bite during a future field-type addition.
Classification: `optional`.

### 5. `radio` field preview uses raw `<input type="radio">` without unique `id`/`htmlFor` association — `optional`
`apps/form-design/src/components/PreviewField.tsx` `renderPreviewControl` for `"radio"` renders `<input type="radio" name={fieldId} />` inside a `<label>` wrapping text as a sibling, relying on implicit label-wrapping rather than explicit `id`/`htmlFor` pairing (unlike every other field type, which uses `htmlFor={fieldId}` on an explicit `<label>`). Implicit wrapping does work for click-target association, but is inconsistent with the explicit pattern used elsewhere in the same file, and lacks a `fieldset`/`legend` semantic boundary beyond the bare `<fieldset>` (no `<legend>{label}</legend>`— the visible group label is rendered separately in `PreviewField`, outside the `fieldset`, so screen readers won't associate the group heading with the radio group). This is preview-only (not the real provider-facing form runtime, per spec), so impact is limited, but it sets a copy-paste precedent for the eventual real form runtime in `apps/core`.
Classification: `optional`.

### 6. `FormTemplateDesigner` read-only mode is reachable via a guessable query string rather than a distinct route — `probably not worth fixing`
`apps/form-design/src/pages/FormTemplateDesigner.tsx`: `readOnly = mode === "edit" && (searchParams.get("mode") === "read-only" || !canEditForms)`. Read-only is partly query-string driven (`?mode=read-only`) and partly permission-driven. Functionally this is fine — backend authorization is what matters per the spec ("Backend authorization is authoritative. Frontend checks are usability only") — and read-only is also forced regardless of query string when the user lacks `forms:edit`. Not a security issue, just a minor inconsistency in how "view" vs "edit" is expressed (one query param, one route param) compared to `AssociationFormsPage`'s separate `associationFormDesignerReadOnly` route helper.
Classification: `probably not worth fixing`.

## Notes (non-findings)

- Route ownership in `FormDesignRouteContent.tsx` correctly mounts only `/form-design/*`-relative routes, matches `docs/specs/form-designer-spec.md`'s declared route list (`association/forms`, `association/forms/new`, `association/forms/:templateId/designer`), and the catch-all 404 is local to the remote — consistent with the module-federation architecture's remote-owned route maps.
- `PermissionRequired.tsx` correctly defers to `useCurrentUser().hasPermission` and treats this as UI-only (spec explicitly states backend authorization is authoritative), so the simple gate here is appropriate.
- `useDocumentTheme` correctly prefers host-provided theme over local theme state when mounted as a remote, with a sensible local-standalone fallback.
- Validation in `validateTemplate`/`validateItemDraft` (label required, options required for `select`/`radio`) matches the spec's "Value rules" section.
- The "permanent until Save" item-edit model (dialog stages a draft, `saveItemDialog` only mutates `schema` in memory, only `saveTemplate` persists) matches the spec's pack-editor draft philosophy applied consistently to form items.
- `Status.tsx` and `Page.tsx` are small, locally-owned, appropriately unshared per the "code used by exactly one app" boundary — no concern.

## Test Gaps

- No automated tests found/reviewed for dirty-state tracking in `FormTemplateDesigner` (item dialog dirty check, schema dirty check) — this is exactly the kind of logic (finding #4) that would benefit from a few targeted unit tests around `normalizeItemForDirtyCheck`/`isSameFormItem`.
- No test coverage evident for `canNavigateBackToAppPage` (finding #3) — given its environmental fragility, a unit test wouldn't fully cover real MFE navigation behavior anyway; manual verification in the actual shell-mounted context would be more valuable.
- No coverage of delete-confirmation flows (`AssociationFormsPage.deleteTemplate`, `FormTemplateDesigner.deleteItem`) for cancel-path behavior.

## Review Limitations

- `apps/form-design/src/context/CurrentUserContext.tsx`, `apps/form-design/src/constants/routes.ts`, `apps/form-design/src/hostContext.ts`, and `@frontend/api` client/type implementations were not included in the provided excerpts; permission-string values, route-constant exactness, and DTO shape correctness were taken on faith from usage rather than verified directly.
- Backend enforcement of copy-on-create semantics for form templates (referenced in finding #2) is out of scope for this step and not verifiable from the provided files.

