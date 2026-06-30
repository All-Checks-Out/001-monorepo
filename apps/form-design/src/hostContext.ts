import type { AppUser, Corporation } from "@frontend/api/onboarding/types";
import type { CorporationType, Permission } from "@shared/permissions";

export type HostCurrentUserContext = {
  user: AppUser | null;
  corporation: Corporation | null;
  corporationType: CorporationType | null;
  loading: boolean;
  effectivePermissions: Permission[];
  refreshCurrentUser: () => Promise<void>;
};

export type RemoteHostContext = {
  auth: {
    isLoggedIn: boolean;
    loading: boolean;
  };
  currentUser: HostCurrentUserContext;
  theme: {
    dark: boolean;
  };
  location: {
    pathname: string;
  };
  navigation: {
    navigate: (to: string) => void;
  };
};

export type RemoteAppProps = {
  hostContext?: RemoteHostContext;
};
