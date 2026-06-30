import AuthProvider from "@frontend/auth/session/AuthProvider";
import ThemeProvider from "@frontend/auth/session/ThemeProvider";
import { createBridgeComponent } from "@module-federation/bridge-react/v19";
import { BrowserRouter } from "react-router-dom";
import { FormDesignApp } from "./FormDesignApp";
import type { RemoteAppProps } from "./hostContext";
import "./index.css";

type FormDesignBridgeProps = RemoteAppProps & {
  basename?: string;
};

const FormDesignBridgeApp = ({
  basename = "/",
  hostContext,
}: FormDesignBridgeProps) => (
  <AuthProvider>
    <ThemeProvider>
      <BrowserRouter basename={basename}>
        <FormDesignApp hostContext={hostContext} />
      </BrowserRouter>
    </ThemeProvider>
  </AuthProvider>
);

export default createBridgeComponent({
  rootComponent: FormDesignBridgeApp,
});
