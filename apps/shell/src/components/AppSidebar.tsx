import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@frontend/shadcn/components/ui/sidebar";
import { ClipboardCheck, FileText } from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLoggedOutShellApps,
  getVisibleShellApps,
  type ActiveApp,
  type ShellApp,
} from "../appRegistry";
import type { ShellHostContext } from "../hostContext";
import { ThemeButton } from "./ThemeButton";
import { UserMenu } from "./UserMenu";

interface AppSidebarProps {
  activeApp: ActiveApp;
  hostContext: ShellHostContext;
}

export const AppSidebar = ({ activeApp, hostContext }: AppSidebarProps) => {
  const navigate = useNavigate();
  const apps = useMemo(() => {
    if (!hostContext.auth.isLoggedIn) return getLoggedOutShellApps();

    return getVisibleShellApps(hostContext.currentUser.effectivePermissions);
  }, [hostContext.auth.isLoggedIn, hostContext.currentUser.effectivePermissions]);

  return (
    <Sidebar aria-label="Module Foundation apps" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          {apps.map((app) => (
            <SidebarMenuItem key={app.id}>
              <SidebarMenuButton
                aria-label={app.label}
                aria-current={app.id === activeApp ? "page" : undefined}
                isActive={app.id === activeApp}
                title={app.label}
                tooltip={app.label}
                type="button"
                onClick={() => navigate(app.path)}
              >
                <AppIcon app={app} />
                <span>{app.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent />
      <SidebarFooter>
        <ThemeButton />
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};

interface AppIconProps {
  app: ShellApp;
}

const AppIcon = ({ app }: AppIconProps) => {
  if (app.id === "form-design") return <FileText />;

  return <ClipboardCheck />;
};
