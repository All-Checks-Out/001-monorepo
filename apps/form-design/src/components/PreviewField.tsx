import { FormItem } from "@frontend/api/onboarding/types";
import { Checkbox } from "@frontend/shadcn/components/ui/checkbox";
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
  }
}

interface PreviewFieldProps {
  item: FormItem
}

export const PreviewField = ({ item }: PreviewFieldProps) => {
  const label = item.label || "Untitled item";
  const fieldId = `preview-${item.id}`;

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
