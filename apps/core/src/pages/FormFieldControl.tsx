import { FormItem, FormValue } from "@frontend/api/onboarding/types";
import { Input } from "@frontend/shadcn/components/ui/input";
import { Textarea } from "@frontend/shadcn/components/ui/textarea";

export function FormFieldControl({
  item,
  value,
  disabled,
  onChange,
}: {
  item: FormItem;
  value: FormValue | undefined;
  disabled: boolean;
  onChange: (value: FormValue | undefined) => void;
}) {
  if (item.type === "textarea") {
    return (
      <Textarea
        value={typeof value === "string" ? value : ""}
        placeholder={item.placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (item.type === "select" || item.type === "radio") {
    return (
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || undefined)}
      >
        <option value="">Select an option</option>
        {item.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (item.type === "boolean") {
    return (
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={typeof value === "boolean" ? String(value) : ""}
        disabled={disabled}
        onChange={(event) => {
          if (!event.target.value) {
            onChange(undefined);
          } else {
            onChange(event.target.value === "true");
          }
        }}
      >
        <option value="">Select yes or no</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  return (
    <Input
      type={item.type === "date" ? "date" : "text"}
      value={typeof value === "string" ? value : ""}
      placeholder={"placeholder" in item ? item.placeholder : undefined}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
