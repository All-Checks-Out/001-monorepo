import { FormTemplateSchema } from "@frontend/api/onboarding/types";
import { PreviewField } from "./PreviewField";

interface FormPreviewProps {
  schema: FormTemplateSchema
}

export const FormPreview = ({ schema }: FormPreviewProps) => {
  if (schema.items.length === 0) {
    return <p className="text-sm text-muted-foreground">No fields added yet.</p>;
  }

  return (
    <div className="grid gap-4">
      {schema.items.map((item) => (
        <PreviewField key={item.id} item={item} />
      ))}
    </div>
  );
};
