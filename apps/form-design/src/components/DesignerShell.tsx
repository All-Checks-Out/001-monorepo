import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@frontend/shadcn/components/ui/breadcrumb";
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FORM_DESIGN_ROUTES } from "../constants/routes";

interface DesignerShellProps {
  breadcrumbPage: string;
  disableFormsBreadcrumb: boolean;
  action?: ReactNode;
  children: ReactNode;
}

export const DesignerShell = ({
  breadcrumbPage,
  disableFormsBreadcrumb,
  action = null,
  children,
}: DesignerShellProps) => {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-2 px-4 pt-0 pb-3">
      <section className="grid gap-3 border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                {disableFormsBreadcrumb ? (
                  <BreadcrumbLink
                    asChild
                    className="pointer-events-none opacity-50"
                    aria-disabled="true"
                  >
                    <span>Forms</span>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={FORM_DESIGN_ROUTES.associationForms}>Forms</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{breadcrumbPage}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {action && <div className="flex flex-wrap justify-end gap-2">{action}</div>}
        </div>
        {children}
      </section>
    </div>
  );
};
