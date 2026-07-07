import { type ReactNode } from "react";
import { FormItem, FormItemType } from "@frontend/api/onboarding/types";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Checkbox } from "@frontend/shadcn/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@frontend/shadcn/components/ui/dialog";
import { Input } from "@frontend/shadcn/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@frontend/shadcn/components/ui/select";
import { Plus, Trash2 } from "lucide-react";

type DataFormItemType = Exclude<FormItemType, "subject">;

const FORM_ITEM_TYPES: { type: DataFormItemType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "textarea", label: "Long text" },
  { type: "date", label: "Date" },
  { type: "phone", label: "Phone" },
  { type: "select", label: "Dropdown" },
  { type: "radio", label: "Radio options" },
  { type: "boolean", label: "Yes/No" },
];

type ItemDialogState = {
  mode: "add" | "edit";
  initialItem: FormItem;
  draftItem: FormItem;
};

interface DesignerLabelProps {
  children: ReactNode;
}

const DesignerLabel = ({ children }: DesignerLabelProps) => (
  <label className="grid gap-1 text-sm font-medium">{children}</label>
);

interface ItemEditorDialogProps {
  state: ItemDialogState | null;
  error: string;
  canSave: boolean;
  onChange: (updater: (item: FormItem) => FormItem) => void;
  onOptionChange: (index: number, value: string) => void;
  onAddOption: () => void;
  onDeleteOption: (index: number) => void;
  onCancel: () => void;
  onSave: () => void;
}

export const ItemEditorDialog = ({
  state,
  error,
  canSave,
  onChange,
  onOptionChange,
  onAddOption,
  onDeleteOption,
  onCancel,
  onSave,
}: ItemEditorDialogProps) => {
  const item = state?.draftItem ?? null;

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-auto sm:max-w-2xl">
        {item && (
          <>
            <DialogHeader>
              <DialogTitle>
                {state?.mode === "add" ? "Add field" : "Edit field"}
              </DialogTitle>
              <DialogDescription>
                Configure the field before applying it to the draft template.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4">
              <DesignerLabel>
                Type
                <Select value={item.type} disabled>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_ITEM_TYPES.map((itemType) => (
                      <SelectItem key={itemType.type} value={itemType.type}>
                        {itemType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DesignerLabel>

              <DesignerLabel>
                Label
                <Input
                  value={item.label}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, label: event.target.value }))
                  }
                />
              </DesignerLabel>

              <DesignerLabel>
                Help text
                <Input
                  value={item.helpText ?? ""}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      helpText: event.target.value || undefined,
                    }))
                  }
                  placeholder="Optional guidance for respondents"
                />
              </DesignerLabel>

              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={item.required}
                  onCheckedChange={(checked) =>
                    onChange((current) => ({
                      ...current,
                      required: checked === true,
                    }))
                  }
                />
                Required
              </label>

              {(item.type === "text" ||
                item.type === "textarea" ||
                item.type === "phone") && (
                <DesignerLabel>
                  Placeholder
                  <Input
                    value={item.placeholder ?? ""}
                    onChange={(event) =>
                      onChange((current) => ({
                        ...current,
                        placeholder: event.target.value || undefined,
                      }))
                    }
                  />
                </DesignerLabel>
              )}

              {(item.type === "select" || item.type === "radio") && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium">Options</h3>
                    <Button variant="outline" size="sm" onClick={onAddOption}>
                      <Plus className="size-4" />
                      Add option
                    </Button>
                  </div>
                  {item.options.map((option, index) => (
                    <div key={`${item.id}-${index}`} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(event) =>
                          onOptionChange(index, event.target.value)
                        }
                        aria-label={`Option ${index + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onDeleteOption(index)}
                        aria-label={`Delete option ${index + 1}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  {item.options.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Add at least one option before saving.
                    </p>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={onSave} disabled={!canSave}>
                Save field
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
