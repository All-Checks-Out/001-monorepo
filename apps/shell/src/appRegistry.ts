import type { Permission } from "@shared/permissions";

export type ActiveApp = "core" | "form-design";

export type ShellApp = {
  id: ActiveApp;
  label: string;
  description: string;
  path: string;
  requiredPermission?: Permission;
};

export const shellApps: ShellApp[] = [
  {
    id: "core",
    label: "DDQ",
    description: "Due diligence",
    path: "/core",
  },
  {
    id: "form-design",
    label: "Forms",
    description: "Form design",
    path: "/form-design",
    requiredPermission: "forms:read",
  },
];

export function getVisibleShellApps(permissions: Permission[]) {
  return shellApps.filter(
    (app) =>
      !app.requiredPermission || permissions.includes(app.requiredPermission),
  );
}

export function getLoggedOutShellApps() {
  return shellApps.filter((app) => app.id === "core");
}

export function getActiveApp(pathname: string): ActiveApp {
  if (pathname.startsWith("/form-design")) return "form-design";

  return "core";
}
