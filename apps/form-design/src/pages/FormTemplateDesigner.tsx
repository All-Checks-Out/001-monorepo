import type { FormItem, FormItemType, FormTemplateSchema } from "@frontend/api/onboarding/types";
import { createAssociationFormTemplate, getAssociationFormTemplate, updateAssociationFormTemplate } from "@frontend/api/onboarding/client";
import { Button } from "@frontend/shadcn/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@frontend/shadcn/components/ui/dropdown-menu";
import { Input } from "@frontend/shadcn/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@frontend/shadcn/components/ui/table";
import { ChevronDown, Edit, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DesignerShell } from "../components/DesignerShell";
import { FormPreview } from "../components/FormPreview";
import { ItemEditorDialog } from "../components/ItemEditorDialog";
import { Status } from "../components/Status";
import { FORM_DESIGN_ROUTES } from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";

interface DesignerPlaceholderProps {
  mode: "new" | "edit";
}

const FORM_ITEM_TYPES: { type: FormItemType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "textarea", label: "Long text" },
  { type: "date", label: "Date" },
  { type: "phone", label: "Phone" },
  { type: "select", label: "Dropdown" },
  { type: "radio", label: "Radio options" },
  { type: "boolean", label: "Yes/No" },
];

const EMPTY_SCHEMA: FormTemplateSchema = {
  version: 1,
  items: [],
};

type ItemDialogState = {
  mode: "add" | "edit";
  initialItem: FormItem;
  draftItem: FormItem;
};

function createDefaultItem(type: FormItemType): FormItem {
  const base = {
    id: createStableItemId(),
    label: getDefaultItemLabel(type),
    required: false,
  };

  switch (type) {
    case "text":
      return { ...base, type, placeholder: "" };
    case "textarea":
      return { ...base, type, placeholder: "" };
    case "date":
      return { ...base, type };
    case "phone":
      return { ...base, type, placeholder: "" };
    case "select":
      return { ...base, type, options: ["Option 1"] };
    case "radio":
      return { ...base, type, options: ["Option 1"] };
    case "boolean":
      return { ...base, type };
  }
}

function createStableItemId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDefaultItemLabel(type: FormItemType) {
  switch (type) {
    case "text":
      return "Text field";
    case "textarea":
      return "Long text field";
    case "date":
      return "Date field";
    case "phone":
      return "Phone field";
    case "select":
      return "Dropdown field";
    case "radio":
      return "Radio options field";
    case "boolean":
      return "Yes/No field";
  }
}

function getItemTypeLabel(type: FormItemType) {
  return FORM_ITEM_TYPES.find((itemType) => itemType.type === type)?.label ?? type;
}

function cloneFormItem(item: FormItem): FormItem {
  return JSON.parse(JSON.stringify(item)) as FormItem;
}

function isSameFormItem(nextItem: FormItem, initialItem: FormItem) {
  return (
    JSON.stringify(normalizeItemForDirtyCheck(nextItem)) ===
    JSON.stringify(normalizeItemForDirtyCheck(initialItem))
  );
}

function normalizeItemForDirtyCheck(item: FormItem): FormItem {
  const nextItem = cloneFormItem(item);

  if (nextItem.helpText === "") {
    delete nextItem.helpText;
  }

  if (
    nextItem.type === "text" ||
    nextItem.type === "textarea" ||
    nextItem.type === "phone"
  ) {
    return {
      ...nextItem,
      placeholder: nextItem.placeholder || undefined,
    };
  }

  if (nextItem.type === "select" || nextItem.type === "radio") {
    return {
      ...nextItem,
      options: nextItem.options.map((option) => option.trim()).filter(Boolean),
    };
  }

  return nextItem;
}

function validateItemDraft(item: FormItem) {
  if (!item.label.trim()) return "Label is required.";

  if (
    (item.type === "select" || item.type === "radio") &&
    item.options.filter((option) => option.trim()).length === 0
  ) {
    return "Add at least one option before saving.";
  }

  return "";
}

function normalizeItemForDraftSave(item: FormItem): FormItem {
  const nextItem = cloneFormItem(item);

  if (nextItem.type === "select" || nextItem.type === "radio") {
    return {
      ...nextItem,
      options: nextItem.options.map((option) => option.trim()).filter(Boolean),
    };
  }

  if (
    nextItem.type === "text" ||
    nextItem.type === "textarea" ||
    nextItem.type === "phone"
  ) {
    return {
      ...nextItem,
      placeholder: nextItem.placeholder?.trim() || undefined,
    };
  }

  return nextItem;
}

function validateTemplate(shortName: string, schema: FormTemplateSchema) {
  if (!shortName.trim()) return "Short name is required.";

  for (const item of schema.items) {
    if (!item.id) return "Every item must have a stable ID.";
    if (!item.label.trim()) return "Every item needs a label before saving.";
    if (
      (item.type === "select" || item.type === "radio") &&
      item.options.filter((option) => option.trim()).length === 0
    ) {
      return `${item.label} needs at least one option before saving.`;
    }
  }

  return "";
}

function normalizeSchemaForSave(schema: FormTemplateSchema): FormTemplateSchema {
  return {
    version: 1,
    items: schema.items.map((item) => {
      if (item.type === "select" || item.type === "radio") {
        return {
          ...item,
          options: item.options.map((option) => option.trim()).filter(Boolean),
        };
      }

      return item;
    }),
  };
}

export const FormTemplateDesigner = ({ mode }: DesignerPlaceholderProps) => {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const [searchParams] = useSearchParams();
  const { loading: userLoading, hasPermission } = useCurrentUser();
  const canEditForms = hasPermission("association-forms:edit");
  const readOnly =
    mode === "edit" && (searchParams.get("mode") === "read-only" || !canEditForms);
  const parsedTemplateId = mode === "edit" ? Number(templateId) : null;
  const [currentTemplateId, setCurrentTemplateId] = useState<number | null>(
    Number.isFinite(parsedTemplateId) ? parsedTemplateId : null,
  );
  const [shortName, setShortName] = useState("");
  const [description, setDescription] = useState("");
  const [schema, setSchema] = useState<FormTemplateSchema>(EMPTY_SCHEMA);
  const [itemDialog, setItemDialog] = useState<ItemDialogState | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(mode === "new");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const itemDialogDirty = Boolean(
    itemDialog && !isSameFormItem(itemDialog.draftItem, itemDialog.initialItem),
  );
  const itemDialogError = itemDialog
    ? validateItemDraft(itemDialog.draftItem)
    : "";
  const canSaveItemDialog = Boolean(
    itemDialog && itemDialogDirty && !itemDialogError,
  );

  useEffect(() => {
    if (userLoading) return;

    if (mode === "edit" && !currentTemplateId) {
      setError("The requested form template could not be found.");
      setLoadingTemplate(false);
      return;
    }

    if (mode !== "edit" || !currentTemplateId) {
      setLoadingTemplate(false);
      return;
    }

    const templateIdToLoad = currentTemplateId;
    let cancelled = false;
    setLoadingTemplate(true);
    setError("");

    async function loadTemplate() {
      try {
        const result = await getAssociationFormTemplate(templateIdToLoad);
        if (cancelled) return;

        setShortName(result.formTemplate.short_name);
        setDescription(result.formTemplate.description);
        setSchema(result.formTemplate.schema_json);
        setItemDialog(null);
        setDirty(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load form template.");
        }
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    }

    void loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [mode, currentTemplateId, userLoading]);

  function closeDesigner() {
    if (dirty && !window.confirm("Close without saving your changes?")) {
      return;
    }

    navigate(FORM_DESIGN_ROUTES.associationForms, { replace: true });
  }

  function markDirty() {
    if (readOnly) return;

    setDirty(true);
    setMessage("");
    setError("");
  }

  function setMetadata(field: "shortName" | "description", value: string) {
    if (field === "shortName") {
      setShortName(value);
    } else {
      setDescription(value);
    }
    markDirty();
  }

  function openAddItemDialog(type: FormItemType) {
    if (readOnly || !canEditForms) return;

    const item = createDefaultItem(type);
    setItemDialog({
      mode: "add",
      initialItem: cloneFormItem(item),
      draftItem: item,
    });
    setMessage("");
    setError("");
  }

  function openEditItemDialog(item: FormItem) {
    if (readOnly || !canEditForms) return;

    setItemDialog({
      mode: "edit",
      initialItem: cloneFormItem(item),
      draftItem: cloneFormItem(item),
    });
    setMessage("");
    setError("");
  }

  function closeItemDialog() {
    if (
      itemDialogDirty &&
      !window.confirm("Discard item changes? These changes have not been applied.")
    ) {
      return;
    }

    setItemDialog(null);
  }

  function saveItemDialog() {
    if (readOnly || !itemDialog || !canSaveItemDialog) return;

    const nextItem = normalizeItemForDraftSave(itemDialog.draftItem);

    setSchema((current) => ({
      ...current,
      items:
        itemDialog.mode === "add"
          ? [...current.items, nextItem]
          : current.items.map((item) =>
              item.id === nextItem.id ? nextItem : item,
            ),
    }));
    setItemDialog(null);
    markDirty();
  }

  function updateItemDialog(updater: (item: FormItem) => FormItem) {
    setItemDialog((current) =>
      current
        ? {
            ...current,
            draftItem: updater(current.draftItem),
          }
        : current,
    );
  }

  function deleteItem(item: FormItem) {
    if (readOnly || !canEditForms) return;

    if (
      !window.confirm(
        `Delete ${item.label || "this item"} now? This change is immediate within the draft template.`,
      )
    ) {
      return;
    }

    setSchema((current) => ({
      ...current,
      items: current.items.filter((currentItem) => currentItem.id !== item.id),
    }));
    markDirty();
  }

  function updateItemDialogOption(index: number, value: string) {
    updateItemDialog((item) => {
      if (item.type !== "select" && item.type !== "radio") return item;

      return {
        ...item,
        options: item.options.map((option, optionIndex) =>
          optionIndex === index ? value : option,
        ),
      };
    });
  }

  function addItemDialogOption() {
    updateItemDialog((item) => {
      if (item.type !== "select" && item.type !== "radio") return item;

      return {
        ...item,
        options: [...item.options, `Option ${item.options.length + 1}`],
      };
    });
  }

  function deleteItemDialogOption(index: number) {
    updateItemDialog((item) => {
      if (item.type !== "select" && item.type !== "radio") return item;

      return {
        ...item,
        options: item.options.filter((_option, optionIndex) => optionIndex !== index),
      };
    });
  }

  async function saveTemplate() {
    if (readOnly || !canEditForms) return;

    if (mode === "edit" && currentTemplateId === null) {
      setError("The requested form template could not be found.");
      setMessage("");
      return;
    }

    const validationError = validateTemplate(shortName, schema);
    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const payload = {
      short_name: shortName.trim(),
      description: description.trim(),
      schema_json: normalizeSchemaForSave(schema),
    };

    try {
      const result =
        currentTemplateId === null
          ? await createAssociationFormTemplate(payload)
          : await updateAssociationFormTemplate(currentTemplateId, payload);

      setCurrentTemplateId(result.formTemplate.id);
      setShortName(result.formTemplate.short_name);
      setDescription(result.formTemplate.description);
      setSchema(result.formTemplate.schema_json);
      setDirty(false);
      setMessage("Saved.");

      if (currentTemplateId === null) {
        navigate(
          FORM_DESIGN_ROUTES.associationFormDesigner(result.formTemplate.id),
          { replace: true },
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save form template.");
    } finally {
      setSaving(false);
    }
  }

  const saveLabel = saving ? "Saving..." : "Save";
  const breadcrumbPage =
    mode === "new" ? "New form template" : shortName || "Form template";

  if (userLoading || loadingTemplate) {
    return (
      <DesignerShell
        breadcrumbPage={breadcrumbPage}
        disableFormsBreadcrumb={dirty}
      >
        <div className="grid flex-1 place-items-center p-6 text-sm text-muted-foreground">
          Loading designer...
        </div>
      </DesignerShell>
    );
  }

  if (!canEditForms && !readOnly) {
    return (
      <DesignerShell
        breadcrumbPage={breadcrumbPage}
        disableFormsBreadcrumb={dirty}
      >
        <div className="grid flex-1 place-items-center p-6 text-sm text-destructive">
          You do not have permission to edit form templates.
        </div>
      </DesignerShell>
    );
  }

  return (
    <DesignerShell
      breadcrumbPage={breadcrumbPage}
      disableFormsBreadcrumb={dirty}
      action={
        readOnly ? (
          <Button type="button" variant="outline" onClick={closeDesigner}>
            Close
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={closeDesigner}>
              Cancel
            </Button>
            <Button onClick={saveTemplate} disabled={saving}>
              <Save className="size-4" />
              {saveLabel}
            </Button>
          </>
        )
      }
    >
      <div className="grid min-h-[calc(100dvh-12rem)] grid-cols-1 rounded-md border xl:grid-cols-[minmax(500px,0.9fr)_minmax(460px,1.1fr)]">
        <section className="grid min-h-0 content-start gap-3 overflow-auto border-b p-3 lg:border-r lg:border-b-0">
          <div className="grid gap-2">
            <div className="grid gap-2">
              <label className="grid gap-0.5 text-sm font-medium sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-2">
                <span>Short name</span>
                <Input
                  value={shortName}
                  disabled={readOnly}
                  onChange={(event) => setMetadata("shortName", event.target.value)}
                  placeholder="Supplier onboarding"
                />
              </label>
              <label className="grid gap-0.5 text-sm font-medium sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-2">
                <span>Description</span>
                <Input
                  value={description}
                  disabled={readOnly}
                  onChange={(event) => setMetadata("description", event.target.value)}
                  placeholder="Reusable form description"
                />
              </label>
            </div>
            <Status message={message} error={error} />
          </div>

          {!readOnly && (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" />
                  Add item
                  <ChevronDown className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {FORM_ITEM_TYPES.map((itemType) => (
                  <DropdownMenuItem
                    key={itemType.type}
                    onSelect={() => openAddItemDialog(itemType.type)}
                  >
                    {itemType.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          )}

          <div className="relative w-full overflow-hidden rounded-md border">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead className="w-28">Type</TableHead>
                  <TableHead className="w-20">Required</TableHead>
                  {!readOnly && <TableHead className="w-12">Edit</TableHead>}
                  {!readOnly && <TableHead className="w-14">Delete</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {schema.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      className="py-4 text-muted-foreground"
                      colSpan={readOnly ? 4 : 6}
                    >
                      {readOnly
                        ? "No fields in this form."
                        : "Add the first field to start building this form."}
                    </TableCell>
                  </TableRow>
                )}
                {schema.items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="min-w-0 font-medium">
                      <div className="truncate" title={item.label || "Untitled item"}>
                        {item.label || "Untitled item"}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-0 text-muted-foreground">
                      <div className="truncate" title={getItemTypeLabel(item.type)}>
                        {getItemTypeLabel(item.type)}
                      </div>
                    </TableCell>
                    <TableCell>{item.required ? "Yes" : "No"}</TableCell>
                    {!readOnly && (
                    <TableCell>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Edit ${item.label || "field"}`}
                        title="Edit field"
                        onClick={() => openEditItemDialog(item)}
                      >
                        <Edit className="size-4" />
                      </Button>
                    </TableCell>
                    )}
                    {!readOnly && (
                    <TableCell>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${item.label || "field"}`}
                        title="Delete field"
                        onClick={() => deleteItem(item)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="min-h-0 overflow-auto bg-muted/30 p-3">
          <div className="mx-auto grid w-full max-w-2xl gap-3 rounded-md border bg-background p-4 shadow-xs">
            <div className="border-b pb-2">
              <h2 className="text-base font-semibold">{shortName || "Untitled form"}</h2>
              {description && (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            <FormPreview schema={schema} />
          </div>
        </section>
      </div>
      <ItemEditorDialog
        state={itemDialog}
        error={itemDialogError}
        canSave={canSaveItemDialog}
        onChange={updateItemDialog}
        onOptionChange={updateItemDialogOption}
        onAddOption={addItemDialogOption}
        onDeleteOption={deleteItemDialogOption}
        onCancel={closeItemDialog}
        onSave={saveItemDialog}
      />
    </DesignerShell>
  );
};
