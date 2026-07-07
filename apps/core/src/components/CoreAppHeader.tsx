import { Button } from "@frontend/shadcn/components/ui/button";
import type { Permission } from "@shared/permissions";
import { Building2 } from "lucide-react";
import {
  CORE_ROUTES,
  toCoreShellPath,
  toCoreShellPaths,
} from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";
import type { RemoteAppProps } from "../hostContext";

type HeaderNavItem = {
  label: string;
  to: string;
  activePaths?: string[];
  icon?: "home";
};

interface CoreAppHeaderProps {
  hostContext?: RemoteAppProps["hostContext"];
}

export const CoreAppHeader = ({ hostContext }: CoreAppHeaderProps) => {
  const { corporationType, hasPermission } = useCurrentUser();
  const isLoggedIn = hostContext?.auth.isLoggedIn ?? false;
  const pathname = hostContext?.location.pathname ?? "/";
  const navigate = hostContext?.navigation.navigate ?? navigateWithLocationAssign;
  const navItems = getCoreHeaderNavItems({
    corporationType,
    hasPermission,
    isLoggedIn,
  });

  if (navItems.length === 0) return null;

  return (
    <nav className="flex flex-wrap items-center gap-3">
      {navItems.map((item) => (
        <HeaderNavButton
          key={`${item.to}-${item.label}`}
          item={item}
          current={isCurrentNavItem(pathname, item)}
          navigate={navigate}
        />
      ))}
    </nav>
  );
};

interface HeaderNavButtonProps {
  item: HeaderNavItem;
  current: boolean;
  navigate: (to: string) => void;
}

const HeaderNavButton = ({
  item,
  current,
  navigate,
}: HeaderNavButtonProps) => (
  <Button
    aria-current={current ? "page" : undefined}
    variant={current ? "secondary" : "ghost"}
    size="sm"
    type="button"
    onClick={() => navigate(item.to)}
  >
    {item.icon === "home" ? <Building2 className="size-4" /> : item.label}
  </Button>
);

type HeaderNavContext = {
  corporationType: ReturnType<typeof useCurrentUser>["corporationType"];
  hasPermission: (permission: Permission) => boolean;
  isLoggedIn: boolean;
};

function getCoreHeaderNavItems(context: HeaderNavContext): HeaderNavItem[] {
  const navItems: HeaderNavItem[] = [
    {
      to: toCoreShellPath(CORE_ROUTES.home),
      label: "DDQ Home",
      activePaths: [toCoreShellPath(CORE_ROUTES.home)],
      icon: "home",
    },
  ];

  if (context.isLoggedIn) {
    navItems.push({
      to: toCoreShellPath(CORE_ROUTES.profile),
      label: "Profile",
    });
  }

  if (context.corporationType === "ASSOCIATION") {
    if (context.hasPermission("association-ddq-packs:read")) {
      navItems.push({
        to: toCoreShellPath(CORE_ROUTES.associationDDQPacks),
        label: "DDQ Packs",
        activePaths: toCoreShellPaths([CORE_ROUTES.associationDDQPacks]),
      });
    }
    if (context.hasPermission("association-provider-requests:read")) {
      navItems.push({
        to: toCoreShellPath(CORE_ROUTES.associationProviders),
        label: "Requests",
        activePaths: toCoreShellPaths([
          CORE_ROUTES.associationProviders,
          CORE_ROUTES.associationAccessRequests,
        ]),
      });
    }
    if (context.hasPermission("own-users:read")) {
      navItems.push({
        to: toCoreShellPath(CORE_ROUTES.associationUsers),
        label: "Users",
        activePaths: toCoreShellPaths([CORE_ROUTES.associationUsers]),
      });
    }
    if (
      context.hasPermission("all-corporations:read") &&
      context.hasPermission("all-users:read")
    ) {
      navItems.push({
        to: toCoreShellPath(CORE_ROUTES.associationSystemData),
        label: "System Data",
        activePaths: toCoreShellPaths([CORE_ROUTES.associationSystemData]),
      });
    }
  }

  if (context.corporationType === "PROVIDER") {
    navItems.push({
      to: toCoreShellPath(CORE_ROUTES.providerDDQPacks),
      label: "DDQ Packs",
      activePaths: toCoreShellPaths([CORE_ROUTES.providerDDQPacks]),
    });
    if (context.hasPermission("provider-subjects:read")) {
      navItems.push({
        to: toCoreShellPath(CORE_ROUTES.providerSubjects),
        label: "Subjects",
        activePaths: toCoreShellPaths([CORE_ROUTES.providerSubjects]),
      });
    }
    if (
      context.hasPermission("provider-agent-requests:read") ||
      context.hasPermission("provider-stakeholder-requests:read")
    ) {
      navItems.push({
        to: toCoreShellPath(CORE_ROUTES.providerSetupRequests),
        label: "Setup Requests",
        activePaths: toCoreShellPaths([CORE_ROUTES.providerSetupRequests]),
      });
    }
    if (context.hasPermission("own-users:read")) {
      navItems.push({
        to: toCoreShellPath(CORE_ROUTES.providerUsers),
        label: "Users",
        activePaths: toCoreShellPaths([CORE_ROUTES.providerUsers]),
      });
    }
  }

  if (context.corporationType === "AGENT") {
    navItems.push({
      to: toCoreShellPath(CORE_ROUTES.agentProviders),
      label: "Providers",
      activePaths: toCoreShellPaths([CORE_ROUTES.agentProviders]),
    });
    if (context.hasPermission("own-users:read")) {
      navItems.push({
        to: toCoreShellPath(CORE_ROUTES.agentUsers),
        label: "Users",
        activePaths: toCoreShellPaths([CORE_ROUTES.agentUsers]),
      });
    }
  }

  if (context.corporationType === "STAKEHOLDER") {
    navItems.push({
      to: toCoreShellPath(CORE_ROUTES.stakeholderProviders),
      label: "Providers",
      activePaths: toCoreShellPaths([CORE_ROUTES.stakeholderProviders]),
    });
    if (context.hasPermission("own-users:read")) {
      navItems.push({
        to: toCoreShellPath(CORE_ROUTES.stakeholderUsers),
        label: "Users",
        activePaths: toCoreShellPaths([CORE_ROUTES.stakeholderUsers]),
      });
    }
  }

  return navItems;
}

function isCurrentNavItem(pathname: string, item: HeaderNavItem) {
  const paths = item.activePaths ?? [item.to];

  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function navigateWithLocationAssign(to: string) {
  window.location.assign(to);
}
