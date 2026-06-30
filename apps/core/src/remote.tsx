import AuthProvider from "@frontend/auth/session/AuthProvider";
import ThemeProvider from "@frontend/auth/session/ThemeProvider";
import { createBridgeComponent } from "@module-federation/bridge-react/v19";
import { BrowserRouter } from "react-router-dom";
import { CoreApp } from "./CoreApp";
import type { RemoteAppProps } from "./hostContext";
import "./index.css";

type CoreBridgeProps = RemoteAppProps & {
  basename?: string;
};

const CoreBridgeApp = ({ basename = "/", hostContext }: CoreBridgeProps) => (
  <AuthProvider>
    <ThemeProvider>
      <BrowserRouter basename={basename}>
        <CoreApp hostContext={hostContext} />
      </BrowserRouter>
    </ThemeProvider>
  </AuthProvider>
);

export default createBridgeComponent({
  rootComponent: CoreBridgeApp,
});
