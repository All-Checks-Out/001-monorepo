# All Checks Out

# Permission Audit and Test Harness Specification

Author: Richard Bray

Status: Working Specification

---

# 1. Objective

The objective of this exercise is **not simply to add tests**.

The objective is to gain confidence that every operation within the application is protected by the correct permissions.

There are therefore two separate problems.

1. Verify that existing permission checks work correctly.

2. Find places where permission checks should exist but have never been implemented.

The second problem is considered the more important.

A missing permission check represents a security defect.

The completed work should provide confidence that:

- backend operations cannot be performed without the correct permission
- frontend functionality is only presented to users with the correct permission
- missing permission checks have been identified
- missing permission checks have been implemented
- implemented permission checks have automated tests

---

# 2. Scope

This specification applies only to permission checking.

It does not currently include:

- authentication
- database integration tests
- end-to-end browser testing
- performance testing
- load testing

Those may be added later.

---

# 3. Technologies

Use only the following technologies.

## Backend

- Vitest
- Vitest built-in mocking (`vi`)

## Frontend

- Vitest
- React Testing Library
- jsdom
- Vitest built-in mocking (`vi`)

Do not introduce:

- Playwright
- Jest
- Enzyme
- Sinon
- Property-based testing
- Random sampling
- Test generation frameworks

Keep the solution small and easy to understand.

---

# 4. Test Location

Keep unit tests immediately beside the production code.

Example:

```
services/onboarding-service/src/services/
    currentUser.ts
    currentUser.test.ts
```

```
services/onboarding-service/src/routes/
    applications.ts
    applications.test.ts
```

```
ui/core/src/components/
    PermissionRequired.tsx
    PermissionRequired.test.tsx
```

```
ui/core/src/pages/
    CorporationUsersPage.tsx
    CorporationUsersPage.test.tsx
```

Do not create a large central test directory.

The test file should normally use the same filename as the production file with

```
.test.ts
```

or

```
.test.tsx
```

added.

---

# 5. Permission Test Users

Create eight representative users.

Association

- Allowed User
- Disallowed User

Provider

- Allowed User
- Disallowed User

Agent

- Allowed User
- Disallowed User

Stakeholder

- Allowed User
- Disallowed User

For every corporation type:

The Allowed User possesses the permission currently under test.

The Disallowed User does not.

These users exist purely to simplify permission testing.

---

# 6. Overall Strategy

The work should be completed in the following order.

Step 0
Permission Audit

Step 1
Implement missing backend permission checks

Step 2
Add backend permission tests

Step 3
Implement missing frontend permission checks

Step 4
Add frontend permission tests

Each step should be completed and committed before moving to the next.

---

# Step 0

Permission Audit

This is the most important step.

Before writing any tests, inspect the entire codebase.

The objective is to identify every place where a permission check should exist.

This includes:

Backend

- routes
- service methods
- command handlers
- update operations
- delete operations
- create operations
- approval operations
- invitation operations

Frontend

- pages
- routes
- menus
- navigation items
- buttons
- actions
- dialogs
- toolbar commands

For every operation determine:

- Should this operation require authentication?
- Should this operation require a permission?
- Which permission?
- Is the permission currently enforced?
- If not, record it.

Produce a report similar to:

| Location         | Operation           | Required Permission  | Status  |
| ---------------- | ------------------- | -------------------- | ------- |
| applications.ts  | approve application | applications:approve | OK      |
| users.ts         | delete user         | users:delete         | MISSING |
| Provider menu    | View Users          | own-users:read       | OK      |
| Association page | Edit Corporation    | corporation:update   | MISSING |

Do not modify code during this step.

Only produce the report.

---

# Step 1

Implement Missing Backend Permission Checks

Using the audit report:

Implement every missing backend permission check.

The backend is the security boundary.

Every operation capable of:

- reading protected information
- creating information
- modifying information
- deleting information
- approving information

must verify permission.

Keep the implementation consistent with the existing project.

Do not write tests yet.

---

# Step 2

Backend Permission Tests

For every backend permission check:

Create a corresponding Vitest.

Use

- vi.mock()
- vi.fn()
- vi.spyOn()

where appropriate.

For every permission:

Execute the operation twice.

First using the Allowed User.

Second using the Disallowed User.

Verify

Allowed User

- operation succeeds

Disallowed User

- operation is rejected

The backend tests should prove that every backend permission gate behaves correctly.

---

# Step 3

Implement Missing Frontend Permission Checks

Return to the audit report.

Inspect every frontend page.

Inspect every menu.

Inspect every button.

Inspect every action.

Determine whether it should be permission protected.

If protection is missing:

Implement it.

Use the existing project conventions.

Do not add unnecessary abstractions.

---

# Step 4

Frontend Permission Tests

Create React Testing Library tests.

For every protected component:

Render twice.

Allowed User

Verify

- page visible
- button visible
- action enabled

Disallowed User

Verify

- page hidden
- button hidden or disabled
- access denied message displayed where appropriate

Mock the current user.

Do not require real authentication.

---

# 7. General Principles

Prefer readability over cleverness.

Prefer duplication over excessive abstraction.

Keep each test focused on one behaviour.

Avoid helper methods unless they genuinely improve readability.

Avoid introducing new technologies.

Keep tests beside production code.

---

# 8. Working Method

For every implementation session:

1. Read this entire document.
2. Understand the overall objective.
3. Execute one step only.
4. Keep changes small.
5. Run all tests.
6. Produce a summary.
7. Wait for review before beginning the next step.

Never attempt multiple steps in a single implementation.

---

# 9. Success Criteria

The project will be considered successful when:

- Every backend operation requiring permission has been identified.
- Every frontend operation requiring permission has been identified.
- Missing permission checks have been implemented.
- Backend permission checks have automated tests.
- Frontend permission checks have automated tests.
- Tests are easy to understand.
- Tests remain beside the code they verify.
- The implementation remains simple enough that a new developer can understand it within a short time.
