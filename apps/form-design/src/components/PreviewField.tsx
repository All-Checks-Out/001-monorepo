import { FormItem, SubjectType } from "@frontend/api/onboarding/types";
import { Checkbox } from "@frontend/shadcn/components/ui/checkbox";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Input } from "@frontend/shadcn/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@frontend/shadcn/components/ui/select";
import { Textarea } from "@frontend/shadcn/components/ui/textarea";

function renderPreviewControl(item: FormItem, fieldId: string) {
  switch (item.type) {
    case "text":
      return <Input id={fieldId} placeholder={item.placeholder} />;
    case "textarea":
      return <Textarea id={fieldId} placeholder={item.placeholder} />;
    case "date":
      return <Input id={fieldId} type="date" />;
    case "phone":
      return <Input id={fieldId} type="tel" placeholder={item.placeholder} />;
    case "select":
      return (
        <Select>
          <SelectTrigger id={fieldId}>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
          {item.options.map((option, index) => (
            <SelectItem key={`${item.id}-preview-${index}`} value={option}>
              {option || `Option ${index + 1}`}
            </SelectItem>
          ))}
          </SelectContent>
        </Select>
      );
    case "radio":
      return (
        <fieldset className="grid gap-2">
          {item.options.map((option, index) => (
            <label
              key={`${item.id}-preview-${index}`}
              className="flex items-center gap-2"
            >
              <input type="radio" name={fieldId} />
              {option || `Option ${index + 1}`}
            </label>
          ))}
        </fieldset>
      );
    case "boolean":
      return null;
    case "subject":
      return null;
  }
}

interface PreviewFieldProps {
  item: FormItem;
  subjectTypes?: SubjectType[];
}

export const PreviewField = ({ item, subjectTypes = [] }: PreviewFieldProps) => {
  const label = item.label || "Untitled item";
  const fieldId = `preview-${item.id}`;

  if (item.type === "subject") {
    const subjectType = subjectTypes.find(
      (candidate) => candidate.key === item.subjectTypeKey,
    );
    const subjectLabel = subjectType?.label ?? item.subjectTypeKey;
    const properties = item.selectedProperties.map((selection) => {
      const property = subjectType?.properties.find(
        (candidate) => candidate.key === selection.key,
      );
      return { selection, property };
    });

    return (
      <section className="grid gap-3 rounded-md border bg-muted/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">
              {label}
              {item.required && <span className="ml-1 text-destructive">*</span>}
            </h3>
            {item.helpText && (
              <p className="text-xs text-muted-foreground">{item.helpText}</p>
            )}
          </div>
          <Button type="button" size="sm" variant="outline">
            Add {subjectLabel}
          </Button>
        </div>
        <div className="grid gap-2 rounded-md border bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground">
            {subjectLabel} 1
          </div>
          {properties.map(({ selection, property }) => {
            if (property?.kind === "complex" && "columns" in selection) {
              const columns = selection.columns.map((columnSelection) => {
                const column = property.properties.find(
                  (candidate) => candidate.key === columnSelection.key,
                );
                return column?.label ?? columnSelection.key;
              });

              return (
                <div key={selection.key} className="grid gap-1 text-sm">
                  <span className="font-medium">{property.label}</span>
                  <div className="overflow-hidden rounded-md border">
                    <div
                      className="grid bg-muted/50 text-xs font-medium"
                      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
                    >
                      {columns.map((column) => (
                        <span key={column} className="border-r px-2 py-1 last:border-r-0">
                          {column}
                        </span>
                      ))}
                    </div>
                    <div
                      className="grid"
                      style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
                    >
                      {columns.map((column) => (
                        <span key={column} className="border-r px-2 py-2 last:border-r-0" />
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            const simpleProperty =
              property?.kind === "simple"
                ? property
                : {
                    key: selection.key,
                    label: selection.key,
                    valueType: "text" as const,
                    required: false,
                  };

            return (
              <label key={selection.key} className="grid gap-1 text-sm">
                <span className="font-medium">
                  {simpleProperty.label}
                  {simpleProperty.required && <span className="ml-1 text-destructive">*</span>}
                </span>
                <Input
                  type={simpleProperty.valueType === "date" ? "date" : "text"}
                  disabled
                />
              </label>
            );
          })}
        </div>
      </section>
    );
  }

  if (item.type === "boolean") {
    return (
      <label className="grid gap-1 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Checkbox />
          {label}
          {item.required && <span className="text-destructive">*</span>}
        </span>
        {item.helpText && <span className="text-muted-foreground">{item.helpText}</span>}
      </label>
    );
  }

  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={fieldId} className="font-medium">
        {label}
        {item.required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {item.helpText && <p className="text-muted-foreground">{item.helpText}</p>}
      {renderPreviewControl(item, fieldId)}
    </div>
  );
};
