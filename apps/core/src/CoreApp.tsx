import { CoreAppHeader } from "./components/CoreAppHeader";
import { CoreReactContext } from "./CoreReactContext";
import { CoreRouteContent } from "./CoreRouteContent";
import type { RemoteAppProps } from "./hostContext";

export const CoreApp = ({ hostContext }: RemoteAppProps) => (
  <CoreReactContext hostContext={hostContext}>
    <div className="flex min-h-svh w-full flex-col">
      <header className="mx-auto flex w-full max-w-7xl items-center px-4 py-3">
        <CoreAppHeader hostContext={hostContext} />
      </header>
      <CoreRouteContent hostContext={hostContext} />
    </div>
  </CoreReactContext>
);
