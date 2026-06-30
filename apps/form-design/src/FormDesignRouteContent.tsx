import { useTheme } from "@frontend/auth/session/ThemeProvider";
import type { Permission } from "@shared/permissions";
import { useEffect, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { Page } from "./components/Page";
import { PermissionRequired } from "./components/PermissionRequired";
import { Status } from "./components/Status";
import type { RemoteAppProps } from "./hostContext";
import { AssociationFormsPage } from "./pages/AssociationFormsPage";
import { FormTemplateDesigner } from "./pages/FormTemplateDesigner";

type GuardOptions = {
  title?: ReactNode;
};

const guard = (
  permission: Permission,
  element: ReactNode,
  { title }: GuardOptions = {},
) => (
  <PermissionRequired permission={permission} title={title}>
    {element}
  </PermissionRequired>
);

const useDocumentTheme = (hostContext?: RemoteAppProps["hostContext"]) => {
  const { dark } = useTheme();
  const documentDark = hostContext?.theme.dark ?? dark;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", documentDark);
  }, [documentDark]);
};

export const FormDesignRouteContent = ({ hostContext }: RemoteAppProps) => {
  useDocumentTheme(hostContext);

  return (
    <Routes>
      <Route
        index
        element={guard("forms:read", <AssociationFormsPage />, {
          title: "Association Forms",
        })}
      />
      <Route
        path="association/forms/new"
        element={<FormTemplateDesigner mode="new" />}
      />
      <Route
        path="association/forms/:templateId/designer"
        element={<FormTemplateDesigner mode="edit" />}
      />
      <Route
        path="*"
        element={
          <Page title="Association Forms">
            <Status error="The requested form-design page could not be found." />
          </Page>
        }
      />
    </Routes>
  );
};
