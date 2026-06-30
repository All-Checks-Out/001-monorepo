# Data Seeding Project

## Feasibility

Yes, this is realistic.

The project can have a `pnpm run data -- seed <stage>` and `pnpm run data -- reset <stage>` system that:

- Populates the onboarding PostgreSQL database.
- Creates matching Cognito users.
- Assigns users to the correct Cognito groups.
- Uses stage-aware AWS profiles through the root command dispatcher.
- Can derive the seed dataset from a currently deployed database; the initial
  fixture in this project was exported from testing.

The closest working example is:

```text
/Users/richardbray/src/aws10-rekognition-tagging/monorepo
```

Relevant example files:

```text
monorepo/package.json
monorepo/services/photos-service/package.json
monorepo/services/photos-service/scripts/src/init-images.ts
monorepo/services/photos-service/scripts/src/data-reset.ts
monorepo/services/photos-service/scripts/src/lib/database.ts
monorepo/services/photos-service/scripts/src/lib/cognito.ts
monorepo/services/cognito-service/package.json
monorepo/services/cognito-service/scripts/src/data-reset.ts
monorepo/services/cognito-service/scripts/src/lib/cognito.ts
```

That project proves the pattern:

- Root package scripts orchestrate service-level `data:seed` and `data:reset`.
- Service scripts read SSM parameters for deployed resource IDs.
- Scripts connect directly to RDS using the secret ARN from SSM.
- Cognito users are created/reset using AWS SDK calls.
- Database and Cognito operations are kept as explicit scripts, not CDK resources.

## Current ACO003 Shape

The onboarding database has these tables:

```text
corporation
app_user
corporation_application
corporation_access_request
```

Defined in:

```text
services/onboarding-service/database/sql/V1__Create_onboarding_tables.sql
services/onboarding-service/database/sql/V2__Target_corporation_applications_at_providers.sql
```

The current script/database helpers already exist:

```text
services/onboarding-service/scripts/src/lib/onboardingDatabase.ts
services/onboarding-service/scripts/src/lib/ssm.ts
services/onboarding-service/scripts/src/database-migrate.ts
services/onboarding-service/scripts/src/database-show-secret.ts
```

The Cognito reset helper already exists:

```text
services/cognito-service/scripts/src/lib/cognito.ts
```

It currently supports deleting all Cognito users. It should be extended with create/update functions similar to the `aws10` example.

## Recommended Command Design

Keep the project convention that environment commands end in `:local`, `:testing`, `:staging`, or `:production`.

Recommended root scripts:

```json
{
  "data": "bash scripts/root-command.sh data"
}
```

Recommended service scripts:

```json
{
  "data:seed": "tsx scripts/src/data-seed.ts",
  "data:reset": "tsx scripts/src/data-reset.ts",
  "data:export": "tsx scripts/src/data-export.ts"
}
```

The root command should keep the target stage visible because these scripts mutate deployed data. The dispatcher sets `AWS_PROFILE=<stage>`, and the service scripts infer the stage from `AWS_PROFILE` unless a stage argument is passed explicitly.

## Seed Dataset Strategy

The user wants the seed data to be based on the current testing database. That is feasible.

Recommended flow:

1. Add a stage-aware export script:

   ```text
   services/onboarding-service/scripts/src/data-export.ts
   ```

2. Run it under the testing profile:

   ```bash
   pnpm run data -- export testing
   ```

3. It should read:

   ```sql
   SELECT * FROM corporation ORDER BY id;
   SELECT * FROM app_user ORDER BY id;
   SELECT * FROM corporation_application ORDER BY id;
   SELECT * FROM corporation_access_request ORDER BY id;
   ```

4. It should write a deterministic TypeScript or JSON fixture, for example:

   ```text
   services/onboarding-service/scripts/src/fixtures/staging-seed-data.json
   ```

5. Do not preserve raw primary keys blindly unless the seed script also inserts explicit IDs and resets sequences. A safer approach is to seed by natural keys:

   - `corporation.name + corporation.type`
   - `app_user.email`
   - `corporation_application.applicant_email + type + name`
   - access requests by requester/provider corporation names

6. The seed script should map old staging IDs to newly inserted target IDs during import.

## Cognito Strategy

Database `app_user.cognito_sub` must match the Cognito user `sub`, so Cognito creation must happen before or during DB seeding.

Recommended approach:

1. For each seed user email, create or replace the Cognito user.
2. Set email as verified.
3. Put administrator users into the `administrators` group when `app_user.role = 'ADMIN'`.
4. Read the Cognito `sub` using `AdminGetUser`.
5. Insert `app_user` rows using that real `sub`.

This mirrors the `aws10` pattern in:

```text
monorepo/services/photos-service/scripts/src/lib/cognito.ts
```

Useful AWS SDK commands:

- `AdminCreateUserCommand`
- `AdminSetUserPasswordCommand`
- `AdminUpdateUserAttributesCommand`
- `AdminAddUserToGroupCommand`
- `AdminGetUserCommand`
- `AdminDeleteUserCommand`
- `ListUsersCommand`

Because the current Cognito stack has self-registration disabled, use admin APIs rather than sign-up APIs.

Use deterministic passwords from environment variables, not hard-coded secrets. Suggested default for non-production only:

```text
ACO24_SEED_USER_PASSWORD
```

For production, require the variable and fail if absent.

## Reset Strategy

Add:

```text
services/onboarding-service/scripts/src/data-reset.ts
```

Recommended reset order:

1. Delete Cognito seed users only, not necessarily all users.
2. Delete rows from database in FK-safe order:

   ```sql
   DELETE FROM corporation_access_request;
   DELETE FROM corporation_application;
   DELETE FROM app_user;
   DELETE FROM corporation;
   ```

3. Optionally reset sequences:

   ```sql
   ALTER SEQUENCE corporation_id_seq RESTART WITH 1;
   ALTER SEQUENCE app_user_id_seq RESTART WITH 1;
   ALTER SEQUENCE corporation_application_id_seq RESTART WITH 1;
   ALTER SEQUENCE corporation_access_request_id_seq RESTART WITH 1;
   ```

4. Prefer deleting only seeded records if production safety matters.

For early testing, a full reset is fine for testing. For production, make the command require an explicit guard:

```bash
ACO24_CONFIRM_PRODUCTION_DATA_RESET=yes pnpm run data -- reset production
```

## Important Safety Notes

- Do not run staging commands unless explicitly requested. The user currently wants staging left alone.
- Do not make seeding part of CDK deployment. Keep it an explicit `pnpm run data -- seed <stage>` command.
- Do not write a custom CDK resource for seeding.
- Keep all stage commands profile-safe by routing them through the root dispatcher.
- Production data reset should require a confirmation environment variable.
- Staging export should be read-only.

## Proposed Implementation Steps For Next Agent

1. Add `services/onboarding-service/scripts/src/lib/cognitoSeed.ts`.
   - Create/update users.
   - Set permanent password.
   - Verify email.
   - Add admins to `administrators`.
   - Return Cognito `sub`.

2. Add `services/onboarding-service/scripts/src/data-export.ts`.
   - Connect using existing `createDbClient`.
   - Export staging tables to JSON.
   - Convert FK IDs into stable names/emails where possible.

3. Run export from staging only after user approval:

   ```bash
   pnpm run data -- export staging
   ```

4. Review generated fixture with the user before using it for production.

5. Add `services/onboarding-service/scripts/src/data-seed.ts`.
   - Run migrations first or require migrations already complete.
   - Create Cognito users and capture `sub`.
   - Insert corporations.
   - Insert app users.
   - Insert corporation applications.
   - Insert access requests.
   - Use transactions for database inserts.

6. Add `services/onboarding-service/scripts/src/data-reset.ts`.
   - Delete seeded Cognito users.
   - Delete seeded DB rows.
   - Guard production reset.

7. Update package scripts at root and service level.

8. Verify in testing first:

   ```bash
   pnpm run data -- reset testing
   pnpm run data -- seed testing
   pnpm run backend -- dev testing
   pnpm run app -- shell dev testing
   ```

9. Only after testing is verified, seed production:

   ```bash
   pnpm run data -- seed production
   ```

## Overall Recommendation

Proceed with this project. It is a good fit for the current architecture and the existing `aws10` pattern.

The best source of truth for the current fixture is the testing database, but export it into a reviewed fixture first. Do not make the seed script reach into one environment at runtime when seeding another; that couples environments too tightly. Use testing to generate the fixture, then use the fixture as the explicit seed input.
