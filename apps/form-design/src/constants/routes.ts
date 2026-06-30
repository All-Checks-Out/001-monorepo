const FORM_DESIGN_BASE_PATH = "/form-design";

const FORM_DESIGN_ROUTES = {
  associationForms: "/",
  associationFormNew: "/association/forms/new",
  associationFormDesigner: (templateId: number | string) =>
    `/association/forms/${templateId}/designer`,
  associationFormDesignerReadOnly: (templateId: number | string) =>
    `/association/forms/${templateId}/designer?mode=read-only`,
} as const;

export {
  FORM_DESIGN_BASE_PATH,
  FORM_DESIGN_ROUTES,
};
