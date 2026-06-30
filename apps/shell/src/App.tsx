import AuthProvider, { useAuth } from "@frontend/auth/session/AuthProvider";
import ThemeProvider, { useTheme } from "@frontend/auth/session/ThemeProvider";
import { createRemoteAppComponent } from "@module-federation/bridge-react";
import { useEffect, type ReactNode } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  SidebarInset,
  SidebarProvider,
} from "@frontend/shadcn/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import {
  CurrentUserProvider,
  useCurrentUser,
} from "./context/CurrentUserContext";
import { getActiveApp } from "./appRegistry";
import type { ShellHostContext } from "./hostContext";

const RemoteLoading = () => (
  <div className="px-4 py-8 text-sm text-muted-foreground">Loading...</div>
);

const RemoteError = ({ error }: { error: Error }) => (
  <div className="px-4 py-8 text-sm text-destructive">
    Failed to load remote app: {error.message}
  </div>
);

const CoreRemote = createRemoteAppComponent({
  loader: () => import("core/app"),
  loading: <RemoteLoading />,
  fallback: RemoteError,
});

const FormDesignRemote = createRemoteAppComponent({
  loader: () => import("form_design/app"),
  loading: <RemoteLoading />,
  fallback: RemoteError,
});

interface ShellProvidersProps {
  children: ReactNode;
}

const ShellProviders = ({ children }: ShellProvidersProps) => (
  <CurrentUserProvider>{children}</CurrentUserProvider>
);

const useHostContext = (
  pathname: string,
  navigate: (to: string) => void,
): ShellHostContext => {
  const { isLoggedIn, loading } = useAuth();
  const currentUser = useCurrentUser();
  const { dark } = useTheme();

  return {
    auth: {
      isLoggedIn,
      loading,
    },
    currentUser: {
      user: currentUser.user,
      corporation: currentUser.corporation,
      corporationType: currentUser.corporationType,
      loading: currentUser.loading,
      effectivePermissions: currentUser.effectivePermissions,
      refreshCurrentUser: currentUser.refreshCurrentUser,
    },
    theme: {
      dark,
    },
    location: {
      pathname,
    },
    navigation: {
      navigate,
    },
  };
};

const useLoggedOutRoute = (
  pathname: string,
  navigate: (to: string, options?: { replace?: boolean }) => void,
) => {
  const { isLoggedIn, loading } = useAuth();

  useEffect(() => {
    if (loading || isLoggedIn || pathname === "/core" || pathname === "/core/callback") {
      return;
    }

    navigate("/core", { replace: true });
  }, [isLoggedIn, loading, navigate, pathname]);
};

interface RemoteRoutesProps {
  hostContext: ReturnType<typeof useHostContext>;
}

const RemoteRoutes = ({ hostContext }: RemoteRoutesProps) => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/core" replace />} />
      <Route path="/core/*" element={<CoreRemote hostContext={hostContext} />} />
      <Route
        path="/form-design/*"
        element={<FormDesignRemote hostContext={hostContext} />}
      />
    </Routes>
  );
};

const useDocumentTheme = () => {
  const { dark } = useTheme();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
};

const ShellContent = () => {
  const location = useLocation();
  const navigate = useNavigate();
  useLoggedOutRoute(location.pathname, navigate);
  const hostContext = useHostContext(location.pathname, navigate);
  const activeApp = getActiveApp(location.pathname);

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar activeApp={activeApp} hostContext={hostContext} />
      <SidebarInset className="h-svh overflow-hidden">
        <div className="min-h-0 flex-1 overflow-auto">
          <RemoteRoutes hostContext={hostContext} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

const ShellLayout = () => {
  useDocumentTheme();

  return (
    <div className="h-screen overflow-hidden">
      <ShellProviders>
        <ShellContent />
      </ShellProviders>
    </div>
  );
};

export const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        <ShellLayout />
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
);
