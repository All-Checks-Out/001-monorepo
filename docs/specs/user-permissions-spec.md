# User Permissions Implementation Spec

## Goal

Use explicit, corporation-type-specific permissions as the sole authorization model for application users.

A user's capabilities are determined only by `app_user.permissions`, and a corporation's type determines which permission strings are valid for that user.

Permissions belong to users, not corporations. The permission that allows a user to manage other users' permissions is:

```text
user-permissions:change
```

Users with `user-permissions:change` may change permissions for other users in their own corporation. They must not change their own permissions.

## Permission Sets

Association permissions:

```ts
[
  "provider-requests:read",
  "provider-requests:approve",
  "system-data:read",
  "users:read",
  "users:invite",
  "user-permissions:change",
  "ddq-packs:read",
  "ddq-packs:edit",
  "forms:read",
  "forms:edit",
]
```

Provider permissions:

```ts
[
  "agent-requests:read",
  "agent-requests:approve",
  "stakeholder-requests:read",
  "stakeholder-requests:approve",
  "users:read",
  "users:invite",
  "user-permissions:change",
  "ddq-packs:add-new",
  "ddq-packs:perform-checks",
  "ddq-packs:review-checks",
  "ddq-packs:approve-checks",
]
```

Agent permissions:

```ts
[
  "users:read",
  "users:invite",
  "user-permissions:change",
]
```

Stakeholder permissions:

```ts
[
  "users:read",
  "users:invite",
  "user-permissions:change",
]
```

## Data Model

`app_user.permissions` is the authoritative authorization data.

```sql
ALTER TABLE app_user
ADD COLUMN permissions TEXT[] NOT NULL DEFAULT '{}';
```

Permissions are the only user authorization state on `app_user`.

Migration expectations:

- Newly invited users default to no permissions.
- Root setup and first approved corporation users receive every valid permission for their corporation type, including `user-permissions:change`.

## Runtime Validation

Permission helpers should enforce these rules:

- A permission is valid only if it appears in the list for the user's corporation type.
- Invalid or stale permission strings from the database must not grant access.
- Updating permissions must reject values outside the target user's corporation type.
- `hasPermission(context, permission)` should check the current user's stored effective permissions only.
- A permission check for the wrong corporation type fails. For example, a Provider user must not pass `hasPermission(context, "system-data:read")`.

## User Management

Routes:

- `GET /auth/my-users` requires `users:read`.
- `POST /auth/my-users/invites` requires `users:invite`.
- `PUT /auth/my-users/:id/permissions` requires `user-permissions:change`.

Permission update rules:

- The target user must belong to the same corporation as the current user.
- The target user must not be the current user.
- Every submitted permission must be valid for the target user's corporation type.
- The response returns the updated user with stored permissions.

Invites should create a user with an empty permission list. A permission manager may grant permissions after invite.

## Backend Authorization Rollout

Backend authorization remains required even when the frontend hides navigation or actions. Frontend checks improve user experience but must not be the only enforcement.

Recommended route mapping:

- Association provider application/request list pages: `provider-requests:read`
- Association provider approval/rejection actions: `provider-requests:approve`
- Association system data pages: `system-data:read`
- Association DDQ pack read/list routes: `ddq-packs:read`
- Association DDQ pack create/update/delete/status/item edit routes: `ddq-packs:edit`
- Association form read/list routes: `forms:read`
- Association form create/update/delete routes: `forms:edit`
- Provider agent request list: `agent-requests:read`
- Provider agent approve/reject: `agent-requests:approve`
- Provider stakeholder request list: `stakeholder-requests:read`
- Provider stakeholder approve/reject: `stakeholder-requests:approve`
- User listing page/API: `users:read`
- User invite API: `users:invite`
- User permission updates: `user-permissions:change`
- Provider DDQ add-new flow: `ddq-packs:add-new`
- Provider DDQ check workflows: `ddq-packs:perform-checks`, `ddq-packs:review-checks`, `ddq-packs:approve-checks`

Provider request routes need particular care because some endpoints can contain both Agent and Stakeholder data:

- Mixed list responses must filter rows by the current user's effective read permissions.
- Approve/reject actions must load the target row first, inspect its type, and require the matching approve permission.

## Frontend Permission Visibility

The core app should hide or disable navigation entries and row actions that the current user cannot perform.

Recommended visibility rules:

- Hide Users navigation/list access without `users:read`.
- Hide invite controls without `users:invite`.
- Enable permission editing only with `user-permissions:change` and never for the current user's own row.
- Hide Association provider request pages/actions without `provider-requests:read` or `provider-requests:approve`.
- Hide Association system data pages without `system-data:read`.
- Hide Association DDQ pages/actions without `ddq-packs:read` or `ddq-packs:edit`.
- For Provider mixed Agent/Stakeholder request pages, filter visible rows/actions by permission.

## Tests And Verification

Backend verification should include:

- Role removal migration applies cleanly and backfills legacy admins.
- User listing returns permissions.
- Updating permissions succeeds for a user with `user-permissions:change` updating another user in the same corporation.
- Updating permissions fails without `user-permissions:change`.
- Updating permissions fails for the current user's own row.
- Updating permissions fails for a user in another corporation.
- Updating permissions rejects values outside the target corporation type's allowed list.
- `hasPermission` grants only stored valid permissions.
- Provider mixed Agent/Stakeholder list and approve/reject routes enforce type-aware permissions.

Frontend verification should include:

- Users table shows permissions controls.
- View dialog opens and is read-only.
- Edit dialog opens only when the current user has `user-permissions:change` and the target is not the current user.
- Confirm updates permissions and refreshes the row.
