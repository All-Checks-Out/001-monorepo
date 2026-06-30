import type {
  AppUserWithCorporation,
  Corporation,
} from "@frontend/api/onboarding/types";
import {
  PERMISSIONS_BY_CORPORATION_TYPE,
  type Permission,
} from "@shared/permissions";
import {
  inviteMyUser,
  listAssociationUsers,
  listCorporations,
} from "@frontend/api/onboarding/client";
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
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataTable from "@frontend/app-ui/data-display/AppDataTable";
import Page from "../components/Page";
import SimpleTable from "../tables/SimpleTable";
import Status from "../components/Status";
import { useCurrentUser } from "../context/CurrentUserContext";
import { displayCorporationType } from "../utils/corporationDisplay";
import { getEffectivePermissions } from "../utils/permissions";

type CorporationTableRow = {
  id: number;
  name: string;
  type: string;
  users: number;
};

type CorporationUserCounts = Pick<CorporationTableRow, "users">;

const emptyUserCounts: CorporationUserCounts = {
  users: 0,
};

const corporationColumns: ColumnDef<CorporationTableRow>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "users",
    header: "Users",
  },
];

function countUsersByCorporation(users: AppUserWithCorporation[]) {
  return users.reduce<Map<number, CorporationUserCounts>>((counts, user) => {
    const current = counts.get(user.corporation_id) ?? { ...emptyUserCounts };
    current.users += 1;

    counts.set(user.corporation_id, current);
    return counts;
  }, new Map());
}

const AssociationSystemData = () => {
  const { hasPermission } = useCurrentUser();
  const [corporations, setCorporations] = useState<Corporation[]>([]);
  const [users, setUsers] = useState<AppUserWithCorporation[]>([]);
  const [permissionsUser, setPermissionsUser] =
    useState<AppUserWithCorporation | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    const [corporationResult, userResult] = await Promise.all([
      listCorporations(),
      listAssociationUsers(),
    ]);
    setCorporations(corporationResult.corporations);
    setUsers(userResult.users);
  }

  useEffect(() => {
    async function loadSystemData() {
      try {
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load system data.",
        );
      }
    }

    void loadSystemData();
  }, []);

  async function inviteAssociationStaff() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await inviteMyUser(inviteEmail.trim());
      setInviteEmail("");
      setMessage("Association staff invitation sent.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not invite association staff.",
      );
    } finally {
      setLoading(false);
    }
  }

  function openPermissionsDialog(user: AppUserWithCorporation) {
    setPermissionsUser(user);
    setSelectedPermissions(
      getEffectivePermissions({
        user,
        corporationType: user.corporation_type,
      }),
    );
  }

  function permissionsCell(user: AppUserWithCorporation) {
    return (
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        aria-label={`View permissions for ${user.email}`}
        title="View permissions"
        onClick={() => openPermissionsDialog(user)}
      >
        <Eye className="size-3.5" />
      </Button>
    );
  }

  const corporationRows = useMemo<CorporationTableRow[]>(
    () => {
      const userCountsByCorporation = countUsersByCorporation(users);

      return corporations.map((corporation) => {
        const counts =
          userCountsByCorporation.get(corporation.id) ?? emptyUserCounts;
        return {
          id: corporation.id,
          name: corporation.name,
          type: displayCorporationType(corporation.type),
          users: counts.users,
        };
      });
    },
    [corporations, users],
  );
  const permissionOptions = permissionsUser
    ? [...PERMISSIONS_BY_CORPORATION_TYPE[permissionsUser.corporation_type]]
    : [];

  return (
    <Page title="System Data">
      <h2 className="text-lg font-semibold">Corporations</h2>
      <DataTable
        columns={corporationColumns}
        data={corporationRows}
        empty="No corporations."
        filters={[
          {
            column: "name",
            label: "Search corporation name",
            placeholder: "Search name",
            className: "sm:w-72",
          },
          {
            column: "type",
            type: "select",
            label: "Filter corporation type",
            allLabel: "All types",
            className: "sm:w-44",
            options: [
              { label: "Association", value: "Association" },
              { label: "Provider", value: "Provider" },
              { label: "Agency", value: "Agency" },
              { label: "Stakeholder", value: "Stakeholder" },
            ],
          },
        ]}
      />
      <h2 className="text-lg font-semibold">Users</h2>
      {hasPermission("users:invite") && (
        <div className="flex max-w-xl flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            value={inviteEmail}
            disabled={loading}
            placeholder="staff@example.com"
            onChange={(event) => setInviteEmail(event.target.value)}
          />
          <Button
            className="w-fit"
            type="button"
            disabled={loading || !inviteEmail.trim()}
            onClick={inviteAssociationStaff}
          >
            Invite
          </Button>
        </div>
      )}
      <SimpleTable
        headers={[
          "Email address",
          "Corporation",
          "Corporation type",
          "Permissions",
        ]}
        rows={users.map((user) => ({
          id: user.id,
          values: [
            user.email,
            user.corporation_name,
            displayCorporationType(user.corporation_type),
            permissionsCell(user),
          ],
        }))}
        empty="No users."
      />
      <Dialog
        open={Boolean(permissionsUser)}
        onOpenChange={(open) => !open && setPermissionsUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Permissions for {permissionsUser?.email}
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
                  disabled
                />
                <span>{permission}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setPermissionsUser(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Status message={message} error={error} />
    </Page>
  );
};

export default AssociationSystemData;
