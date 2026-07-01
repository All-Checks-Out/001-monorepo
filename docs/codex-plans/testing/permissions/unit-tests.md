Permissions Test Harness Plan

Goal

Create a simple automated permission test harness for the All Checks Out system.

The objectives are:

- Learn the testing technologies.
- Verify that backend permissions are enforced correctly.
- Verify that frontend permissions are enforced correctly.
- Keep the implementation small, readable and easy to maintain.

Use only:

- Vitest
- Vitest built-in mocking (vi)
- React Testing Library
- jsdom

Do not use:

- Playwright
- Jest
- Enzyme
- Sinon
- Property-based testing
- Random sampling
- Generated/shared test frameworks

The first objective is education and confidence, not building a sophisticated enterprise test framework.

⸻

Test Users

Create eight representative test users.

- Association Allowed User
- Association Disallowed User
- Provider Allowed User
- Provider Disallowed User
- Agent Allowed User
- Agent Disallowed User
- Stakeholder Allowed User
- Stakeholder Disallowed User

For each corporation type:

- the Allowed User should possess the permission being tested
- the Disallowed User should not possess the permission being tested

Every test should be executed against every defined test user.

Do not randomly select examples.

⸻

Test Locations

Keep unit tests beside the production code they test.

Examples:

services/onboarding-service/src/services/
currentUser.ts
currentUser.test.ts
services/onboarding-service/src/routes/
applications.ts
applications.test.ts
ui/core/src/components/
PermissionRequired.tsx
PermissionRequired.test.tsx
ui/core/src/pages/
SystemDataPage.tsx
SystemDataPage.test.tsx

The test file should normally have the same filename as the production file with:

- .test.ts
- .test.tsx

added to the name.

This approach makes the tests easy to discover and easy to maintain.

It also makes it easier for AI coding assistants to update the tests when production code changes.

⸻

Step 1 — Backend Permission Tests

Use:

- Vitest
- built-in vi mocking

Test the backend permission enforcement code.

For every test user:

- mock the authenticated user
- mock database/user lookup dependencies
- call the backend permission function
- verify that allowed users are granted access
- verify that disallowed users are denied access

Acceptance criteria:

- Uses Vitest only.
- Uses vi.fn, vi.mock or vi.spyOn.
- Every test user is exercised.
- Both allowed and denied cases are tested.
- No real database is required.

⸻

Step 2 — Frontend Permission Tests

Use:

- Vitest
- React Testing Library
- jsdom
- built-in vi mocking

Test the frontend permission-aware components.

For every test user:

- mock the current-user hook/context
- render the protected component
- verify that allowed users can see protected content
- verify that disallowed users cannot
- verify that any expected “access denied” message is displayed

Acceptance criteria:

- Uses Vitest.
- Uses React Testing Library.
- Uses mocked current-user state.
- Every test user is exercised.
- Both allowed and denied cases are tested.

⸻

Step 3 — Run and Maintain

Add clear package scripts.

Suggested scripts:

pnpm test
pnpm test:backend
pnpm test:frontend

Acceptance criteria:

- Backend tests pass.
- Frontend tests pass.
- Test commands are easy to discover.
- The overall implementation remains small, readable and easy to extend.
