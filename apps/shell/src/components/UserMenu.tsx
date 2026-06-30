import {
  fullFactoryResetDemoData,
  recreateSampleData,
  seededFactoryResetDemoData,
} from "@frontend/api/onboarding/client";
import { useAuth } from "@frontend/auth/session/AuthProvider";
import { AUTH_STORAGE_KEYS } from "@frontend/auth/session/storage";
import { buttonVariants } from "@frontend/shadcn/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@frontend/shadcn/components/ui/dropdown-menu";
import { cn } from "@frontend/shadcn/lib/utils";
import { User } from "lucide-react";
import { useState } from "react";
import { LocalLoginDialog } from "./LocalLoginDialog";

export const UserMenu = () => {
  const { isLocalAuth, isLoggedIn, login, logout } = useAuth();
  const [localLoginOpen, setLocalLoginOpen] = useState(false);

  function openLogin() {
    if (isLocalAuth) {
      setLocalLoginOpen(true);
      return;
    }

    login();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          aria-label="User menu"
        >
          <User />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isLoggedIn ? (
            <DropdownMenuItem onClick={logout}>Logout</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={openLogin}>Login</DropdownMenuItem>
          )}
          <SystemResetMenu />
        </DropdownMenuContent>
      </DropdownMenu>
      <LocalLoginDialog
        open={localLoginOpen}
        onOpenChange={setLocalLoginOpen}
      />
    </>
  );
};

const resetRedirectHref = "/";

const SystemResetMenu = () => {
  async function resetData() {
    if (!window.confirm("Full factory reset? This removes all users and example data.")) {
      return;
    }

    try {
      await fullFactoryResetDemoData();
      AUTH_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
      window.alert("System has been reset to an empty factory state.");
      window.location.assign(resetRedirectHref);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not perform full factory reset.");
    }
  }

  async function seededFactoryReset() {
    if (
      !window.confirm(
        "Seeded factory reset? This removes users and example data, recreates seed users and sample data, and logs you out.",
      )
    ) {
      return;
    }

    try {
      await seededFactoryResetDemoData();
      AUTH_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
      window.alert("System has been reset and reseeded.");
      window.location.assign(resetRedirectHref);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not perform seeded factory reset.",
      );
    }
  }

  async function recreateSamples() {
    if (!window.confirm("Recreate sample data while preserving existing Cognito users?")) {
      return;
    }

    try {
      await recreateSampleData();
      window.alert("Sample data has been recreated.");
      window.location.assign(resetRedirectHref);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not recreate sample data.");
    }
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>System Reset</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem onClick={resetData}>Full Factory Reset</DropdownMenuItem>
        <DropdownMenuItem onClick={seededFactoryReset}>
          Seeded Factory Reset
        </DropdownMenuItem>
        <DropdownMenuItem onClick={recreateSamples}>
          Recreate sample data
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};
