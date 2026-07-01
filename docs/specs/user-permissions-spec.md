# User Permissions Implementation Spec

## Goal

Use explicit, scope-aware permissions as the authorization model for application
users.

A user's capabilities are determined by `app_user.permissions`. The user's
corporation type determines which permission strings are valid.

Permissions belong to users, not corporations. Shared own-corporation
permissions are intentionally named with `own-` scope, for example:

```text
own-users:read
own-users:invite
own-user-permissions:change
```

System-wide permissions are intentionally named with `all-` scope, for example:

```text
all-corporations:read
all-users:read
```

Users with `own-user-permissions:change` may change permissions for other users
in their own corporation. They must not change their own permissions.

## Permission Sets

Association permissions:

```ts
[
  "association-provider-requests:read",
  "association-provider-requests:approve",
  "all-corporations:read",
  "all-users:read",
  "own-users:read",
  "own-users:invite",
  "own-user-permissions:change",
  "association-ddq-packs:read",
  "association-ddq-packs:edit",
  "association-forms:read",
  "association-forms:edit",
]
```

Provider permissions:

```ts
[
  "provider-agent-requests:read",
  "provider-agent-requests:approve",
  "provider-stakeholder-requests:read",
  "provider-stakeholder-requests:approve",
  "own-users:read",
  "own-users:invite",
  "own-user-permissions:change",
  "provider-ddq-packs:add-new",
  "provider-ddq-packs:perform-checks",
  "provider-ddq-packs:review-checks",
  "provider-ddq-packs:approve-checks",
]
```

Agent permissions:

```ts
[
  "own-users:read",
  "own-users:invite",
  "own-user-permissions:change",
]
```

Stakeholder permissions:

```ts
[
  "own-users:read",
  "own-users:invite",
  "own-user-permissions:change",
]
```

## Data Model

`app_user.permissions` is the authoritative authorization data.

```sql
ALTER TABLE app_user
ADD COLUMN permissions TEXT[] NOT NULL DEFAULT '{}';
```

Permissions are the only user authorization state on `app_user`.

Creation expectations:

- Newly invited users default to no permissions.
- Root setup and first approved corporation users receive every valid
  permission for their corporation type, including
  `own-user-permissions:change`.

## Runtime Validation

Permission helpers live in `@shared/permissions`.

They enforce these rules:

- A permission is valid only if it appears in the list for the user's
  corporation type.
- Invalid or stale permission strings from the database must not grant access.
- Updating permissions must reject values outside the target user's corporation
  type.
- `getEffectivePermissions(context)` returns stored permissions that are valid
  for `context.corporationType`.
- `hasPermission(context, permission)` checks the current user's effective
  permissions only.
- A permission check for the wrong corporation type fails. For example, a
  Provider user must not pass
  `hasPermission(context, "all-users:read")`.

The shared permission context accepts nullable frontend loading state:

```ts
type PermissionContext = {
  user: { permissions: readonly Permission[] } | null;
  corporationType: CorporationType | null;
};
```

## User Management

Routes:

- `GET /auth/my-users` requires `own-users:read`.
- `POST /auth/my-users/invites` requires `own-users:invite`.
- `PUT /auth/my-users/:id/permissions` requires
  `own-user-permissions:change`.

Permission update rules:

- The target user must belong to the same corporation as the current user.
- The target user must not be the current user.
- Every submitted permission must be valid for the target user's corporation
  type.
- The response returns the updated user with stored permissions.

Invites should create a user with an empty permission list. A permission manager
may grant permissions after invite.

## Backend Authorization Rollout

Backend authorization remains required even when the frontend hides navigation
or actions. Frontend checks improve user experience but must not be the only
enforcement.

Route mapping:

- Association provider application/request list pages:
  `association-provider-requests:read`
- Association provider approval/rejection actions:
  `association-provider-requests:approve`
- Association corporation listing:
  `all-corporations:read`
- Association system-wide user listing:
  `all-users:read`
- Association DDQ pack read/list routes:
  `association-ddq-packs:read`
- Association DDQ pack create/update/delete/status/item edit routes:
  `association-ddq-packs:edit`
- Association form read/list routes:
  `association-forms:read`
- Association form create/update/delete routes:
  `association-forms:edit`
- Provider agent request list:
  `provider-agent-requests:read`
- Provider agent approve/reject:
  `provider-agent-requests:approve`
- Provider stakeholder request list:
  `provider-stakeholder-requests:read`
- Provider stakeholder approve/reject:
  `provider-stakeholder-requests:approve`
- Own corporation user listing:
  `own-users:read`
- Own corporation user invite:
  `own-users:invite`
- Own corporation user permission updates:
  `own-user-permissions:change`
- Provider DDQ add-new flow:
  `provider-ddq-packs:add-new`
- Provider DDQ check workflows:
  `provider-ddq-packs:perform-checks`,
  `provider-ddq-packs:review-checks`,
  `provider-ddq-packs:approve-checks`

Provider request routes need particular care because some endpoints can contain
both Agent and Stakeholder data:

- Mixed list responses must filter rows by the current user's effective read
  permissions.
- Approve/reject actions must load the target row first, inspect its type, and
  require the matching approve permission.

## Frontend Permission Visibility

The core app should hide or disable navigation entries and row actions that the
current user cannot perform.

Route-level UI gates should check both corporation type and permission where
both are relevant. This matters for shared own-corporation permissions such as
`own-users:read`.

`apps/core` uses `PermissionRequired` with this policy shape:

```tsx
<PermissionRequired
  corporationTypes={["PROVIDER"]}
  permissions={{
    anyOf: [
      "provider-agent-requests:read",
      "provider-stakeholder-requests:read",
    ],
  }}
>
```

Recommended visibility rules:

- Hide Users navigation/list access without `own-users:read` for the relevant
  corporation type.
- Hide invite controls without `own-users:invite`.
- Enable permission editing only with `own-user-permissions:change` and never
  for the current user's own row.
- Hide Association provider request pages/actions without
  `association-provider-requests:read` or
  `association-provider-requests:approve`.
- Hide Association system data unless the user has both
  `all-corporations:read` and `all-users:read`.
- Hide Association DDQ pages/actions without `association-ddq-packs:read` or
  `association-ddq-packs:edit`.
- For Provider mixed Agent/Stakeholder request pages, filter visible rows and
  actions by permission.

## Tests And Verification

Backend verification should include:

- User listing returns permissions.
- Updating permissions succeeds for a user with
  `own-user-permissions:change` updating another user in the same corporation.
- Updating permissions fails without `own-user-permissions:change`.
- Updating permissions fails for the current user's own row.
- Updating permissions fails for a user in another corporation.
- Updating permissions rejects values outside the target corporation type's
  allowed list.
- `hasPermission` grants only stored valid permissions.
- Provider mixed Agent/Stakeholder list and approve/reject routes enforce
  type-aware permissions.
- Protected controller/service operations are covered by permission matrix
  tests for Association, Provider, Agent, and Stakeholder users, with both
  allowed and disallowed permission sets.

Frontend verification should include:

- `PermissionRequired` covers single permission, any-of permission, all-of
  permission, corporation-type, and corporation-only gates.
- Protected routes are covered by matrix tests for Association, Provider, Agent,
  and Stakeholder users, with both allowed and disallowed permission sets.
- Users table shows permission controls.
- View dialog opens and is read-only.
- Edit dialog opens only when the current user has
  `own-user-permissions:change` and the target is not the current user.
- Confirm updates permissions and refreshes the row.
