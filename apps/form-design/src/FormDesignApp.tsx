import { FormDesignAppHeader } from "./components/FormDesignAppHeader";
import { FormDesignReactContext } from "./FormDesignReactContext";
import { FormDesignRouteContent } from "./FormDesignRouteContent";
import type { RemoteAppProps } from "./hostContext";

export const FormDesignApp = ({ hostContext }: RemoteAppProps) => (
  <FormDesignReactContext hostContext={hostContext}>
    <div className="flex min-h-svh w-full flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center px-4 py-3">
        <FormDesignAppHeader hostContext={hostContext} />
      </header>
      <FormDesignRouteContent hostContext={hostContext} />
    </div>
  </FormDesignReactContext>
);
