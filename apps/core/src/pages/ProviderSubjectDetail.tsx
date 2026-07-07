import type {
  Subject,
  SubjectComplexRowValue,
  SubjectPayload,
  SubjectPropertyValue,
  SubjectScalarValue,
  SubjectSimplePropertyDefinition,
  SubjectType,
  SubjectValues,
} from "@frontend/api/onboarding/types";
import {
  archiveProviderSubject,
  createProviderSubject,
  getProviderSubject,
  listSubjectTypes,
  updateProviderSubject,
} from "@frontend/api/onboarding/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@frontend/shadcn/components/ui/breadcrumb";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Checkbox } from "@frontend/shadcn/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@frontend/shadcn/components/ui/dialog";
import { Input } from "@frontend/shadcn/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn/components/ui/select";
import { Textarea } from "@frontend/shadcn/components/ui/textarea";
import { Archive, Plus, Save, Trash2, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Page from "../components/Page";
import Status from "../components/Status";
import { CORE_ROUTES } from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";

type SubjectDraft = {
  subject_type_key: string;
  values: SubjectValues;
};

const emptySelectValue = "__empty_value";

const ProviderSubjectDetail = () => {
  const navigate = useNavigate();
  const { subjectId } = useParams();
  const { hasPermission } = useCurrentUser();
  const isNew = subjectId === "new";
  const canEditSubjects = hasPermission("provider-subjects:edit");
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>([]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [draft, setDraft] = useState<SubjectDraft | null>(null);
  const [initialDraft, setInitialDraft] = useState<SubjectDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedSubjectType = useMemo(
    () =>
      subjectTypes.find((subjectType) => subjectType.key === draft?.subject_type_key) ??
      null,
    [draft?.subject_type_key, subjectTypes],
  );
  const isDirty = Boolean(
    draft &&
      initialDraft &&
      JSON.stringify(draft) !== JSON.stringify(initialDraft),
  );
  const isArchived = Boolean(subject?.archived_at);
  const canSave = canEditSubjects && !isArchived;

  async function loadSubject() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const typeResult = await listSubjectTypes();
      setSubjectTypes(typeResult.subjectTypes);

      if (isNew) {
        const firstType = typeResult.subjectTypes[0];
        const nextDraft = {
          subject_type_key: firstType?.key ?? "",
          values: {},
        };
        setSubject(null);
        setDraft(nextDraft);
        setInitialDraft(nextDraft);
        return;
      }

      const id = Number(subjectId);
      if (!Number.isInteger(id) || id <= 0) {
        throw new Error("Subject id is invalid.");
      }

      const subjectResult = await getProviderSubject(id);
      const nextDraft = toDraft(subjectResult.subject);
      setSubject(subjectResult.subject);
      setDraft(nextDraft);
      setInitialDraft(nextDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Subject.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSubject();
  }, [subjectId]);

  function updateDraft(patch: Partial<SubjectDraft>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function updateValue(key: string, value: SubjectPropertyValue | undefined) {
    setDraft((current) => {
      if (!current) return current;

      const nextValues = { ...current.values };
      if (value === undefined || value === null || isEmptyTableValue(value)) {
        delete nextValues[key];
      } else {
        nextValues[key] = value;
      }

      return { ...current, values: nextValues };
    });
  }

  function changeSubjectType(subjectTypeKey: string) {
    updateDraft({
      subject_type_key: subjectTypeKey,
      values: {},
    });
  }

  function discardDraft() {
    if (isNew) {
      navigate(CORE_ROUTES.providerSubjects);
      return;
    }
    if (initialDraft) setDraft(initialDraft);
    setMessage("");
    setError("");
  }

  async function saveSubject() {
    if (!draft || !canSave) return;

    const payload: SubjectPayload = {
      subject_type_key: draft.subject_type_key,
      values: draft.values,
    };

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const result =
        isNew
          ? await createProviderSubject(payload)
          : await updateProviderSubject(Number(subjectId), payload);
      const nextDraft = toDraft(result.subject);
      setSubject(result.subject);
      setDraft(nextDraft);
      setInitialDraft(nextDraft);
      setMessage("Subject saved.");

      if (isNew) {
        navigate(CORE_ROUTES.providerSubject(result.subject.id), { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Subject.");
    } finally {
      setSaving(false);
    }
  }

  async function archiveSubject() {
    if (!subject || !canEditSubjects || isDirty) return;

    setArchiving(true);
    setMessage("");
    setError("");

    try {
      await archiveProviderSubject(subject.id);
      navigate(CORE_ROUTES.providerSubjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not archive Subject.");
      setConfirmArchiveOpen(false);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <Page title={null}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            {isDirty ? (
              <BreadcrumbPage className="text-muted-foreground">Subjects</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <Link to={CORE_ROUTES.providerSubjects}>Subjects</Link>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>
              {isNew ? "New Subject" : subject?.display_name ?? "Subject"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {draft && selectedSubjectType ? (
        <div className="grid gap-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="grid gap-5">
              <div className="grid gap-2">
                <span className="text-sm font-medium">Subject type</span>
                <Select
                  value={draft.subject_type_key}
                  disabled={!isNew || !canSave || saving}
                  onValueChange={changeSubjectType}
                >
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue placeholder="Subject type" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectTypes.map((subjectType) => (
                      <SelectItem key={subjectType.key} value={subjectType.key}>
                        {subjectType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4">
                {selectedSubjectType.properties.map((property) => (
                  <div className="grid gap-2" key={property.key}>
                    {property.kind === "simple" ? (
                      <>
                        <label
                          className="text-sm font-medium"
                          htmlFor={`subject-${property.key}`}
                        >
                          {property.label}
                          {property.required ? " *" : ""}
                        </label>
                        {renderSimplePropertyControl({
                          property,
                          disabled: !canSave || saving,
                          value: scalarValue(draft.values[property.key]),
                          onChange: (value) => updateValue(property.key, value),
                        })}
                      </>
                    ) : (
                      <SubjectTableEditor
                        label={property.label}
                        columns={property.properties}
                        rows={tableValue(draft.values[property.key])}
                        disabled={!canSave || saving}
                        onChange={(rows) => updateValue(property.key, rows)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="h-fit rounded-md border p-4 text-sm">
              <dl className="grid gap-3">
                <div>
                  <dt className="text-muted-foreground">Display name</dt>
                  <dd>{subject?.display_name ?? "Derived when saved"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>{isArchived ? "Archived" : "Active"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>{selectedSubjectType.label}</dd>
                </div>
                {subject && (
                  <>
                    <div>
                      <dt className="text-muted-foreground">Created</dt>
                      <dd>{formatDateTime(subject.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Updated</dt>
                      <dd>{formatDateTime(subject.updated_at)}</dd>
                    </div>
                  </>
                )}
              </dl>
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {!isNew && canEditSubjects && !isArchived && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={isDirty || archiving}
                  onClick={() => setConfirmArchiveOpen(true)}
                >
                  <Archive className="size-4" />
                  Archive
                </Button>
              )}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={discardDraft}
              >
                <Undo2 className="size-4" />
                Discard
              </Button>
              {canSave && (
                <Button
                  type="button"
                  disabled={!isDirty || saving}
                  onClick={saveSubject}
                >
                  <Save className="size-4" />
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {loading ? "Loading Subject." : "Subject unavailable."}
        </div>
      )}

      <Dialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Subject</DialogTitle>
            <DialogDescription>
              This Subject will be hidden from the active list. Existing form
              responses are not changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={archiving}
              onClick={() => setConfirmArchiveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={archiving}
              onClick={archiveSubject}
            >
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Status message={message} error={error} />
    </Page>
  );
};

function SubjectTableEditor({
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
  onChange: (rows: SubjectComplexRowValue[]) => void;
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
        <h3 className="text-sm font-medium">{label}</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => onChange([...rows, {}])}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rows.</p>
      ) : (
        <div className="grid gap-3">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="grid gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Row {rowIndex + 1}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Remove ${label} row ${rowIndex + 1}`}
                  onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {columns.map((column) => (
                  <label key={column.key} className="grid gap-1 text-sm">
                    <span className="font-medium">{column.label}</span>
                    {renderSimplePropertyControl({
                      property: column,
                      disabled,
                      value: row[column.key] ?? null,
                      onChange: (value) => updateCell(rowIndex, column.key, value),
                    })}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function renderSimplePropertyControl({
  property,
  disabled,
  value,
  onChange,
}: {
  property: SubjectSimplePropertyDefinition;
  disabled: boolean;
  value: SubjectScalarValue;
  onChange: (value: SubjectScalarValue) => void;
}) {
  const id = `subject-${property.key}`;

  if (property.valueType === "long_text") {
    return (
      <Textarea
        id={id}
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (property.valueType === "select") {
    return (
      <Select
        value={typeof value === "string" && value ? value : emptySelectValue}
        disabled={disabled}
        onValueChange={(nextValue) =>
          onChange(nextValue === emptySelectValue ? null : nextValue)
        }
      >
        <SelectTrigger id={id} className="w-full sm:w-80">
          <SelectValue placeholder={property.label} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={emptySelectValue}>Not set</SelectItem>
          {(property.options ?? []).map((option) => (
            <SelectItem key={option} value={option}>
              {formatOption(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (property.valueType === "boolean") {
    return (
      <label className="flex min-h-9 w-fit items-center gap-2 text-sm">
        <Checkbox
          id={id}
          checked={value === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        Yes
      </label>
    );
  }

  return (
    <Input
      id={id}
      type={property.valueType === "date" ? "date" : property.valueType === "number" || property.valueType === "currency" ? "number" : "text"}
      inputMode={property.valueType === "phone" ? "tel" : undefined}
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

function scalarValue(value: SubjectPropertyValue | undefined): SubjectScalarValue {
  return value === undefined || Array.isArray(value) ? null : value;
}

function tableValue(value: SubjectPropertyValue | undefined): SubjectComplexRowValue[] {
  return Array.isArray(value) ? value : [];
}

function isEmptyTableValue(value: SubjectPropertyValue) {
  return Array.isArray(value) && value.length === 0;
}

function toDraft(subject: Subject): SubjectDraft {
  return {
    subject_type_key: subject.subject_type_key,
    values: subject.values_json,
  };
}

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString() : "-";
}

function formatOption(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default ProviderSubjectDetail;
