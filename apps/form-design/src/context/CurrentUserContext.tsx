import type { AppUser, Corporation } from "@frontend/api/onboarding/types";
import {
  getEffectivePermissions,
  hasPermission,
  type CorporationType,
  type Permission,
} from "@shared/permissions";
import { useAuth } from "@frontend/auth/session/AuthProvider";
import { getMe } from "@frontend/api/onboarding/client";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import type { HostCurrentUserContext } from "../hostContext";

/////////////
// CONTEXT
/////////////

interface CurrentUserContextData {
  user: AppUser | null;
  corporation: Corporation | null;
  corporationType: CorporationType | null;
  loading: boolean;
}

interface CurrentUserContextValue extends CurrentUserContextData {
  effectivePermissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  refreshCurrentUser: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

/////////////
// HELPER
/////////////

export function useCurrentUser() {
  const value = useContext(CurrentUserContext);
  if (!value) {
    throw new Error("useCurrentUser must be used within <CurrentUserProvider>");
  }

  return value;
}

interface CurrentUserProviderProps {
  children: ReactNode;
  hostContext?: HostCurrentUserContext;
}

export const CurrentUserProvider = ({
  children,
  hostContext,
}: CurrentUserProviderProps) => {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [user, setUser] = useState<AppUser | null>(null);
  const [corporation, setCorporation] = useState<Corporation | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshCurrentUser() {
    if (hostContext) {
      await hostContext.refreshCurrentUser();
      return;
    }

    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!isLoggedIn) {
      setUser(null);
      setCorporation(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const result = await getMe();
      setUser(result.user);
      setCorporation(result.corporation);
    } catch (error) {
      console.error("Failed to refresh current user", error);
      setUser(null);
      setCorporation(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hostContext) {
      void refreshCurrentUser();
    }
  }, [authLoading, isLoggedIn, hostContext]);

  if (hostContext) {
    return (
      <CurrentUserContext.Provider
        value={{
          user: hostContext.user,
          corporation: hostContext.corporation,
          corporationType: hostContext.corporationType,
          loading: hostContext.loading,
          effectivePermissions: hostContext.effectivePermissions,
          hasPermission: (permission) =>
            hostContext.effectivePermissions.includes(permission),
          refreshCurrentUser: hostContext.refreshCurrentUser,
        }}
      >
        {children}
      </CurrentUserContext.Provider>
    );
  }

  const corporationType = corporation?.type ?? null;
  const permissionContext = { user, corporationType };
  const effectivePermissions = getEffectivePermissions(permissionContext);

  return (
    <CurrentUserContext.Provider
      value={{
        user,
        corporation,
        corporationType,
        loading,
        effectivePermissions,
        hasPermission: (permission) =>
          hasPermission(permissionContext, permission),
        refreshCurrentUser,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
};
