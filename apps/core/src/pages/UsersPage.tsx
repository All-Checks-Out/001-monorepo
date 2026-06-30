import {
  getMyUsers,
  inviteMyUser,
  updateMyCorporationUserPermissions,
} from "@frontend/api/onboarding/client";
import type { AppUser } from "@frontend/api/onboarding/types";
import {
  PERMISSIONS_BY_CORPORATION_TYPE,
  type Permission,
} from "@shared/permissions";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Checkbox } from "@frontend/shadcn/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@frontend/shadcn/components/ui/dialog";
import { Input } from "@frontend/shadcn/components/ui/input";
import { Eye, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import Page from "../components/Page";
import SimpleTable from "../tables/SimpleTable";
import Status from "../components/Status";
import StatusBadge from "../components/StatusBadge";
import { useCurrentUser } from "../context/CurrentUserContext";

const UsersPage = () => {
  const {
    user: currentUser,
    corporationType: currentCorporationType,
    hasPermission,
  } = useCurrentUser();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [dialogUser, setDialogUser] = useState<AppUser | null>(null);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  async function load() {
    const result = await getMyUsers();
    setUsers(result.users);
  }

  useEffect(() => {
    async function loadUsers() {
      try {
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load users.");
      }
    }

    void loadUsers();
  }, []);

  async function invite() {
    setLoading(true);
    setMessage("");
    setError("");
  try {
      await inviteMyUser(inviteEmail.trim());
      setInviteEmail("");
      setMessage("User invited.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invite user.");
    } finally {
      setLoading(false);
    }
  }

  const permissionOptions = currentCorporationType
    ? [...PERMISSIONS_BY_CORPORATION_TYPE[currentCorporationType]]
    : [];

  function effectivePermissions(user: AppUser) {
    return user.permissions.filter((permission) =>
      permissionOptions.includes(permission),
    );
  }

  function openPermissionsDialog(user: AppUser, mode: "view" | "edit") {
    setDialogUser(user);
    setDialogMode(mode);
    setSelectedPermissions(effectivePermissions(user));
  }

  function togglePermission(permission: Permission, checked: boolean) {
    setSelectedPermissions((current) => {
      if (checked) {
        return current.includes(permission) ? current : [...current, permission];
      }

      return current.filter((value) => value !== permission);
    });
  }

  async function savePermissions() {
    if (!dialogUser) return;

    setSavingPermissions(true);
    setMessage("");
    setError("");
    try {
      await updateMyCorporationUserPermissions(dialogUser.id, selectedPermissions);
      setMessage("Permissions updated.");
      setDialogUser(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update permissions.");
    } finally {
      setSavingPermissions(false);
    }
  }

  function permissionsCell(user: AppUser) {
    const canEdit =
      hasPermission("user-permissions:change")
      && user.id !== currentUser?.id;

    return (
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={`View permissions for ${user.email}`}
          title="View permissions"
          onClick={() => openPermissionsDialog(user, "view")}
        >
          <Eye className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          disabled={!canEdit}
          aria-label={`Edit permissions for ${user.email}`}
          title={
            user.id === currentUser?.id
              ? "You cannot edit your own permissions"
              : "Edit permissions"
          }
          onClick={() => openPermissionsDialog(user, "edit")}
        >
          <Pencil className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Page title="Users">
      <SimpleTable
        headers={["Email", "Status", "Permissions"]}
        rows={users.map((user) => ({
          id: user.id,
          values: [
            user.email,
            <StatusBadge status={user.status} />,
            permissionsCell(user),
          ],
        }))}
        empty="No users."
      />
      {hasPermission("users:invite") && (
        <div className="grid max-w-xl gap-3 border-t pt-6">
          <h2 className="text-lg font-semibold">Invite user</h2>
          <Input
            type="email"
            value={inviteEmail}
            disabled={loading}
            placeholder="name@example.com"
            onChange={(event) => setInviteEmail(event.target.value)}
          />
          <Button
            className="w-fit"
            type="button"
            disabled={loading || !inviteEmail.trim()}
            onClick={invite}
          >
            Invite
          </Button>
        </div>
      )}
      <Dialog open={Boolean(dialogUser)} onOpenChange={(open) => !open && setDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Permissions for {dialogUser?.email}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {permissionOptions.map((permission) => (
              <label
                key={permission}
                className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={selectedPermissions.includes(permission)}
                  disabled={dialogMode === "view"}
                  onCheckedChange={(checked) =>
                    togglePermission(permission, checked === true)
                  }
                />
                <span>{permission}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            {dialogMode === "edit" ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingPermissions}
                  onClick={() => setDialogUser(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={savingPermissions}
                  onClick={savePermissions}
                >
                  Confirm
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => setDialogUser(null)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Status message={message} error={error} />
    </Page>
  );
};

export default UsersPage;
