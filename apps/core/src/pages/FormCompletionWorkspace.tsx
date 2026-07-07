import { listProviderSubjects, listSubjectTypes } from "@frontend/api/onboarding/client";
import type {
  FormDocument,
  FormItem,
  FormValue,
  FormValues,
  ProviderDDQChecklist,
  ProviderDDQChecklistTask,
  Subject,
  SubjectComplexRowValue,
  SubjectPropertySelection,
  SubjectPropertyValue,
  SubjectScalarValue,
  SubjectSimplePropertyDefinition,
  SubjectType,
  SubjectValues,
} from "@frontend/api/onboarding/types";
import { Button } from "@frontend/shadcn/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@frontend/shadcn/components/ui/dialog";
import { Input } from "@frontend/shadcn/components/ui/input";
import { ChevronDown, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FormField } from "./FormField";
import { ReadOnlyNotice } from "./ReadOnlyNotice";

type SubjectItem = Extract<FormItem, { type: "subject" }>;

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
  canReadSubjects,
  onChange,
  onAutofill,
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
  canReadSubjects: boolean;
  onChange: (itemId: string, value: FormValue | undefined) => void;
  onAutofill: (values: FormValues) => void;
  onReset: () => void;
  onSave: () => void;
  onComplete: () => void;
}) {
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>([]);
  const [subjectError, setSubjectError] = useState("");
  const [subjectPicker, setSubjectPicker] = useState<{
    item: SubjectItem;
    subjectType?: SubjectType;
    onSelect: (subject: Subject) => void;
  } | null>(null);
  const [pickerSubjects, setPickerSubjects] = useState<Subject[]>([]);
  const [selectedPickerSubjectId, setSelectedPickerSubjectId] = useState("");
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState("");
  const subjectItems = useMemo(
    () => document?.definition.items.filter((item): item is SubjectItem => item.type === "subject") ?? [],
    [document],
  );
  const subjectTypesByKey = useMemo(
    () => new Map(subjectTypes.map((subjectType) => [subjectType.key, subjectType])),
    [subjectTypes],
  );

  useEffect(() => {
    if (subjectItems.length === 0) return;

    let cancelled = false;

    async function loadSubjectTypes() {
      try {
        const result = await listSubjectTypes();
        if (!cancelled) setSubjectTypes(result.subjectTypes);
      } catch (err) {
        if (!cancelled) {
          setSubjectError(
            err instanceof Error ? err.message : "Could not load Subject metadata.",
          );
        }
      }
    }

    void loadSubjectTypes();

    return () => {
      cancelled = true;
    };
  }, [subjectItems.length]);

  function setFormValues(nextValues: FormValues) {
    onAutofill(nextValues);
  }

  function openSubjectPicker(
    item: SubjectItem,
    subjectType: SubjectType | undefined,
    onSelect: (subject: Subject) => void,
  ) {
    setSubjectPicker({ item, subjectType, onSelect });
    setPickerSubjects([]);
    setSelectedPickerSubjectId("");
    setPickerError("");
  }

  useEffect(() => {
    if (!subjectPicker) return;
    if (!canReadSubjects) {
      setPickerError("Permission required to read Subjects.");
      return;
    }

    const picker = subjectPicker;
    let cancelled = false;
    setPickerLoading(true);
    setPickerError("");

    async function loadSubjects() {
      try {
        const result = await listProviderSubjects({
          subjectTypeKey: picker.item.subjectTypeKey,
        });
        if (cancelled) return;

        setPickerSubjects(result.subjects);
        setSelectedPickerSubjectId(String(result.subjects[0]?.id ?? ""));
      } catch (err) {
        if (!cancelled) {
          setPickerSubjects([]);
          setSelectedPickerSubjectId("");
          setPickerError(err instanceof Error ? err.message : "Could not load Subjects.");
        }
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    }

    void loadSubjects();

    return () => {
      cancelled = true;
    };
  }, [canReadSubjects, subjectPicker]);

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
        {document.definition.items.map((item) =>
          item.type === "subject" ? (
            <SubjectField
              key={item.id}
              item={item}
              subjectType={subjectTypesByKey.get(item.subjectTypeKey)}
              value={values[item.id]}
              errors={errors}
              disabled={!canMutate || busy}
              canSelectExisting={canReadSubjects}
              onSelectExisting={openSubjectPicker}
              onChange={(value) => {
                setFormValues({
                  ...values,
                  [item.id]: value,
                });
              }}
            />
          ) : (
            <FormField
              key={item.id}
              item={item}
              value={values[item.id]}
              error={errors[item.id]}
              disabled={!canMutate || busy}
              onChange={(value) => onChange(item.id, value)}
            />
          ),
        )}
      </div>
      {subjectError && <p className="text-xs text-destructive">{subjectError}</p>}

      {canMutate ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button type="button" variant="outline" size="sm" disabled={busy || !dirty} onClick={onReset}>
            <RotateCcw className="size-4" />
            Discard changes
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={busy || !dirty} onClick={onSave}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save progress
          </Button>
          <Button type="button" size="sm" disabled={busy || !complete} onClick={onComplete}>
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
      <SubjectPickerDialog
        picker={subjectPicker}
        subjects={pickerSubjects}
        selectedSubjectId={selectedPickerSubjectId}
        loading={pickerLoading}
        error={pickerError}
        onSelectedSubjectIdChange={setSelectedPickerSubjectId}
        onCancel={() => setSubjectPicker(null)}
        onConfirm={() => {
          if (!subjectPicker) return;
          const selectedSubject = pickerSubjects.find(
            (subject) => String(subject.id) === selectedPickerSubjectId,
          );
          if (!selectedSubject) return;
          subjectPicker.onSelect(selectedSubject);
          setSubjectPicker(null);
        }}
      />
    </section>
  );
}

function SubjectField({
  item,
  subjectType,
  value,
  errors,
  disabled,
  canSelectExisting,
  onSelectExisting,
  onChange,
}: {
  item: SubjectItem;
  subjectType?: SubjectType;
  value: FormValue | undefined;
  errors: Record<string, string>;
  disabled: boolean;
  canSelectExisting: boolean;
  onSelectExisting: (
    item: SubjectItem,
    subjectType: SubjectType | undefined,
    onSelect: (subject: Subject) => void,
  ) => void;
  onChange: (value: SubjectValues[]) => void;
}) {
  const entries = Array.isArray(value) ? value : [];
  const subjectLabel = subjectType?.label ?? item.subjectTypeKey;

  function addEntry() {
    onChange([...entries, {}]);
  }

  function addExistingSubject(subject: Subject) {
    onChange([...entries, extractSelectedValues(subject.values_json, item.selectedProperties)]);
  }

  function removeEntry(index: number) {
    onChange(entries.filter((_entry, entryIndex) => entryIndex !== index));
  }

  function updateEntry(index: number, propertyKey: string, nextValue: SubjectPropertyValue | undefined) {
    onChange(
      entries.map((entry, entryIndex) => {
        if (entryIndex !== index) return entry;
        const nextEntry = { ...entry };
        if (nextValue === undefined || nextValue === null || isEmptyTable(nextValue)) {
          delete nextEntry[propertyKey];
        } else {
          nextEntry[propertyKey] = nextValue;
        }
        return nextEntry;
      }),
    );
  }

  return (
    <section className="grid gap-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">
            {item.label}
            {item.required && <span className="ml-1 text-destructive">*</span>}
          </h3>
          {item.helpText && (
            <p className="text-xs text-muted-foreground">{item.helpText}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={addEntry}>
            <Plus className="size-4" />
            Add {subjectLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || !canSelectExisting}
            onClick={() => onSelectExisting(item, subjectType, addExistingSubject)}
          >
            <ChevronDown className="size-4" />
            Select existing
          </Button>
        </div>
      </div>

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">No {subjectLabel} entries.</p>
      )}

      {entries.map((entry, entryIndex) => (
        <div key={entryIndex} className="grid gap-3 rounded-md border bg-muted/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-medium text-muted-foreground">
              {subjectLabel} {entryIndex + 1}
            </h4>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={disabled}
              aria-label={`Remove ${subjectLabel} ${entryIndex + 1}`}
              onClick={() => removeEntry(entryIndex)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-3">
            {item.selectedProperties.map((selection) => (
              <SubjectSelectionControl
                key={selection.key}
                itemId={item.id}
                entryIndex={entryIndex}
                selection={selection}
                subjectType={subjectType}
                value={entry[selection.key]}
                errors={errors}
                disabled={disabled}
                onChange={(nextValue) => updateEntry(entryIndex, selection.key, nextValue)}
              />
            ))}
          </div>
        </div>
      ))}

      {errors[item.id] && <p className="text-xs text-destructive">{errors[item.id]}</p>}
    </section>
  );
}

function SubjectSelectionControl({
  itemId,
  entryIndex,
  selection,
  subjectType,
  value,
  errors,
  disabled,
  onChange,
}: {
  itemId: string;
  entryIndex: number;
  selection: SubjectPropertySelection;
  subjectType?: SubjectType;
  value: SubjectPropertyValue | undefined;
  errors: Record<string, string>;
  disabled: boolean;
  onChange: (value: SubjectPropertyValue | undefined) => void;
}) {
  const property = subjectType?.properties.find(
    (candidate) => candidate.key === selection.key,
  );

  if (property?.kind === "complex" && "columns" in selection) {
    const rows = Array.isArray(value) ? value : [];
    const columns = selection.columns
      .map((columnSelection) =>
        property.properties.find((column) => column.key === columnSelection.key),
      )
      .filter((column): column is SubjectSimplePropertyDefinition => Boolean(column));

    return (
      <SubjectTableControl
        label={property.label}
        columns={columns}
        rows={rows}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  const simpleProperty =
    property?.kind === "simple"
      ? property
      : {
          kind: "simple" as const,
          key: selection.key,
          label: selection.key,
          valueType: "text" as const,
        };

  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{simpleProperty.label}</span>
      <SubjectScalarControl
        property={simpleProperty}
        value={scalarValue(value)}
        disabled={disabled}
        onChange={onChange}
      />
      {errors[subjectErrorKey(itemId, entryIndex, selection.key)] && (
        <span className="text-xs text-destructive">
          {errors[subjectErrorKey(itemId, entryIndex, selection.key)]}
        </span>
      )}
    </label>
  );
}

function SubjectTableControl({
  label,
  columns,
  rows,
  disabled,
  onChange,
}: {
  label: string;
  columns: readonly SubjectSimplePropertyDefinition[];
  rows: SubjectComplexRowValue[];
  disabled: boolean;
  onChange: (value: SubjectComplexRowValue[]) => void;
}) {
  function updateCell(rowIndex: number, columnKey: string, value: SubjectScalarValue) {
    onChange(
      rows.map((row, index) =>
        index === rowIndex ? { ...row, [columnKey]: value } : row,
      ),
    );
  }

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...rows, {}])}
        >
          <Plus className="size-4" />
          Add row
        </Button>
      </div>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="grid gap-2 rounded-md border p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Row {rowIndex + 1}</span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {columns.map((column) => (
              <label key={column.key} className="grid gap-1 text-sm">
                <span>{column.label}</span>
                <SubjectScalarControl
                  property={column}
                  value={row[column.key] ?? null}
                  disabled={disabled}
                  onChange={(nextValue) => updateCell(rowIndex, column.key, nextValue)}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function SubjectScalarControl({
  property,
  value,
  disabled,
  onChange,
}: {
  property: SubjectSimplePropertyDefinition;
  value: SubjectScalarValue;
  disabled: boolean;
  onChange: (value: SubjectScalarValue) => void;
}) {
  if (property.valueType === "boolean") {
    return (
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={typeof value === "boolean" ? String(value) : ""}
        disabled={disabled}
        onChange={(event) => {
          if (!event.target.value) onChange(null);
          else onChange(event.target.value === "true");
        }}
      >
        <option value="">Select yes or no</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (property.valueType === "select") {
    return (
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">Select an option</option>
        {(property.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Input
      type={property.valueType === "date" ? "date" : property.valueType === "number" || property.valueType === "currency" ? "number" : "text"}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
      disabled={disabled}
      onChange={(event) =>
        onChange(
          property.valueType === "number" || property.valueType === "currency"
            ? Number(event.target.value)
            : event.target.value,
        )
      }
    />
  );
}

function SubjectPickerDialog({
  picker,
  subjects,
  selectedSubjectId,
  loading,
  error,
  onSelectedSubjectIdChange,
  onCancel,
  onConfirm,
}: {
  picker: {
    item: SubjectItem;
    subjectType?: SubjectType;
  } | null;
  subjects: Subject[];
  selectedSubjectId: string;
  loading: boolean;
  error: string;
  onSelectedSubjectIdChange: (subjectId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const subjectLabel = picker?.subjectType?.label ?? picker?.item.subjectTypeKey ?? "Subject";
  const selectedSubject = subjects.find(
    (subject) => String(subject.id) === selectedSubjectId,
  );

  return (
    <Dialog open={Boolean(picker)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select existing {subjectLabel}</DialogTitle>
          <DialogDescription>
            Choose an active {subjectLabel} already saved for this Provider.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading Subjects...</p>
          ) : subjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active {subjectLabel} Subjects are available.
            </p>
          ) : (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{subjectLabel}</span>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedSubjectId}
                onChange={(event) => onSelectedSubjectIdChange(event.target.value)}
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.display_name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={loading || !selectedSubject} onClick={onConfirm}>
            Add selected {subjectLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function extractSelectedValues(
  values: SubjectValues,
  selections: readonly SubjectPropertySelection[],
) {
  const extracted: SubjectValues = {};
  for (const selection of selections) {
    const value = values[selection.key];
    if (value !== undefined) extracted[selection.key] = value;
  }
  return extracted;
}

function scalarValue(value: SubjectPropertyValue | undefined): SubjectScalarValue {
  return value === undefined || Array.isArray(value) ? null : value;
}

function isEmptyTable(value: SubjectPropertyValue) {
  return Array.isArray(value) && value.length === 0;
}

function subjectErrorKey(itemId: string, entryIndex: number, propertyKey: string) {
  return `${itemId}.${entryIndex}.${propertyKey}`;
}
