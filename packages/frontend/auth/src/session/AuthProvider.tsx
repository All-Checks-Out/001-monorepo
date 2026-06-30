import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import type { AuthenticatedUser } from "./types";
import { authConfig } from "../config";
import {
  doLogout,
  getUserFromStoredToken,
  handleOAuthCallback,
  startLogin,
} from "../cognito/client";
import { LOCAL_USER_STORAGE_KEY } from "./storage";

/////////////
// CONTEXT
/////////////

interface AuthContextData {
  user: AuthenticatedUser | null;
  isLoggedIn: boolean;
}
interface AuthContextValue extends AuthContextData {
  completeOAuthCallback: (code: string, state: string) => Promise<void>;
  selectLocalUser: (user: AuthenticatedUser) => void;
  login: () => void;
  logout: () => void;
  loading: boolean;
  isLocalAuth: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/////////////
// HELPER
/////////////

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within <AuthProvider>");
  return value;
}

/////////////
// PROVIDER
/////////////

interface AuthProviderProps {
  children: ReactNode;
}

const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const isLoggedIn = !!user;
  const isLocalAuth = authConfig.isLocal;

  useEffect(() => {
    setUser(isLocalAuth ? getLocalUserFromStorage() : getUserFromStoredToken());
    setLoading(false);
  }, [isLocalAuth]);

  const login = () => {
    if (isLocalAuth) return;
    startLogin();
  };

  const completeOAuthCallback = async (code: string, state: string) => {
    const user = await handleOAuthCallback(code, state);
    setUser(user);
  };

  const logout = () => {
    setUser(null);
    if (isLocalAuth) {
      window.localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
      window.location.assign("/");
      return;
    }

    doLogout();
  };

  const selectLocalUser = (nextUser: AuthenticatedUser) => {
    window.localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        completeOAuthCallback,
        selectLocalUser,
        login,
        logout,
        loading,
        isLocalAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;

function getLocalUserFromStorage() {
  const raw = window.localStorage.getItem(LOCAL_USER_STORAGE_KEY);
  if (!raw) return null;

  const user = JSON.parse(raw) as AuthenticatedUser;
  return user.sub && user.localUserId ? user : null;
}
