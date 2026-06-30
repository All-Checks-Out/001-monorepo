import { type AppUserWithCorporation } from "@frontend/api/onboarding/types";
import { listLocalDevUsers } from "@frontend/api/onboarding/client";
import { useAuth } from "@frontend/auth/session/AuthProvider";
import { Button } from "@frontend/shadcn/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@frontend/shadcn/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn/components/ui/select";
import { useEffect, useState } from "react";

interface LocalLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LocalLoginDialog = ({
  open,
  onOpenChange,
}: LocalLoginDialogProps) => {
  const { selectLocalUser } = useAuth();
  const [users, setUsers] = useState<AppUserWithCorporation[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    async function loadUsers() {
      const result = await listLocalDevUsers();
      setUsers(result.users);
      setSelectedUserId(result.users[0]?.id ? String(result.users[0].id) : "");
      setLoading(false);
    }

    void loadUsers();
  }, [open]);

  function continueAsSelectedUser() {
    const selectedUser = users.find((user) => String(user.id) === selectedUserId);
    if (!selectedUser) return;

    selectLocalUser({
      sub: selectedUser.cognito_sub,
      email: selectedUser.email,
      emailVerified: true,
      localUserId: selectedUser.id,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select a seeded user</DialogTitle>
          <DialogDescription>
            Local development uses seeded users instead of Cognito.
          </DialogDescription>
        </DialogHeader>

        <Select
          value={selectedUserId}
          onValueChange={setSelectedUserId}
          disabled={loading || users.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading users..." : "Choose a user"} />
          </SelectTrigger>
          <SelectContent>
            {users.map((user) => (
              <SelectItem key={user.id} value={String(user.id)}>
                {user.email} | {user.corporation_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!loading && users.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No local users are seeded yet. Run pnpm run start:local.
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            disabled={!selectedUserId}
            onClick={continueAsSelectedUser}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
