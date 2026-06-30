import type { AppUser, Corporation } from "@frontend/api/onboarding/types";
import type { CorporationType, Permission } from "@shared/permissions";

export type ShellHostContext = {
  auth: {
    isLoggedIn: boolean;
    loading: boolean;
  };
  currentUser: {
    user: AppUser | null;
    corporation: Corporation | null;
    corporationType: CorporationType | null;
    loading: boolean;
    effectivePermissions: Permission[];
    refreshCurrentUser: () => Promise<void>;
  };
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
