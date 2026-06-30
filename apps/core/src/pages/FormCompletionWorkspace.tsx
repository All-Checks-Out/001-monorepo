import { FormDocument, FormValue, FormValues, ProviderDDQChecklist, ProviderDDQChecklistTask } from "@frontend/api/onboarding/types";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { FormField } from "./FormField";
import { ReadOnlyNotice } from "./ReadOnlyNotice";

export function FormCompletionWorkspace({
  document,
  values,
  errors,
  dirty,
  complete,
  canMutate,
  busy,
  checklist,
  task,
  canPerformChecklist,
  onChange,
  onReset,
  onSave,
  onComplete,
}: {
  document: FormDocument | null;
  values: FormValues;
  errors: Record<string, string>;
  dirty: boolean;
  complete: boolean;
  canMutate: boolean;
  busy: boolean;
  checklist: ProviderDDQChecklist;
  task: ProviderDDQChecklistTask;
  canPerformChecklist: boolean;
  onChange: (itemId: string, value: FormValue | undefined) => void;
  onReset: () => void;
  onSave: () => void;
  onComplete: () => void;
}) {
  if (!document) {
    return (
      <section className="border bg-muted/10 p-3 text-sm text-destructive">
        This form completion task does not have a valid copied form.
      </section>
    );
  }

  return (
    <section className="grid gap-4 border bg-muted/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{document.definition.title}</h2>
          {document.definition.description && (
            <p className="text-xs text-muted-foreground">
              {document.definition.description}
            </p>
          )}
        </div>
        {dirty && <span className="text-xs text-amber-700">Unsaved form</span>}
      </div>

      <div className="grid gap-3">
        {document.definition.items.map((item) => (
          <FormField
            key={item.id}
            item={item}
            value={values[item.id]}
            error={errors[item.id]}
            disabled={!canMutate || busy}
            onChange={(value) => onChange(item.id, value)}
          />
        ))}
      </div>

      {canMutate ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !dirty}
            onClick={onReset}
          >
            <RotateCcw className="size-4" />
            Discard changes
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !dirty}
            onClick={onSave}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save progress
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy || !complete}
            onClick={onComplete}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Mark complete
          </Button>
        </div>
      ) : (
        <ReadOnlyNotice
          checklist={checklist}
          task={task}
          canPerformChecklist={canPerformChecklist}
          noun="form responses"
        />
      )}
    </section>
  );
}
