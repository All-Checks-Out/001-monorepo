import {
  getEffectivePermissions as getSharedEffectivePermissions,
  hasPermission as sharedHasPermission,
  type CorporationType,
  type Permission,
} from "@shared/permissions";
import type { AppUser, Corporation } from "@frontend/api/onboarding/types";
import { getMe } from "@frontend/api/onboarding/client";
import { useAuth } from "@frontend/auth/session/AuthProvider";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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

/////////////
// PROVIDER
/////////////

interface CurrentUserProviderProps {
  children: ReactNode;
}

export const CurrentUserProvider = ({ children }: CurrentUserProviderProps) => {
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [user, setUser] = useState<AppUser | null>(null);
  const [corporation, setCorporation] = useState<Corporation | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshCurrentUser() {
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
    void refreshCurrentUser();
  }, [authLoading, isLoggedIn]);

  const corporationType = corporation?.type ?? null;
  const effectivePermissions =
    user && corporationType
      ? getSharedEffectivePermissions(user, { type: corporationType })
      : [];

  return (
    <CurrentUserContext.Provider
      value={{
        user,
        corporation,
        corporationType,
        loading,
        effectivePermissions,
        hasPermission: (permission) =>
          Boolean(
            user &&
              corporationType &&
              sharedHasPermission(
                { user, corporation: { type: corporationType } },
                permission,
              ),
          ),
        refreshCurrentUser,
      }}
    >
      {children}
    </CurrentUserContext.Provider>
  );
};
