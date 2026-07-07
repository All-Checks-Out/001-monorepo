# Subject Capability Redesign Implementation Plan

## Purpose

Replace the current flat Subject implementation with the revised
Subjects-and-Properties model.

This repository is in active development, has no users, and is not deployed.
There is no requirement to preserve legacy data, legacy APIs, legacy form
documents, old seed fixtures, or old UI behaviours. Implement this plan as if
the earlier Subject specification had never existed. Remove files, routes,
tests, seed data, migrations, and code paths that only exist for the old
specification.

This document supersedes the previous plan that treated concepts such as
`employment`, `directorship`, `qualification`, and `membership` as independent
Subject types.

## Current Repository Findings

The existing implementation already contains useful scaffolding:

- `packages/shared/subjects` provides committed metadata and validation.
- `services/onboarding-service/database/sql/V16__Create_subjects.sql` creates a
  provider-owned `subject` table with JSON values.
- `services/onboarding-service/src/database/subjectRepository.ts` provides
  provider-scoped Subject persistence.
- `services/onboarding-service/src/controllers/providerController.ts` exposes
  provider Subject CRUD.
- `services/onboarding-service/src/controllers/sharedController.ts` exposes
  Subject type metadata.
- `services/onboarding-service/src/services/formTemplateValidation.ts` validates
  form items including old `subject-group` items.
- `apps/form-design/src/pages/FormTemplateDesigner.tsx` has an `Add Subject`
  path.
- `apps/core/src/pages/FormCompletionWorkspace.tsx` can add repeated Subject
  entries and copy existing Subject values into a form response.
- `apps/core/src/pages/ProviderSubjects.tsx` and
  `apps/core/src/pages/ProviderSubjectDetail.tsx` provide provider Subject CRUD.
- `packages/frontend/api/src/onboarding/types.ts` and
  `packages/frontend/api/src/onboarding/client.ts` expose frontend DTOs and API
  calls.
- `packages/shared/permissions` already contains `provider-subjects:read` and
  `provider-subjects:edit`.

The following parts are conceptually wrong for the revised design and must be
rewritten or removed:

- The metadata model uses only flat `attributes`.
- `employment`, `directorship`, `qualification`, and `membership` are top-level
  Subject types.
- Subject values are typed as `Record<string, string | boolean | null>`, which
  cannot represent complex repeatable properties.
- Form `subject-group` items store only `attributeKeys`; they cannot select a
  structured property group.
- Provider autofill copies only flat attribute values.
- Form response validation understands only scalar values and flat arrays of
  scalar objects.
- Seed data creates old top-level employment/directorship/qualification/
  membership Subjects.
- Tests and docs encode the old abstraction.

## Target Domain Model

A `Subject` is a real-world entity with its own identity in the system. A
Subject can have evidence, be checked, appear on forms, be searched, be reused,
be selected by providers, and later participate in relationships.

Initial Subject types:

- `person`
- `organisation`
- `document`
- `property`
- `vehicle`
- `business_event`

Do not include these as top-level Subject types:

- `employment`
- `directorship`
- `qualification`
- `membership`

Those concepts are complex repeatable properties on `person` unless a future
product decision explicitly promotes one of them to a real Subject with its own
identity.

First implementation scope:

- `person` is the only Subject type with complex properties.
- The only complex properties in the first implementation are
  `directorships`, `employments`, `qualifications`, and `memberships`.
- Each of those complex properties is repeatable and exactly one level deep.
- The UI should render those repeatable complex properties as structured data
  tables where practical.
- The metadata model must stay data-driven, but it should not be recursive.
  Complex properties contain simple child properties only.

Every Subject consists of properties. A property is either simple or complex.

Simple properties store one scalar value. Initial scalar kinds:

- `text`
- `long_text`
- `date`
- `number`
- `boolean`
- `email`
- `phone`
- `currency`
- `select`

Complex properties contain child properties and may be repeatable. To keep the
implementation simple, complex properties contain simple child properties only.
They cannot contain other complex properties.

Example `person` metadata:

```text
person
  name text required
  date_of_birth date
  gender select
  nationality text
  directorships[] complex
    company text
    role text
    date_started date
    date_left date
  employments[] complex
    employer text
    role text
    date_started date
    date_left date
  qualifications[] complex
    qualification text
    grade text
    issuing_body text
    date_awarded date
  memberships[] complex
    association text
    membership_type text
    status select
```

## Metadata Model

Subject definitions remain platform-owned metadata committed to the repository.
Keep the source of truth in `packages/shared/subjects/src/subjectTypes.ts`
because backend validation, frontend rendering, and seed scripts already import
from this shared package.

Replace the old `SubjectAttributeDefinition` vocabulary with `SubjectProperty`
vocabulary.

Recommended model:

```ts
export type SubjectSimplePropertyType =
  | "text"
  | "long_text"
  | "date"
  | "number"
  | "boolean"
  | "email"
  | "phone"
  | "currency"
  | "select";

export type SubjectPropertyBase = {
  key: string;
  label: string;
  helpText?: string;
  required?: boolean;
};

export type SubjectSimplePropertyDefinition = SubjectPropertyBase & {
  kind: "simple";
  valueType: SubjectSimplePropertyType;
  options?: readonly string[];
};

export type SubjectComplexPropertyDefinition = SubjectPropertyBase & {
  kind: "complex";
  repeatable: true;
  display: "table";
  properties: readonly SubjectSimplePropertyDefinition[];
};

export type SubjectPropertyDefinition =
  | SubjectSimplePropertyDefinition
  | SubjectComplexPropertyDefinition;

export type SubjectTypeDefinition = {
  key: string;
  label: string;
  description?: string;
  displayNameProperty: string;
  properties: readonly SubjectPropertyDefinition[];
};
```

Use lowercase snake_case keys. Treat keys as durable once forms and seed data
depend on them.

Property paths should use dot notation plus `[]` for repeatable complex
properties in developer-facing code and test fixtures:

```text
name
date_of_birth
directorships[].company
directorships[].role
qualifications[].issuing_body
```

Do not store paths as the only form representation. Forms should store selected
properties so complex table sections can be rendered without repeatedly parsing
string paths. A selection can include simple Subject properties and one-level
complex table properties with selected simple columns.

## Subject Value Model

Provider Subjects persist values as JSON in the existing `subject.values_json`
column. Keep the table concept, but replace the JSON shape.

Recommended TypeScript value model:

```ts
export type SubjectScalarValue = string | number | boolean | null;
export type SubjectComplexRowValue = Record<string, SubjectScalarValue>;
export type SubjectPropertyValue =
  | SubjectScalarValue
  | SubjectComplexRowValue[];
export type SubjectValues = Record<string, SubjectPropertyValue>;
```

Example `person` values:

```json
{
  "name": "Ada Lovelace",
  "date_of_birth": "1815-12-10",
  "gender": "female",
  "directorships": [
    {
      "company": "Analytical Engines Ltd",
      "role": "Director",
      "date_started": "1843-01-01",
      "date_left": null
    }
  ],
  "qualifications": [
    {
      "qualification": "Mathematics",
      "grade": "Distinction",
      "issuing_body": "University of London",
      "date_awarded": "1835-06-01"
    }
  ]
}
```

Validation is metadata-driven but non-recursive:

- Reject unknown top-level property keys.
- Reject unknown complex row child property keys.
- Normalize blank strings to `null`.
- Validate dates as `YYYY-MM-DD`.
- Validate numbers and currency as numbers.
- Validate email and phone with lightweight format checks.
- Validate selects against configured options.
- Enforce required properties.
- Enforce array values for repeatable complex properties.
- Enforce object row values inside repeatable complex properties.
- Return normalized values in the same shape as metadata.

There should be no recursive metadata walking beyond this fixed depth:
Subject -> property -> complex row -> simple child property.

## Database Design

Because no legacy deployment exists, do not add compatibility migrations.
Rewrite the current Subject migration in place.

Keep:

- `subject.id`
- `subject.provider_corporation_id`
- `subject.subject_type_key`
- `subject.display_name`
- `subject.values_json`
- `subject.created_by_app_user_id`
- `subject.updated_by_app_user_id`
- `subject.archived_at`
- timestamps and provider/user foreign keys

Change:

- Update comments and constraints to describe structured JSON values.
- Keep `jsonb_typeof(values_json) = 'object'`.
- Keep provider/type/search indexes.

Do not add property definitions to the database. The platform metadata file is
the catalogue.

Do not create legacy migration scripts from the old flat model to the new
structured model. Local databases should be reset.

## API Design

Keep the current route families but update DTO names and payload shapes:

```text
GET    /auth/subject-types
GET    /auth/provider/subjects
GET    /auth/provider/subjects/:subjectId
POST   /auth/provider/subjects
PUT    /auth/provider/subjects/:subjectId
POST   /auth/provider/subjects/:subjectId/archive
```

`GET /auth/subject-types` should return metadata with `properties`, not
`attributes`.

Provider Subject payload:

```ts
export type SubjectPayload = {
  subject_type_key: string;
  values: SubjectValues;
};
```

The backend should derive `display_name` from `displayNameProperty`. Do not ask
the frontend to submit it. This prevents display names drifting from values.

`GET /auth/provider/subjects` filters:

- `subject_type_key`
- `q`
- `include_archived`

Do not add endpoints for legacy top-level employment/directorship/etc.

## Permissions

Keep:

- `provider-subjects:read`
- `provider-subjects:edit`

Rules:

- `provider-subjects:read` can list and read provider-owned Subjects.
- `provider-subjects:edit` can create, update, and archive provider-owned
  Subjects.
- Associations can read Subject metadata through `GET /auth/subject-types`
  because form design needs the catalogue.
- Associations must not read provider Subject values.
- Providers must not read another provider's Subject values.

Backend authorization remains authoritative. Frontend permission checks are for
usability only.

## Form Document Model

The form language should support two design-time item kinds:

- ordinary fields
- subject sections

Rename old `subject-group` to `subject`. Do not keep a compatibility alias.

Recommended form item model:

```ts
export type FormItem =
  | OrdinaryFormItem
  | SubjectFormItem;

export type SubjectFormItem = FormItemBase & {
  type: "subject";
  subjectTypeKey: string;
  repeatable: boolean;
  selectedProperties: SubjectPropertySelection[];
};

export type SubjectSimplePropertySelection = {
  key: string;
};

export type SubjectComplexPropertySelection = {
  key: string;
  columns: readonly SubjectSimplePropertySelection[];
};

export type SubjectPropertySelection =
  | SubjectSimplePropertySelection
  | SubjectComplexPropertySelection;
```

Example:

```json
{
  "id": "person",
  "type": "subject",
  "label": "Person",
  "required": true,
  "subjectTypeKey": "person",
  "repeatable": true,
  "selectedProperties": [
    { "key": "name" },
    { "key": "date_of_birth" },
    {
      "key": "directorships",
      "columns": [
        { "key": "company" },
        { "key": "role" },
        { "key": "date_started" },
        { "key": "date_left" }
      ]
    }
  ]
}
```

`FormValues` must allow the selected Subject shape:

```ts
export type FormScalarValue = string | number | boolean | null;
export type FormSubjectTableRowValue = Record<string, FormScalarValue>;
export type FormValue =
  | FormScalarValue
  | FormSubjectTableRowValue[];
```

Completed forms remain snapshots. Selecting an existing Subject copies selected
property values into form response values. Later edits to the Subject do not
change completed or in-progress form responses.

## Form Designer UX

The designer has two add actions:

- `Add Field`
- `Add Subject`

`Add Field` continues to create ordinary text/date/number/select/etc fields.

`Add Subject` flow:

1. Choose Subject type.
2. Show the metadata properties for that Subject.
3. Let the association select simple properties and complex property sections.
4. If a complex property is selected, show its simple child properties as table
   columns.
5. Expose complex properties from metadata. In the initial metadata, the only
   complex properties are Person directorships, employments, qualifications, and
   memberships.
6. Preview those repeatable complex properties as structured tables with the
   selected child properties as columns.
7. Save a `type: "subject"` form item with `selectedProperties`.

The UX should feel like assembling a questionnaire, not configuring field
mappings.

Remove UI language about mapping ordinary fields to Subject attributes.

## Form Rendering UX

For a `type: "subject"` item, render:

- a top-level section labelled with the Subject label,
- simple selected properties as normal controls,
- metadata-declared complex properties as repeatable structured tables,
- an `Add Person` style button when the Subject item itself is repeatable,
- a `Select Existing Person` action when provider Subject read permission is
  available.

Initial metadata table guidance:

- Directorship columns: company, role, date started, date left.
- Employment columns: employer, role, date started, date left.
- Qualification columns: qualification, grade, issuing body, date awarded.
- Membership columns: association, membership type, status.
- Desktop can use inline editable table rows.
- Mobile should fall back to stacked row editors rather than forcing a wide
  horizontal table.

When selecting an existing Subject:

- Show active Subjects matching `subjectTypeKey`.
- Copy only selected properties into the form value.
- If a repeatable complex property has three entries, copy all three entries.
- Do not attach evidence.
- Do not store autofill provenance in this phase.

## Provider Subject CRUD

Provider Subject screens should remain in `apps/core`.

Routes:

```text
/core/provider/subjects
/core/provider/subjects/new
/core/provider/subjects/:subjectId
```

List screen:

- filter by Subject type,
- search by display name,
- optionally include archived records,
- show type, display name, updated date, archived status.

Detail screen:

- create/edit values from metadata,
- support the initial Person repeatable tables for directorships, employments,
  qualifications, and memberships,
- derive display name from metadata,
- archive with confirmation,
- use explicit save/discard controls.

Do not build separate CRUD screens for directorship, employment,
qualification, or membership. They are edited inside Person.

## Frontend Architecture

Follow the current route ownership:

- `apps/shell` owns global sidebar and remote mounting only.
- `apps/core` owns provider Subject CRUD and provider checklist execution.
- `apps/form-design` owns association form template design.
- `packages/frontend/api` owns shared DTOs and API client calls.
- `packages/shared/subjects` owns metadata, non-recursive value types, validation,
  display-name derivation, and property selection helpers.
- `packages/shared/permissions` owns permission vocabulary.

Keep table/editor components close to the app that uses them first. Promote
only pure metadata helpers when there is real cross-app reuse.
Promote only pure metadata helpers to `packages/shared/subjects`.

## Validation

Shared validation in `packages/shared/subjects` should cover:

- metadata integrity,
- duplicate property keys at each object level,
- invalid display-name property paths,
- non-recursive Subject value normalization,
- property selection validation for simple properties and complex table columns,
- extracting selected simple properties and table rows from Subject values,
- deriving display names.

Backend validation should call shared validators at API boundaries:

- create/update Subject payloads,
- form template creation/update,
- form response save/complete.

Frontend validation should use the same helper types where practical but remain
defensive; backend validation is final.

## Seeding

Rewrite `services/onboarding-service/scripts/src/fixtures/subject-seed-data.json`
and the `subjects` section of
`services/onboarding-service/scripts/src/fixtures/testing-seed-data.json`.

Delete seed records with these old top-level types:

- `employment`
- `directorship`
- `qualification`
- `membership`

Move representative values into seeded `person` records as complex repeatable
properties.

Update `services/onboarding-service/scripts/src/lib/seedFixture.ts` to validate
structured values through `normalizeSubjectValues`.

Update `services/onboarding-service/scripts/src/data-export.ts` to export the
new structured shape. No legacy conversion is needed.

## Documentation

Update:

- `docs/specs/form-designer-spec.md`
- `docs/codex-plans/subjects.md`
- relevant README examples if they mention old Subject types

Remove or rewrite wording that says form fields map to Subject attributes or
that directorship/employment/qualification/membership are separate Subjects.

## Files Expected To Change

Shared model:

- `packages/shared/subjects/src/subjectTypes.ts`
- `packages/shared/subjects/src/validation.ts`
- `packages/shared/subjects/src/index.ts`
- `packages/shared/subjects/src/index.test.ts`

Backend:

- `services/onboarding-service/database/sql/V16__Create_subjects.sql`
- `services/onboarding-service/src/database/onboardingTypes.ts`
- `services/onboarding-service/src/database/subjectRepository.ts`
- `services/onboarding-service/src/controllers/providerController.ts`
- `services/onboarding-service/src/controllers/sharedController.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/services/formTemplateValidation.ts`
- related backend tests in `services/onboarding-service/src/**/*.test.ts`

Seed/export:

- `services/onboarding-service/scripts/src/fixtures/subject-seed-data.json`
- `services/onboarding-service/scripts/src/fixtures/testing-seed-data.json`
- `services/onboarding-service/scripts/src/lib/seedFixture.ts`
- `services/onboarding-service/scripts/src/data-export.ts`

Frontend API:

- `packages/frontend/api/src/onboarding/types.ts`
- `packages/frontend/api/src/onboarding/client.ts`

Form design app:

- `apps/form-design/src/pages/FormTemplateDesigner.tsx`
- `apps/form-design/src/components/FormPreview.tsx`
- `apps/form-design/src/components/PreviewField.tsx`
- `apps/form-design/src/components/ItemEditorDialog.tsx`
- related form-design tests if added during implementation

Core app:

- `apps/core/src/pages/ProviderSubjects.tsx`
- `apps/core/src/pages/ProviderSubjectDetail.tsx`
- `apps/core/src/pages/FormCompletionWorkspace.tsx`
- `apps/core/src/pages/FormCompletionWorkspace.test.tsx`
- `apps/core/src/CoreRouteContent.permissions.test.tsx` if permission fixtures
  change

Docs:

- `docs/specs/form-designer-spec.md`
- `docs/codex-plans/subjects.md`

Remove generated module-federation type files only if they are stale and the
repo treats them as generated artefacts. Otherwise regenerate them through the
normal build flow.

## Implementation Roadmap

### Slice 1: Replace Shared Subject Metadata

Objective: introduce Subject property metadata, remove old top-level
property-like Subject types, and define the first Person structured tables.

Change:

- `packages/shared/subjects/src/subjectTypes.ts`
- `packages/shared/subjects/src/index.ts`
- `packages/shared/subjects/src/index.test.ts`

Work:

- Rename attribute types to property types.
- Add simple and complex property definitions.
- Define `person`, `organisation`, `document`, `property`, `vehicle`, and
  `business_event`.
- Move directorships, employments, qualifications, and memberships under
  `person`.
- Mark directorships, employments, qualifications, and memberships as the only
  complex properties supported by product flows in the first implementation.
- Add metadata integrity tests.

Verification:

- `pnpm --filter @shared/subjects test`
- `pnpm typecheck` if available at repo root

Dependencies: none.

### Slice 2: Fixed-Depth Subject Value Validation

Objective: support scalar values and one-level repeatable Person table values,
without recursive metadata or value types.

Change:

- `packages/shared/subjects/src/validation.ts`
- `packages/shared/subjects/src/index.ts`
- `packages/shared/subjects/src/index.test.ts`

Work:

- Replace scalar-only `SubjectValue`.
- Add metadata-driven normalization for simple properties and repeatable complex
  table rows.
- Add display-name derivation from `displayNameProperty`.
- Add helper to copy selected properties from a Subject, including complete
  table rows for selected complex properties.
- Remove `isSubjectAttributeCompatibleWithFormItem`; the new design no longer
  maps ordinary fields to attributes.

Verification:

- `pnpm --filter @shared/subjects test`

Dependencies: Slice 1.

### Slice 3: Update Backend Subject API Contracts

Objective: make provider Subject CRUD accept fixed-depth metadata-driven values
and derive display names server-side.

Change:

- `services/onboarding-service/src/database/onboardingTypes.ts`
- `services/onboarding-service/src/controllers/providerController.ts`
- `services/onboarding-service/src/services/onboardingService.ts`
- `services/onboarding-service/src/database/subjectRepository.ts`
- `services/onboarding-service/src/controllers/providerController.permissions.test.ts`
- related service tests

Work:

- Update DTO types for scalar values and complex table row arrays.
- Remove `display_name` from request body.
- Derive `display_name` in service layer.
- Validate fixed-depth payloads with shared validators.
- Keep provider scoping and archive semantics.

Verification:

- `pnpm --filter onboarding-service test`

Dependencies: Slice 2.

### Slice 4: Rewrite Subject Database Migration And Seeds

Objective: remove old data shape from local setup.

Change:

- `services/onboarding-service/database/sql/V16__Create_subjects.sql`
- `services/onboarding-service/scripts/src/fixtures/subject-seed-data.json`
- `services/onboarding-service/scripts/src/fixtures/testing-seed-data.json`
- `services/onboarding-service/scripts/src/lib/seedFixture.ts`
- `services/onboarding-service/scripts/src/data-export.ts`

Work:

- Keep the `subject` table but document fixed-depth structured `values_json`.
- Remove old top-level employment/directorship/qualification/membership seed
  records.
- Add structured Person seed examples for directorships, employments,
  qualifications, and memberships.
- Validate fixture values with the fixed-depth metadata validators.
- Update export shape.

Verification:

- Reset local database.
- Run migrations and local seed script.
- Run onboarding-service tests.

Dependencies: Slice 3.

### Slice 5: Replace Form Item Model

Objective: replace old `subject-group` form items with `subject` items that can
select Person simple properties and first-phase structured tables.

Change:

- `services/onboarding-service/src/database/onboardingTypes.ts`
- `packages/frontend/api/src/onboarding/types.ts`
- `services/onboarding-service/src/services/formTemplateValidation.ts`
- `services/onboarding-service/src/services/formTemplateValidation.test.ts`
- any fixtures containing form template schemas

Work:

- Remove `subject-group`.
- Add `subject` form item type with `selectedProperties`.
- Validate selected simple properties and complex table columns against metadata.
- Reject complex properties inside complex properties.
- Update form value types for structured Subject snapshots.
- Delete compatibility parsing for old `subject-group`.

Verification:

- `pnpm --filter onboarding-service test`
- Typecheck frontend packages.

Dependencies: Slice 2.

### Slice 6: Form Designer Subject Selection

Objective: make `Add Subject` create questionnaire-like Subject sections.

Change:

- `apps/form-design/src/pages/FormTemplateDesigner.tsx`
- `apps/form-design/src/components/FormPreview.tsx`
- `apps/form-design/src/components/PreviewField.tsx`
- `apps/form-design/src/components/ItemEditorDialog.tsx`

Work:

- Update metadata loading to use `properties`.
- Build property selection UI for simple Subject properties and
  metadata-declared complex tables.
- Store `selectedProperties`, not `attributeKeys`.
- Preview metadata-declared complex properties as data tables.
- Remove field-to-attribute mapping language.

Verification:

- Run form-design typecheck.
- Start local UI and manually create a form with Person plus directorships and
  qualifications.

Dependencies: Slice 5.

### Slice 7: Provider Subject Structured CRUD

Objective: let providers create and edit Subjects with simple properties and
Person structured tables.

Change:

- `apps/core/src/pages/ProviderSubjects.tsx`
- `apps/core/src/pages/ProviderSubjectDetail.tsx`
- `packages/frontend/api/src/onboarding/types.ts`
- `packages/frontend/api/src/onboarding/client.ts`

Work:

- Update DTOs to fixed-depth structured values and no `display_name` payload.
- Build controls for simple properties.
- Add data-table editors for metadata-declared complex properties.
- Keep list/search/archive behaviour.
- Ensure no separate screens or links exist for employment/directorship/
  qualification/membership.

Verification:

- Run core typecheck/tests.
- Manually create a Person with multiple directorships.

Dependencies: Slices 3 and 6 can run mostly in parallel, but final integration
requires Slice 5.

### Slice 8: Provider Form Rendering And Autofill

Objective: render `type: "subject"` form items and copy selected Person table
values.

Change:

- `apps/core/src/pages/FormCompletionWorkspace.tsx`
- `apps/core/src/pages/FormCompletionWorkspace.test.tsx`
- `packages/frontend/api/src/onboarding/types.ts`

Work:

- Render selected simple properties and first-phase Person structured tables.
- Support repeatable top-level Subject entries.
- Support repeatable Person table rows.
- Copy selected simple and complex values from existing Subjects.
- Preserve form responses as snapshots.
- Update completion validation for required simple values and table row values.

Verification:

- Core tests.
- Manual checklist flow: select an existing Person with three directorships and
  confirm all three appear in the response.

Dependencies: Slices 5 and 7.

### Slice 9: Documentation And Cleanup

Objective: remove stale old-spec language and obsolete code paths.

Change:

- `docs/specs/form-designer-spec.md`
- `README*.md` files only if they mention old Subjects
- stale tests and fixtures found by `rg "subject-group|attributeKeys|Subject Attribute|directorship|employment|qualification|membership"`

Work:

- Update docs to the new model.
- Delete old tests instead of preserving compatibility cases.
- Remove old generated or fixture artefacts that are no longer used.
- Confirm `rg` finds no old-model terminology except in intentional examples
  explaining removed concepts.

Verification:

- Full test suite.
- Full typecheck.
- Local UI smoke test.

Dependencies: all previous slices.

## Implementation Risks

- Complex table values can become hard to reason about if helper functions are
  scattered. Keep fixed-depth metadata helpers in `packages/shared/subjects`.
- Frontend editors can become too generic. Build metadata-driven table editors
  for complex properties instead of recursive form builders.
- Required validation for repeatable complex properties needs a clear rule. For
  this implementation, if a repeatable complex property is required, require at
  least one entry and validate required child properties within each non-empty
  entry.
- Display names for Subjects without a configured value need a deterministic
  fallback such as `Untitled Person`.
- Existing local databases will contain old Subject rows. The supported path is
  reset and reseed, not migration.

## Out Of Scope For First Redesign

- Subject relationships.
- Association-created custom Subject types.
- Evidence attached directly to provider Subjects.
- Audit history for Subject value edits.
- Autofill provenance.
- Cross-provider Subject reuse.
- Migrating old form documents or old Subject records.
- Recursive complex properties in metadata, form designer, provider CRUD, or
  provider runtime.
- Complex properties on Subject types other than `person`.
