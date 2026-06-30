import { type ReactNode } from "react";
import { CurrentUserProvider } from "./context/CurrentUserContext";
import type { RemoteAppProps } from "./hostContext";

interface FormDesignReactContextProps {
  children: ReactNode;
  hostContext?: RemoteAppProps["hostContext"];
}

export const FormDesignReactContext = ({
  children,
  hostContext,
}: FormDesignReactContextProps) => (
  <CurrentUserProvider hostContext={hostContext?.currentUser}>
    {children}
  </CurrentUserProvider>
);
