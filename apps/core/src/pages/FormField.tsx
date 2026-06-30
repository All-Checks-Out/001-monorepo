import { FormItem, FormValue } from "@frontend/api/onboarding/types";
import { FormFieldControl } from "./FormFieldControl";

export function FormField({
  item,
  value,
  error,
  disabled,
  onChange,
}: {
  item: FormItem;
  value: FormValue | undefined;
  error?: string;
  disabled: boolean;
  onChange: (value: FormValue | undefined) => void;
}) {
  const label = (
    <span className="font-medium">
      {item.label}
      {item.required && <span className="text-destructive"> *</span>}
    </span>
  );

  return (
    <label className="grid gap-1 text-sm">
      {label}
      {item.helpText && (
        <span className="text-xs text-muted-foreground">{item.helpText}</span>
      )}
      <FormFieldControl
        item={item}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}
