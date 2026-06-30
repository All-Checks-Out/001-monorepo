import { type ReactNode } from "react";
import CurrentUserProvider from "./context/CurrentUserContext";
import RootSetupProvider from "./context/RootSetupContext";
import type { RemoteAppProps } from "./hostContext";

interface CoreReactContextProps {
  children: ReactNode;
  hostContext?: RemoteAppProps["hostContext"];
}

export const CoreReactContext = ({
  children,
  hostContext,
}: CoreReactContextProps) => (
  <RootSetupProvider>
    <CurrentUserProvider hostContext={hostContext?.currentUser}>
      {children}
    </CurrentUserProvider>
  </RootSetupProvider>
);
