import { getRootSetupStatus } from "@frontend/api/onboarding/client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

/////////////
// CONTEXT
/////////////

interface RootSetupContextData {
  rootConfigured: boolean | null;
  rootSetupError: string;
}
interface RootSetupContextValue extends RootSetupContextData {
  setRootSetupError: (error: string) => void;
  refreshRootSetupStatus: () => Promise<void>;
}

const RootSetupContext = createContext<RootSetupContextValue | null>(null);

/////////////
// HELPER
/////////////

export function useRootSetup() {
  const value = useContext(RootSetupContext);
  if (!value) {
    throw new Error("useRootSetup must be used within <RootSetupProvider>");
  }

  return value;
}

/////////////
// PROVIDER
/////////////

interface RootSetupProviderProps {
  children: ReactNode;
}

const RootSetupProvider = ({ children }: RootSetupProviderProps) => {
  const [rootConfigured, setRootConfigured] = useState<boolean | null>(null);
  const [rootSetupError, setRootSetupError] = useState("");

  async function refreshRootSetupStatus() {
    try {
      const status = await getRootSetupStatus();
      setRootConfigured(status.configured);
      setRootSetupError("");
    } catch (error) {
      setRootConfigured(false);
      setRootSetupError(
        error instanceof Error ? error.message : "Could not check root setup.",
      );
    }
  }

  useEffect(() => {
    void refreshRootSetupStatus();
  }, []);

  const sharedData = {
    rootConfigured,
    rootSetupError,
    setRootSetupError,
    refreshRootSetupStatus,
  };

  return (
    <RootSetupContext.Provider value={sharedData}>
      {children}
    </RootSetupContext.Provider>
  );
};

export default RootSetupProvider;
