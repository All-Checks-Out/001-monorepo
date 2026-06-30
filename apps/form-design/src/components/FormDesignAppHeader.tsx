import { Button } from "@frontend/shadcn/components/ui/button";
import { Building2 } from "lucide-react";
import { FORM_DESIGN_BASE_PATH } from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";
import type { RemoteAppProps } from "../hostContext";

interface FormDesignAppHeaderProps {
  hostContext?: RemoteAppProps["hostContext"];
}

export const FormDesignAppHeader = ({
  hostContext,
}: FormDesignAppHeaderProps) => {
  const { corporationType, hasPermission } = useCurrentUser();
  const pathname = hostContext?.location.pathname ?? "/";
  const navigate = hostContext?.navigation.navigate ?? navigateWithLocationAssign;
  const current =
    pathname === FORM_DESIGN_BASE_PATH ||
    pathname.startsWith(`${FORM_DESIGN_BASE_PATH}/`);

  if (corporationType !== "ASSOCIATION" || !hasPermission("forms:read")) {
    return null;
  }

  return (
    <nav className="flex flex-wrap items-center gap-3">
      <Button
        aria-label="Form design home"
        aria-current={current ? "page" : undefined}
        variant={current ? "secondary" : "ghost"}
        size="sm"
        type="button"
        onClick={() => navigate(FORM_DESIGN_BASE_PATH)}
      >
        <Building2 className="size-4" />
      </Button>
    </nav>
  );
};

function navigateWithLocationAssign(to: string) {
  window.location.assign(to);
}
