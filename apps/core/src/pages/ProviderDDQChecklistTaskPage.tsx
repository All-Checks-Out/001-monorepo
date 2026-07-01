import { FormDocument, FormValue, FormValues, ProviderDDQChecklistTask, ProviderDDQChecklistTaskEvidence } from "@frontend/api/onboarding/types";
import { completeProviderDDQChecklistTaskFormResponse, getProviderDDQChecklistTask, saveProviderDDQChecklistTaskFormResponse, updateProviderDDQChecklistTaskEvidenceTags, uploadProviderDDQChecklistTaskEvidence, type ProviderDDQChecklistTaskDetailResponse } from "@frontend/api/onboarding/client";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@frontend/shadcn/components/ui/breadcrumb";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Input } from "@frontend/shadcn/components/ui/input";
import { Loader2, RotateCcw, Save, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Page from "../components/Page";
import Status from "../components/Status";
import { CORE_ROUTES } from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";
import { TaskSummary } from "./TaskSummary";
import { FormCompletionWorkspace } from "./FormCompletionWorkspace";
import { TagEditor } from "./TagEditor";
import { ReadOnlyNotice } from "./ReadOnlyNotice";
import { EvidencePreview } from "./EvidencePreview";
import { EvidenceReview } from "./EvidenceReview";
import { DocumentPanel } from "./DocumentPanel";

const maxEvidenceFileSizeBytes = 10 * 1024 * 1024;

function validateFile(file: File, task: ProviderDDQChecklistTask) {
  const contentType = file.type || "application/octet-stream";

  if (file.size < 1) return "File size is required.";
  if (file.size > maxEvidenceFileSizeBytes) return "File must be 10 MB or smaller.";
  if (task.task_type === "photo-upload" && !contentType.startsWith("image/")) {
    return "Photo upload tasks only accept image files.";
  }
  if (
    task.task_type === "document-upload" &&
    contentType !== "application/pdf" &&
    !contentType.startsWith("image/")
  ) {
    return "Document upload tasks only accept PDF or image files.";
  }

  return "";
}

function acceptedFileTypes(task: ProviderDDQChecklistTask) {
  if (task.task_type === "photo-upload") return "image/*";
  if (task.task_type === "document-upload") return "application/pdf,image/*";
  return undefined;
}

function manualTags(evidence: ProviderDDQChecklistTaskEvidence | null) {
  return (evidence?.tags ?? [])
    .filter((tag) => tag.source === "manual")
    .map((tag) => tag.tag)
    .sort();
}

function initialFormValues(state: ProviderDDQChecklistTaskDetailResponse) {
  return {
    ...(state.formResponse?.form_document.values ??
      formDocumentFromTaskConfig(state.task)?.values ??
      {}),
  };
}

function formDocumentForState(
  state: ProviderDDQChecklistTaskDetailResponse,
  values: FormValues,
) {
  const document =
    state.formResponse?.form_document ?? formDocumentFromTaskConfig(state.task);
  if (!document) return null;

  return {
    ...document,
    values,
  };
}

function formDocumentFromTaskConfig(task: ProviderDDQChecklistTask) {
  return isFormDocument(task.config.form) ? task.config.form : null;
}

function isFormDocument(value: unknown): value is FormDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const candidate = value as Record<string, unknown>;
  if (candidate.kind !== "form-document" || candidate.version !== 1) return false;

  const definition = candidate.definition;
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return false;
  }

  return Array.isArray((definition as Record<string, unknown>).items);
}

function validateFormDocumentValues(document: FormDocument) {
  const errors: Record<string, string> = {};
  const values = document.values ?? {};

  for (const item of document.definition.items) {
    const value = values[item.id];
    const hasValue = hasFormValue(value);

    if (item.required && !hasValue) {
      errors[item.id] = "This field is required.";
      continue;
    }
    if (!hasValue) continue;

    if (item.type === "boolean") {
      if (typeof value !== "boolean") errors[item.id] = "Enter yes or no.";
      continue;
    }

    if (typeof value !== "string") {
      errors[item.id] = "Enter a valid value.";
      continue;
    }

    if (item.type === "select" || item.type === "radio") {
      if (!item.options.includes(value)) {
        errors[item.id] = "Choose one of the available options.";
      }
    }
  }

  return errors;
}

function hasFormValue(value: FormValue | undefined) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return typeof value === "boolean";
}

function sameFormValues(left: FormValues, right: FormValues) {
  return JSON.stringify(sortFormValues(left)) === JSON.stringify(sortFormValues(right));
}

function sortFormValues(values: FormValues) {
  return Object.fromEntries(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

function sameStringList(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export const ProviderDDQChecklistTaskPage = () => {
  const { packId, taskId } = useParams();
  const numericPackId = Number(packId);
  const numericTaskId = Number(taskId);
  const { hasPermission } = useCurrentUser();
  const canPerformChecklist = hasPermission("provider-ddq-packs:perform-checks");
  const canViewChecklist =
    canPerformChecklist ||
    hasPermission("provider-ddq-packs:review-checks") ||
    hasPermission("provider-ddq-packs:approve-checks");

  const [state, setState] =
    useState<ProviderDDQChecklistTaskDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [completingForm, setCompletingForm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [tagInput, setTagInput] = useState("");
  const [tagMessage, setTagMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!canViewChecklist) {
      setError("Permission required.");
      return;
    }
    if (
      !Number.isInteger(numericPackId) ||
      numericPackId < 1 ||
      !Number.isInteger(numericTaskId) ||
      numericTaskId < 1
    ) {
      setError("Invalid DDQ Checklist Task.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const result = await getProviderDDQChecklistTask(numericPackId, numericTaskId);
      setState(result);
      setTags(manualTags(result.evidence));
      setFormValues(initialFormValues(result));
    } catch (err) {
      setState(null);
      setError(
        err instanceof Error ? err.message : "Could not load DDQ Checklist Task.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [numericPackId, numericTaskId, canViewChecklist]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const checklist = state?.checklist ?? null;
  const task = state?.task ?? null;
  const evidence = state?.evidence ?? null;
  const isUploadTask = task?.task_type === "document-upload" || task?.task_type === "photo-upload";
  const isFormTask = task?.task_type === "form-completion";
  const formDocument = state ? formDocumentForState(state, formValues) : null;
  const savedFormValues = state ? initialFormValues(state) : {};
  const formErrors = formDocument ? validateFormDocumentValues(formDocument) : {};
  const formComplete = Object.keys(formErrors).length === 0;
  const canMutateEvidence =
    canPerformChecklist &&
    isUploadTask &&
    checklist?.status !== "withdrawn" &&
    task?.status === "active";
  const canMutateForm =
    canPerformChecklist &&
    isFormTask &&
    checklist?.status !== "withdrawn" &&
    task?.status === "active" &&
    Boolean(formDocument);
  const validationError = task && file ? validateFile(file, task) : "";
  const tagsDirty = !sameStringList(tags, manualTags(evidence));
  const formDirty = isFormTask && !sameFormValues(formValues, savedFormValues);
  const isDirty = Boolean(file) || tagsDirty || formDirty;
  const isBusy = uploading || savingTags || savingForm || completingForm;
  const uploadDisabled =
    !canMutateEvidence ||
    isBusy ||
    !file ||
    !previewUrl ||
    Boolean(validationError);
  const saveTagsDisabled =
    !canMutateEvidence ||
    isBusy ||
    !evidence ||
    Boolean(file) ||
    !tagsDirty;

  function onFileChange(nextFile: File | null) {
    setFile(nextFile);
    setMessage("");
    setError("");
  }

  function setFormValue(itemId: string, value: FormValue | undefined) {
    setFormValues((current) => {
      const next = { ...current };
      if (value === undefined) {
        delete next[itemId];
      } else {
        next[itemId] = value;
      }
      return next;
    });
    setMessage("");
    setError("");
  }

  function addTag() {
    const normalized = normalizeTag(tagInput);
    setTagMessage("");

    if (!normalized) return;
    if (tags.includes(normalized)) {
      setTagMessage("Tag already added.");
      setTagInput("");
      return;
    }

    setTags((current) => [...current, normalized].sort());
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((current) => current.filter((candidate) => candidate !== tag));
  }

  function resetDraft() {
    setFile(null);
    setTags(manualTags(evidence));
    setFormValues(savedFormValues);
    setTagInput("");
    setTagMessage("");
    setMessage("");
    setError("");
  }

  async function uploadEvidence() {
    if (!file || !task || uploadDisabled) return;

    setUploading(true);
    setMessage("");
    setError("");

    try {
      const result = await uploadProviderDDQChecklistTaskEvidence(
        numericPackId,
        numericTaskId,
        file,
        tags,
      );
      setFile(null);
      setTagInput("");
      setTags(manualTags(result.evidence));
      setMessage("Evidence uploaded. The task will update after S3 confirms the upload.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload evidence.");
    } finally {
      setUploading(false);
    }
  }

  async function saveTags() {
    if (!evidence || saveTagsDisabled) return;

    setSavingTags(true);
    setMessage("");
    setError("");

    try {
      const result = await updateProviderDDQChecklistTaskEvidenceTags(
        numericPackId,
        numericTaskId,
        evidence.id,
        tags,
      );
      setState(result);
      setTags(manualTags(result.evidence));
      setTagInput("");
      setMessage("Evidence tags saved.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save evidence tags.",
      );
    } finally {
      setSavingTags(false);
    }
  }

  async function saveFormProgress() {
    if (!formDocument || !canMutateForm) return;

    setSavingForm(true);
    setMessage("");
    setError("");

    try {
      const result = await saveProviderDDQChecklistTaskFormResponse(
        numericPackId,
        numericTaskId,
        { values: formValues },
      );
      setState(result);
      setFormValues(initialFormValues(result));
      setMessage("Form progress saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save form progress.");
    } finally {
      setSavingForm(false);
    }
  }

  async function completeFormResponse() {
    if (!formDocument || !canMutateForm) return;

    if (!formComplete) {
      setError("Complete all required form fields before marking this task complete.");
      return;
    }

    setCompletingForm(true);
    setMessage("");
    setError("");

    try {
      const result = await completeProviderDDQChecklistTaskFormResponse(
        numericPackId,
        numericTaskId,
        { values: formValues },
      );
      setState(result);
      setFormValues(initialFormValues(result));
      setMessage("Form completed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete form.");
    } finally {
      setCompletingForm(false);
    }
  }

  return (
    <Page title={null}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild={!isDirty}
              className={isDirty ? "pointer-events-none opacity-50" : undefined}
              aria-disabled={isDirty ? "true" : undefined}
            >
              {isDirty ? (
                <span>DDQ Packs</span>
              ) : (
                <Link to={CORE_ROUTES.providerDDQPacks}>DDQ Packs</Link>
              )}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild={!isDirty && Boolean(state)}
              className={isDirty || !state ? "pointer-events-none opacity-50" : undefined}
              aria-disabled={isDirty || !state ? "true" : undefined}
            >
              {!isDirty && state ? (
                <Link to={CORE_ROUTES.providerDDQPackChecklist(state.pack.id)}>
                  {state.pack.name}
                </Link>
              ) : (
                <span>{state?.pack.name ?? "DDQ Checklist"}</span>
              )}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{task?.title ?? "Task"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {state && task && checklist ? (
        <div className="grid gap-4">
          <TaskSummary checklist={checklist} task={task} />

          {isFormTask ? (
            <FormCompletionWorkspace
              document={formDocument}
              values={formValues}
              errors={formErrors}
              dirty={formDirty}
              complete={formComplete}
              canMutate={canMutateForm}
              busy={isBusy}
              checklist={checklist}
              task={task}
              canPerformChecklist={canPerformChecklist}
              onChange={setFormValue}
              onReset={resetDraft}
              onSave={saveFormProgress}
              onComplete={completeFormResponse}
            />
          ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
            <section className="grid gap-3 border bg-muted/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Evidence</h2>
                {isDirty && <span className="text-xs text-amber-700">Unsaved evidence</span>}
              </div>

              {canMutateEvidence ? (
                <>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">File</span>
                    <Input
                      type="file"
                      accept={acceptedFileTypes(task)}
                      disabled={isBusy}
                      onChange={(event) =>
                        onFileChange(event.target.files?.item(0) ?? null)
                      }
                    />
                  </label>
                  {validationError && (
                    <p className="text-xs text-destructive">{validationError}</p>
                  )}
                  <TagEditor
                    tags={tags}
                    value={tagInput}
                    disabled={isBusy}
                    message={tagMessage}
                    onChange={setTagInput}
                    onAdd={addTag}
                    onRemove={removeTag}
                  />
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy || !isDirty}
                      onClick={resetDraft}
                    >
                      <RotateCcw className="size-4" />
                      Discard changes
                    </Button>
                    {evidence && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saveTagsDisabled}
                        onClick={saveTags}
                      >
                        {savingTags ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        Save tags
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={uploadDisabled}
                      onClick={uploadEvidence}
                    >
                      {uploading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UploadCloud className="size-4" />
                      )}
                      Upload evidence
                    </Button>
                  </div>
                </>
              ) : (
                <ReadOnlyNotice
                  checklist={checklist}
                  task={task}
                  canPerformChecklist={canPerformChecklist}
                />
              )}
            </section>

            <section className="grid gap-3 border bg-muted/10 p-3">
              <h2 className="text-sm font-semibold">Preview</h2>
              {file && previewUrl ? (
                <EvidencePreview
                  name={file.name}
                  contentType={file.type || "application/octet-stream"}
                  fileSizeBytes={file.size}
                  url={previewUrl}
                />
              ) : evidence ? (
                <EvidenceReview evidence={evidence} />
              ) : (
                <DocumentPanel
                  name="No evidence uploaded"
                  contentType="Awaiting upload"
                  fileSizeBytes={0}
                />
              )}
            </section>
          </div>
          )}
        </div>
      ) : (
        <div className="border bg-muted/20 p-4 text-sm text-muted-foreground">
          {loading ? "Loading DDQ Checklist Task." : "DDQ Checklist Task unavailable."}
        </div>
      )}

      <Status message={message} error={error} />
    </Page>
  );
};
