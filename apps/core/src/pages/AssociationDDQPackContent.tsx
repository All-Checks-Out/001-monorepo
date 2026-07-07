import type {
  DDQDocumentType,
  DDQPack,
  DDQPackItem,
  DDQBranchOption,
  DDQPackItemKind,
  DDQTaskType,
  FormTemplateSummary,
} from "@frontend/api/onboarding/types";
import {
  DDQ_DOCUMENT_TYPES,
  DDQ_TASK_DEFINITIONS,
  listDDQPackItems,
  listAssociationFormTemplates,
  saveDDQPackDraft,
  type DDQPackPayload,
  type SaveDDQPackDraftPayload,
} from "@frontend/api/onboarding/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@frontend/shadcn/components/ui/breadcrumb";
import { Badge } from "@frontend/shadcn/components/ui/badge";
import { Button } from "@frontend/shadcn/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@frontend/shadcn/components/ui/dropdown-menu";
import { Input } from "@frontend/shadcn/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/shadcn/components/ui/table";
import { ChevronDown, Edit, FileText, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Page from "../components/Page";
import Status from "../components/Status";
import { CORE_ROUTES } from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";
import { InsertionRow } from "./InsertionRow";


type DraftPackItem = SaveDDQPackDraftPayload["items"][number] & {
  clientId: string;
  id?: number;
  parent_branch_item_client_id: string | null;
};

type PackDraftState = {
  pack: DDQPackPayload;
  items: DraftPackItem[];
};

type ItemFormState = {
  kind: DDQPackItemKind;
  task_type: DDQTaskType;
  title: string;
  document_type: DDQDocumentType;
  form_template_id: number | "";
  branch_options: DDQBranchOption[];
};

type ItemEditSession = {
  mode: "add" | "edit" | "view";
  index: number;
  initialForm: ItemFormState;
};

type BranchParent = {
  branchClientId: string | null;
  optionId: string | null;
};

type DraftItemSection = {
  id: string;
  items: DraftPackItem[];
  startIndex: number;
  appendIndex: number;
};

type TaskTypeFilter = "all" | DDQTaskType | "checkpoint";
type AddItemType = DDQTaskType | "checkpoint" | "branch";

const defaultItemForm: ItemFormState = {
  kind: "ddq-task",
  task_type: "document-upload",
  title: "",
  document_type: "passport",
  form_template_id: "",
  branch_options: [],
};

const addItemOptions: { value: AddItemType; label: string }[] = [
  ...DDQ_TASK_DEFINITIONS.map((definition) => ({
    value: definition.type,
    label: `${definition.label} task`,
  })),
  { value: "checkpoint", label: "Checkpoint" },
  { value: "branch", label: "Branch" },
];

const taskTypeOptions: { value: DDQTaskType; label: string }[] =
  DDQ_TASK_DEFINITIONS.map((definition) => ({
    value: definition.type,
    label: `${definition.label} task`,
  }));

const AssociationDDQPackContent = () => {
  const { hasPermission } = useCurrentUser();
  const { packId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const numericPackId = Number(packId);
  const canEditDDQPacks = hasPermission("association-ddq-packs:edit");
  const readOnly = searchParams.get("mode") === "read-only" || !canEditDDQPacks;
  const [baseline, setBaseline] = useState<PackDraftState | null>(null);
  const [draft, setDraft] = useState<PackDraftState | null>(null);
  const [itemEditSession, setItemEditSession] = useState<ItemEditSession | null>(null);
  const [pendingParent, setPendingParent] = useState<BranchParent>({
    branchClientId: null,
    optionId: null,
  });
  const [form, setForm] = useState<ItemFormState>(defaultItemForm);
  const [taskTypeFilter, setTaskTypeFilter] = useState<TaskTypeFilter>("all");
  const [formTemplates, setFormTemplates] = useState<FormTemplateSummary[]>([]);
  const [formTemplatesLoading, setFormTemplatesLoading] = useState(false);
  const [formTemplatesError, setFormTemplatesError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const nextNewItemId = useRef(1);

  async function load() {
    if (!Number.isInteger(numericPackId) || numericPackId < 1) {
      setError("Invalid DDQ Pack.");
      return;
    }

    const result = await listDDQPackItems(numericPackId);
    const nextDraft = toDraftState(result.pack, result.items);
    setBaseline(nextDraft);
    setDraft(cloneDraftState(nextDraft));
    closeItemForm();
  }

  useEffect(() => {
    async function loadItems() {
      try {
        await load();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not load DDQ Pack Items.",
        );
      }
    }

    void loadItems();
  }, [numericPackId]);

  useEffect(() => {
    if (!canEditDDQPacks || readOnly) return;

    let cancelled = false;
    setFormTemplatesLoading(true);
    setFormTemplatesError("");

    async function loadFormTemplates() {
      try {
        const result = await listAssociationFormTemplates();
        if (!cancelled) setFormTemplates(result.formTemplates);
      } catch (err) {
        if (!cancelled) {
          setFormTemplatesError(
            err instanceof Error ? err.message : "Could not load form templates.",
          );
        }
      } finally {
        if (!cancelled) setFormTemplatesLoading(false);
      }
    }

    void loadFormTemplates();

    return () => {
      cancelled = true;
    };
  }, [canEditDDQPacks, readOnly]);

  function openCreateForm(
    index: number,
    itemType: AddItemType = "document-upload",
    parent: BranchParent = { branchClientId: null, optionId: null },
  ) {
    if (!canEditDDQPacks || !draft) return;

    const nextForm = defaultFormForItemType(itemType);
    setItemEditSession({ mode: "add", index, initialForm: nextForm });
    setPendingParent(parent);
    setForm(nextForm);
    clearStatus();
  }

  function openEditForm(item: DraftPackItem, index: number) {
    if (!canEditDDQPacks) return;

    const nextForm = itemToForm(item);
    setItemEditSession({ mode: "edit", index, initialForm: nextForm });
    setPendingParent({
      branchClientId: item.parent_branch_item_client_id,
      optionId: item.parent_branch_option_id ?? null,
    });
    setForm(nextForm);
    clearStatus();
  }

  function openViewForm(item: DraftPackItem, index: number) {
    const nextForm = itemToForm(item);
    setItemEditSession({ mode: "view", index, initialForm: nextForm });
    setPendingParent({
      branchClientId: item.parent_branch_item_client_id,
      optionId: item.parent_branch_option_id ?? null,
    });
    setForm(nextForm);
    clearStatus();
  }

  async function savePackDraft() {
    if (!draft || !canEditDDQPacks) return;

    setLoading(true);
    clearStatus();

    try {
      const result = await saveDDQPackDraft(numericPackId, draftToPayload(draft));
      const nextDraft = toDraftState(result.pack, result.items);
      setBaseline(nextDraft);
      setDraft(cloneDraftState(nextDraft));
      closeItemForm();
      setMessage("DDQ Pack saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save DDQ Pack.");
    } finally {
      setLoading(false);
    }
  }

  function discardChanges() {
    if (!baseline) return;

    setDraft(cloneDraftState(baseline));
    closeItemForm();
    clearStatus();
  }

  function applyItemForm() {
    if (!draft || !itemEditSession || !canEditDDQPacks) return;

    const existing =
      itemEditSession.mode === "edit" ? draft.items[itemEditSession.index] : null;
    const item = formToDraftItem(
      form,
      existing,
      pendingParent,
      () => `new-${nextNewItemId.current++}`,
    );
    const items = [...draft.items];

    if (itemEditSession.mode === "edit") {
      items[itemEditSession.index] = item;
    } else {
      items.splice(itemEditSession.index, 0, item);
    }

    setDraft({ ...draft, items });
    closeItemForm();
    clearStatus();
  }

  function removeItem(item: DraftPackItem) {
    if (
      !draft ||
      !canEditDDQPacks ||
      !window.confirm(`Remove ${item.title} from this draft?`)
    ) {
      return;
    }

    const removedIds = descendantClientIds(draft.items, item.clientId);
    removedIds.add(item.clientId);
    setDraft({
      ...draft,
      items: draft.items.filter((candidate) => !removedIds.has(candidate.clientId)),
    });
    clearStatus();
  }

  function updatePack(patch: Partial<DDQPackPayload>) {
    if (!draft) return;
    setDraft({ ...draft, pack: { ...draft.pack, ...patch } });
  }

  function closeItemForm() {
    setItemEditSession(null);
    setPendingParent({ branchClientId: null, optionId: null });
    setForm(defaultItemForm);
  }

  function clearStatus() {
    setMessage("");
    setError("");
  }

  const formTitle = useMemo(() => {
    if (!itemEditSession) return "";
    const itemLabel = form.kind === "branch" ? "Branch Item" : "Item";
    if (itemEditSession.mode === "view") return `View ${itemLabel}`;
    return itemEditSession.mode === "edit" ? `Edit ${itemLabel}` : `Add ${itemLabel}`;
  }, [form.kind, itemEditSession]);
  const selectedItemBreadcrumbLabel = itemEditSession
    ? form.title.trim() || formTitle
    : "";
  const isViewingItem = itemEditSession?.mode === "view";
  const hasOpenEditableItemForm = Boolean(
    itemEditSession && itemEditSession.mode !== "view",
  );

  const isPackDirty = Boolean(
    baseline && draft && comparableDraft(draft) !== comparableDraft(baseline),
  );
  const dateRangeError = draft ? packDateRangeError(draft.pack) : "";
  const isPackValid = Boolean(
    draft?.pack.name.trim() &&
      draft.pack.valid_from &&
      draft.pack.valid_to &&
      !dateRangeError,
  );
  const branchOptionError = form.kind === "branch"
    ? validateBranchOptions(form.branch_options)
    : "";
  const isItemDirty = Boolean(
    itemEditSession &&
      itemEditSession.mode !== "view" &&
      comparableForm(form) !== comparableForm(itemEditSession.initialForm),
  );
  const itemBeingEdited =
    draft && (itemEditSession?.mode === "edit" || itemEditSession?.mode === "view")
      ? draft.items[itemEditSession.index]
      : null;
  const isItemValid = Boolean(
    form.title.trim() &&
      (
        form.kind !== "ddq-task" ||
        form.task_type !== "form-completion" ||
        form.form_template_id ||
        formDocumentTitle(itemBeingEdited?.config)
      ),
  );
  const hasOpenItemForm = Boolean(itemEditSession);
  const canCloseItemFromBreadcrumb = Boolean(itemEditSession && !isItemDirty);
  const hasUnsavedEdits =
    !readOnly && (isPackDirty || isItemDirty || hasOpenEditableItemForm);
  const itemActionsDisabled = readOnly || loading || !draft || hasOpenItemForm;
  const viewItemActionDisabled = loading || !draft || hasOpenItemForm;
  const canApplyItemForm = Boolean(
    itemEditSession &&
      itemEditSession.mode !== "view" &&
      isItemValid &&
      !branchOptionError &&
      (itemEditSession.mode === "add" || isItemDirty),
  );
  const visibleItems = readOnly
    ? (draft?.items ?? []).filter(
        (item) =>
          !item.parent_branch_item_client_id &&
          matchesTaskTypeFilter(item, taskTypeFilter),
      )
    : getSiblingItems(draft?.items ?? [], null, null);
  const itemSections = readOnly
    ? [
        {
          id: "read-only-items",
          items: visibleItems,
          startIndex: 0,
          appendIndex: draft?.items.length ?? 0,
        },
      ]
    : splitItemsIntoSections(visibleItems);
  const itemTotal = draft?.items.length ?? 0;
  const itemCountLabel =
    readOnly && taskTypeFilter !== "all"
      ? `${visibleItems.length} of ${itemTotal}`
      : `${itemTotal}`;
  const itemFormPanel = itemEditSession ? (
    <div className="grid gap-3 border-2 border-red-500 bg-muted/20 p-4">
      <h2 className="text-base font-medium">{formTitle}</h2>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
        {form.kind === "ddq-task" && (
          <>
            <select
              aria-label="DDQ task type"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={form.task_type}
              disabled={loading || itemEditSession.mode === "edit" || isViewingItem}
              onChange={(event) => {
                const itemType = parseAddItemType(event.target.value);
                if (itemType) setForm(nextFormForItemType(itemType, form));
              }}
            >
              {taskTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {form.task_type === "document-upload" ? (
              <select
                aria-label="Document type"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.document_type}
                disabled={loading || isViewingItem}
                onChange={(event) =>
                  setForm({
                    ...form,
                    document_type: event.target.value as DDQDocumentType,
                  })
                }
              >
                {DDQ_DOCUMENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            ) : form.task_type === "form-completion" ? (
              <select
                aria-label="Form template"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.form_template_id}
                disabled={loading || formTemplatesLoading || isViewingItem}
                onChange={(event) =>
                  setForm({
                    ...form,
                    form_template_id: event.target.value
                      ? Number(event.target.value)
                      : "",
                  })
                }
              >
                <option value="">
                  {formDocumentTitle(itemBeingEdited?.config)
                    ? `Keep copied form: ${formDocumentTitle(itemBeingEdited?.config)}`
                    : "Select form template"}
                </option>
                {formTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.short_name}
                  </option>
                ))}
              </select>
            ) : (
              <div />
            )}
          </>
        )}
        <Input
          className={form.kind === "ddq-task" ? undefined : "sm:col-span-3"}
          value={form.title}
          placeholder="Title"
          disabled={loading || isViewingItem}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
      </div>
      {form.kind === "ddq-task" && form.task_type === "form-completion" && (
        <div className="grid gap-1 text-sm text-muted-foreground">
          <p>
            Select a form template. The template definition will be copied into
            this DDQ pack item, so later template edits or deletion will not
            affect this task.
          </p>
          {formTemplatesLoading && <p>Loading form templates...</p>}
          {formTemplatesError && (
            <p className="text-destructive">{formTemplatesError}</p>
          )}
          {!formTemplatesLoading &&
            !formTemplatesError &&
            formTemplates.length === 0 &&
            !formDocumentTitle(itemBeingEdited?.config) && (
              <p className="text-destructive">
                Create a form template before adding a form completion task.
              </p>
            )}
        </div>
      )}
      {form.kind === "branch" && (
        <div className="grid gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {form.branch_options.map((option, optionIndex) => (
              <div
                className="grid grid-cols-[1fr_auto] gap-2"
                key={option.id}
              >
                <Input
                  value={option.label}
                  placeholder={`Option ${optionIndex + 1}`}
                  disabled={loading || isViewingItem}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      branch_options: form.branch_options.map((candidate) =>
                        candidate.id === option.id
                          ? { ...candidate, label: event.target.value }
                          : candidate,
                      ),
                    })
                  }
                />
                {!isViewingItem && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    disabled={loading || form.branch_options.length <= 2}
                    title="Remove option"
                    onClick={() =>
                      setForm({
                        ...form,
                        branch_options: form.branch_options.filter(
                          (candidate) => candidate.id !== option.id,
                        ),
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          {branchOptionError && (
            <p className="text-sm text-destructive">{branchOptionError}</p>
          )}
          {!isViewingItem && (
            <Button
              className="w-fit"
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || form.branch_options.length >= 8}
              onClick={() =>
                setForm({
                  ...form,
                  branch_options: [
                    ...form.branch_options,
                    { id: createBranchOptionId(), label: "" },
                  ],
                })
              }
            >
              <Plus className="size-4" />
              Add option
            </Button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!isViewingItem && (
          <Button
            type="button"
            disabled={loading || !canApplyItemForm}
            onClick={applyItemForm}
          >
            {itemEditSession.mode === "edit" ? "Save Item" : "Add Item"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={closeItemForm}
        >
          Cancel
        </Button>
      </div>
    </div>
  ) : null;

  function itemFormBelongsToSection(section: DraftItemSection) {
    if (!itemEditSession) return false;
    const activeItem = draft?.items[itemEditSession.index];
    if (activeItem?.parent_branch_item_client_id) return false;

    const sessionIndex = itemEditSession.index;
    if (section.items.length === 0) return sessionIndex === section.startIndex;
    if (sessionIndex >= section.startIndex && sessionIndex < section.appendIndex) {
      return true;
    }

    const lastSectionItem = section.items[section.items.length - 1];
    return (
      (!lastSectionItem || !isStructuralItem(lastSectionItem)) &&
      sessionIndex === section.appendIndex
    );
  }

  function leavePage() {
    if (
      hasUnsavedEdits &&
      !window.confirm("Discard unsaved pack changes and leave?")
    ) {
      return;
    }

    navigate(CORE_ROUTES.associationDDQPacks);
  }

  useEffect(() => {
    if (!hasUnsavedEdits) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedEdits]);

  return (
    <Page title={null}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Breadcrumb>
          <BreadcrumbList className="text-2xl font-semibold text-foreground">
            <BreadcrumbItem>
              {hasUnsavedEdits ? (
                <BreadcrumbLink asChild className="cursor-pointer text-foreground">
                  <button type="button" onClick={leavePage}>
                    DDQ Packs
                  </button>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbLink asChild className="cursor-pointer text-foreground">
                  <Link to={CORE_ROUTES.associationDDQPacks}>DDQ Packs</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {canCloseItemFromBreadcrumb ? (
                <BreadcrumbLink asChild className="cursor-pointer text-foreground">
                  <button type="button" onClick={closeItemForm}>
                    {draft?.pack.name || "DDQ Pack"}
                  </button>
                </BreadcrumbLink>
              ) : itemEditSession ? (
                <span className="text-foreground">
                  {draft?.pack.name || "DDQ Pack"}
                </span>
              ) : (
                <BreadcrumbPage className="font-semibold">
                  {draft?.pack.name || "DDQ Pack"}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
            {itemEditSession && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-semibold">
                    {selectedItemBreadcrumbLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!readOnly && isPackDirty && (
            <span className="text-sm text-muted-foreground">Unsaved changes</span>
          )}
          {readOnly ? (
            <Button asChild type="button" variant="outline">
              <Link to={CORE_ROUTES.associationDDQPacks}>Close</Link>
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={
                  loading ||
                  !draft ||
                  (!isPackDirty && !hasOpenEditableItemForm)
                }
                onClick={discardChanges}
              >
                Discard changes
              </Button>
              <Button
                type="button"
                disabled={
                  loading ||
                  !draft ||
                  !isPackDirty ||
                  !isPackValid ||
                  hasOpenEditableItemForm
                }
                onClick={savePackDraft}
              >
                Save Pack
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 border bg-muted/20 p-4">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <Input
            aria-label="Pack name"
            value={draft?.pack.name ?? ""}
            placeholder="Pack name"
            disabled={readOnly || loading || !draft}
            onChange={(event) => updatePack({ name: event.target.value })}
          />
          <Input
            aria-label="Valid from"
            type="date"
            value={draft?.pack.valid_from ?? ""}
            disabled={readOnly || loading || !draft}
            onChange={(event) => updatePack({ valid_from: event.target.value })}
          />
          <Input
            aria-label="Valid to"
            type="date"
            value={draft?.pack.valid_to ?? ""}
            disabled={readOnly || loading || !draft}
            onChange={(event) => updatePack({ valid_to: event.target.value })}
          />
        </div>
        {dateRangeError && (
          <p className="text-sm text-destructive">{dateRangeError}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {itemCountLabel} {visibleItems.length === 1 ? "item" : "items"}
        </div>
        {readOnly ? (
          <select
            aria-label="Filter task type"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-52 md:text-sm dark:bg-input/30"
            value={taskTypeFilter}
            onChange={(event) => setTaskTypeFilter(event.target.value as TaskTypeFilter)}
          >
            <option value="all">All task types</option>
            {DDQ_TASK_DEFINITIONS.map((definition) => (
              <option key={definition.type} value={definition.type}>
                {definition.label}
              </option>
            ))}
            <option value="checkpoint">Checkpoints</option>
          </select>
        ) : null}
      </div>

      <div className={readOnly ? "grid gap-6" : "grid gap-6 pl-5"}>
        {itemSections.map((section) => {
          const lastSectionItem = section.items[section.items.length - 1];
          const sectionEndsWithStructuralItem =
            Boolean(lastSectionItem && isStructuralItem(lastSectionItem));
          const sectionAddDisabled = itemActionsDisabled || sectionEndsWithStructuralItem;

          return (
            <div className="grid gap-2" key={section.id}>
              {itemFormBelongsToSection(section) && itemFormPanel}
              {!readOnly && (
                <div className="flex justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" type="button" disabled={sectionAddDisabled}>
                        <Plus className="size-4" />
                        Add item
                        <ChevronDown className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {addItemOptions.map((option) => (
                        <DropdownMenuItem
                          key={option.value}
                          onSelect={() =>
                            openCreateForm(
                              insertIndexForSiblingAppend(draft?.items ?? [], null, null),
                              option.value,
                              { branchClientId: null, optionId: null },
                            )
                          }
                        >
                          {option.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              <div className="relative w-full overflow-visible [&_[data-slot=table-container]]:!overflow-visible">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Kind</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Task Type</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!readOnly && (
                      <InsertionRow
                        disabled={itemActionsDisabled}
                        onAdd={() =>
                          openCreateForm(
                            insertIndexForSiblingAppend(draft?.items ?? [], null, null),
                            "document-upload",
                            { branchClientId: null, optionId: null },
                          )
                        }
                      />
                    )}
                    {section.items.map((item) => {
                      const itemIndex = getDraftItemIndex(draft, item);

                      return (
                        <Fragment key={item.clientId}>
                          <TableRow className={item.kind === "branch" ? "border-b-0" : undefined}>
                            <TableCell>{itemIndex + 1}</TableCell>
                            <TableCell>{displayKind(item)}</TableCell>
                            <TableCell>{item.title}</TableCell>
                            <TableCell>{displayTaskType(item)}</TableCell>
                            <TableCell>{displayDetails(item, formTemplates)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  type="button"
                                  title="View item"
                                  disabled={viewItemActionDisabled}
                                  onClick={() => openViewForm(item, itemIndex)}
                                >
                                  <FileText className="size-4" />
                                </Button>
                                {!readOnly && (
                                  <>
                                    <Button
                                      size="icon-sm"
                                      variant="ghost"
                                      type="button"
                                      title="Edit item"
                                      disabled={itemActionsDisabled}
                                      onClick={() => openEditForm(item, itemIndex)}
                                    >
                                      <Edit className="size-4" />
                                    </Button>
                                    <Button
                                      size="icon-sm"
                                      variant="ghost"
                                      type="button"
                                      title="Delete item"
                                      disabled={itemActionsDisabled}
                                      onClick={() => removeItem(item)}
                                    >
                                      <Trash2 className="size-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          {item.kind === "branch" && (
                            <TableRow className="border-b-0">
                              <TableCell className="px-0 pb-0 pt-6" colSpan={6}>
                                <BranchOptionTables
                                  draft={draft}
                                  branch={item}
                                  readOnly={readOnly}
                                  loading={loading}
                                  formPanel={itemFormPanel}
                                  itemActionsDisabled={itemActionsDisabled}
                                  viewItemActionDisabled={viewItemActionDisabled}
                                  activeFormSession={itemEditSession}
                                  pendingParent={pendingParent}
                                  canEditDDQPacks={canEditDDQPacks}
                                  formTemplates={formTemplates}
                                  openCreateForm={openCreateForm}
                                  openEditForm={openEditForm}
                                  openViewForm={openViewForm}
                                  removeItem={removeItem}
                                />
                              </TableCell>
                            </TableRow>
                          )}
                          {!readOnly && !isStructuralItem(item) && (
                            <InsertionRow
                              disabled={itemActionsDisabled}
                              onAdd={() =>
                                openCreateForm(
                                  insertIndexAfterItemSubtree(draft?.items ?? [], item),
                                  "document-upload",
                                  {
                                    branchClientId: item.parent_branch_item_client_id,
                                    optionId: item.parent_branch_option_id ?? null,
                                  },
                                )
                              }
                            />
                          )}
                        </Fragment>
                      );
                    })}
                    {section.items.length === 0 && (
                      <TableRow>
                        <TableCell
                          className="py-3 text-muted-foreground"
                          colSpan={6}
                        >
                          {itemTotal === 0
                            ? "No DDQ Pack Items."
                            : "No DDQ Pack Items match this filter."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
      </div>
      <Status message={message} error={error} />
    </Page>
  );
};

type BranchOptionTablesProps = {
  draft: PackDraftState | null;
  branch: DraftPackItem;
  readOnly: boolean;
  loading: boolean;
  formPanel: ReactNode;
  itemActionsDisabled: boolean;
  viewItemActionDisabled: boolean;
  activeFormSession: ItemEditSession | null;
  pendingParent: BranchParent;
  canEditDDQPacks: boolean;
  formTemplates: FormTemplateSummary[];
  openCreateForm: (
    index: number,
    itemType?: AddItemType,
    parent?: BranchParent,
  ) => void;
  openEditForm: (item: DraftPackItem, index: number) => void;
  openViewForm: (item: DraftPackItem, index: number) => void;
  removeItem: (item: DraftPackItem) => void;
};

function BranchOptionTables({
  draft,
  branch,
  readOnly,
  loading,
  formPanel,
  itemActionsDisabled,
  viewItemActionDisabled,
  activeFormSession,
  pendingParent,
  canEditDDQPacks,
  formTemplates,
  openCreateForm,
  openEditForm,
  openViewForm,
  removeItem,
}: BranchOptionTablesProps) {
  const options = branchOptions(branch.config);
  const [activeOptionId, setActiveOptionId] = useState(options[0]?.id ?? "");
  const selectedOption = options.find((option) => option.id === activeOptionId) ?? options[0];
  if (!draft || !selectedOption) return null;

  const parent: BranchParent = {
    branchClientId: branch.clientId,
    optionId: selectedOption.id,
  };
  const childItems = getSiblingItems(draft.items, branch.clientId, selectedOption.id);
  const sections = splitItemsIntoSections(childItems);
  const activeFormItem =
    activeFormSession ? draft.items[activeFormSession.index] : null;
  const formBelongsToActiveOption = Boolean(
    activeFormSession?.mode === "add"
      ? pendingParent.branchClientId === branch.clientId &&
          pendingParent.optionId === selectedOption.id
      : activeFormItem &&
          activeFormItem.parent_branch_item_client_id === branch.clientId &&
          activeFormItem.parent_branch_option_id === selectedOption.id,
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-1 border-b">
        {options.map((option) => (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant={option.id === selectedOption.id ? "secondary" : "ghost"}
            onClick={() => setActiveOptionId(option.id)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {formBelongsToActiveOption && formPanel}
      {sections.map((section) => (
        <div className="grid gap-2" key={`${branch.clientId}-${selectedOption.id}-${section.id}`}>
          {!readOnly && (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    type="button"
                    disabled={
                      itemActionsDisabled ||
                      Boolean(
                        section.items[section.items.length - 1] &&
                          isStructuralItem(section.items[section.items.length - 1]),
                      )
                    }
                  >
                    <Plus className="size-4" />
                    Add item
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {addItemOptions.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onSelect={() =>
                        openCreateForm(
                          insertIndexForSiblingAppend(
                            draft.items,
                            branch.clientId,
                            selectedOption.id,
                          ),
                          option.value,
                          parent,
                        )
                      }
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
          <table className="w-full caption-bottom text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Task Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!readOnly && (
                <InsertionRow
                  disabled={itemActionsDisabled}
                  onAdd={() =>
                    openCreateForm(
                      insertIndexForSiblingAppend(draft.items, branch.clientId, selectedOption.id),
                      "document-upload",
                      parent,
                    )
                  }
                />
              )}
              {section.items.map((item) => {
                const itemIndex = getDraftItemIndex(draft, item);

                return (
                  <Fragment key={item.clientId}>
                    <TableRow className={item.kind === "branch" ? "border-b-0" : undefined}>
                      <TableCell>{section.items.indexOf(item) + 1}</TableCell>
                      <TableCell>{displayKind(item)}</TableCell>
                      <TableCell>{item.title}</TableCell>
                      <TableCell>{displayTaskType(item)}</TableCell>
                      <TableCell>{displayDetails(item, formTemplates)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            type="button"
                            title="View item"
                            disabled={viewItemActionDisabled}
                            onClick={() => openViewForm(item, itemIndex)}
                          >
                            <FileText className="size-4" />
                          </Button>
                          {!readOnly && canEditDDQPacks && (
                            <>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                type="button"
                                title="Edit item"
                                disabled={itemActionsDisabled}
                                onClick={() => openEditForm(item, itemIndex)}
                              >
                                <Edit className="size-4" />
                              </Button>
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                type="button"
                                title="Delete item"
                                disabled={itemActionsDisabled}
                                onClick={() => removeItem(item)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {item.kind === "branch" && (
                      <TableRow className="border-b-0">
                        <TableCell className="px-0 pb-0 pt-6" colSpan={6}>
                          <BranchOptionTables
                            draft={draft}
                            branch={item}
                            readOnly={readOnly}
                            loading={loading}
                            formPanel={formPanel}
                            itemActionsDisabled={itemActionsDisabled}
                            viewItemActionDisabled={viewItemActionDisabled}
                            activeFormSession={activeFormSession}
                            pendingParent={pendingParent}
                            canEditDDQPacks={canEditDDQPacks}
                            formTemplates={formTemplates}
                            openCreateForm={openCreateForm}
                            openEditForm={openEditForm}
                            openViewForm={openViewForm}
                            removeItem={removeItem}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                    {!readOnly && !isStructuralItem(item) && (
                      <InsertionRow
                        disabled={itemActionsDisabled}
                        onAdd={() =>
                          openCreateForm(
                            insertIndexAfterItemSubtree(draft.items, item),
                            "document-upload",
                            parent,
                          )
                        }
                      />
                    )}
                  </Fragment>
                );
              })}
              {section.items.length === 0 && (
                <TableRow>
                  <TableCell className="py-3 text-muted-foreground" colSpan={6}>
                    No DDQ Pack Items.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </table>
        </div>
      ))}
    </div>
  );
}

function toDraftState(pack: DDQPack, items: DDQPackItem[]): PackDraftState {
  const clientIdsByItemId = new Map(items.map((item) => [item.id, `persisted-${item.id}`]));

  return {
    pack: {
      name: pack.name,
      valid_from: pack.valid_from,
      valid_to: pack.valid_to,
    },
    items: items.map((item) => ({
      clientId: `persisted-${item.id}`,
      id: item.id,
      kind: item.kind,
      task_type: item.task_type,
      title: item.title,
      config: { ...item.config },
      parent_branch_item_id: item.parent_branch_item_id,
      parent_branch_option_id: item.parent_branch_option_id,
      parent_branch_item_client_id: item.parent_branch_item_id
        ? clientIdsByItemId.get(item.parent_branch_item_id) ?? null
        : null,
    })),
  };
}

function cloneDraftState(state: PackDraftState): PackDraftState {
  return {
    pack: { ...state.pack },
    items: state.items.map((item) => ({
      ...item,
      config: { ...item.config },
      parent_branch_item_client_id: item.parent_branch_item_client_id ?? null,
    })),
  };
}

function draftToPayload(draft: PackDraftState): SaveDDQPackDraftPayload {
  return {
    pack: {
      ...draft.pack,
      name: draft.pack.name.trim(),
    },
    items: draft.items.map(({ clientId, id: _id, ...item }) => ({
      ...item,
      client_id: clientId,
      parent_branch_item_client_id: item.parent_branch_item_client_id ?? null,
      title: item.title.trim(),
      config: { ...item.config },
    })),
  };
}

function defaultFormForItemType(itemType: AddItemType): ItemFormState {
  if (itemType === "checkpoint") {
    return {
      ...defaultItemForm,
      kind: "checkpoint",
      title: "Complete everything above to continue",
    };
  }

  if (itemType === "branch") {
    return {
      ...defaultItemForm,
      kind: "branch",
      title: "Choose a path",
      branch_options: [
        { id: createBranchOptionId(), label: "Option 1" },
        { id: createBranchOptionId(), label: "Option 2" },
      ],
    };
  }

  const definition = getTaskDefinition(itemType);
  return {
    ...defaultItemForm,
    kind: "ddq-task",
    task_type: itemType,
    document_type: documentTypeFromConfig(definition?.defaultConfig ?? {}),
  };
}

function nextFormForItemType(
  itemType: AddItemType,
  current: ItemFormState,
): ItemFormState {
  const next = defaultFormForItemType(itemType);

  if (itemType === "checkpoint" || itemType === "branch") {
    return {
      ...next,
      title: current.title || next.title,
    };
  }

  return {
    ...next,
    title: current.kind === "checkpoint" ? "" : current.title,
  };
}

function formToDraftItem(
  form: ItemFormState,
  existing: DraftPackItem | null,
  parent: BranchParent,
  createClientId: () => string,
): DraftPackItem {
  const clientId = existing?.clientId ?? createClientId();

  return {
    clientId,
    ...(existing?.id === undefined ? {} : { id: existing.id }),
    kind: form.kind,
    task_type: form.kind === "ddq-task" ? form.task_type : null,
    title: form.title.trim(),
    config: formToConfig(form, existing),
    parent_branch_item_id: existing?.parent_branch_item_id ?? null,
    parent_branch_option_id: parent.optionId,
    parent_branch_item_client_id: parent.branchClientId,
  };
}

function itemToForm(item: DraftPackItem): ItemFormState {
  return {
    kind: item.kind,
    task_type: item.task_type ?? defaultItemForm.task_type,
    title: item.title,
    document_type: documentTypeFromConfig(item.config),
    form_template_id: formTemplateIdFromConfig(item.config),
    branch_options: branchOptions(item.config),
  };
}

function formToConfig(form: ItemFormState, existing: DraftPackItem | null) {
  if (form.kind === "checkpoint") return {};
  if (form.kind === "branch") {
    return {
      options: form.branch_options.map((option) => ({
        id: option.id,
        label: option.label.trim(),
      })),
    };
  }
  if (form.task_type === "document-upload") {
    return { document_type: form.document_type };
  }
  if (form.task_type === "form-completion") {
    if (form.form_template_id) {
      return { form_template_id: form.form_template_id };
    }
    if (existing?.task_type === "form-completion" && hasFormCompletionConfig(existing.config)) {
      return { ...existing.config };
    }
  }
  return { ...(getTaskDefinition(form.task_type)?.defaultConfig ?? {}) };
}

function documentTypeFromConfig(config: Record<string, unknown>): DDQDocumentType {
  const documentType = config.document_type;
  if (DDQ_DOCUMENT_TYPES.some((type) => type.value === documentType)) {
    return documentType as DDQDocumentType;
  }
  return "passport";
}

function displayKind(item: DraftPackItem) {
  if (item.kind === "branch") return "Branch";
  return item.kind === "checkpoint" ? "Checkpoint" : "Task";
}

function displayTaskType(item: DraftPackItem) {
  if (item.kind === "branch") {
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-100 text-emerald-800"
      >
        Branch
      </Badge>
    );
  }

  if (item.kind === "checkpoint") {
    return (
      <Badge
        variant="outline"
        className="border-slate-200 bg-slate-100 text-slate-700"
      >
        Checkpoint
      </Badge>
    );
  }

  const label = getTaskDefinition(item.task_type)?.label ?? item.task_type;
  const className = taskTypeBadgeClassName(item.task_type);

  return (
    <Badge
      variant="outline"
      className={className}
    >
      {label}
    </Badge>
  );
}

function matchesTaskTypeFilter(item: DraftPackItem, filter: TaskTypeFilter) {
  if (filter === "all") return true;
  if (filter === "checkpoint") return item.kind === "checkpoint";
  return item.kind === "ddq-task" && item.task_type === filter;
}

function splitItemsIntoSections(items: DraftPackItem[]): DraftItemSection[] {
  const sections: DraftItemSection[] = [];
  let sectionItems: DraftPackItem[] = [];
  let sectionInsertIndex = 0;

  items.forEach((item, index) => {
    if (sectionItems.length === 0) {
      sectionInsertIndex = index;
    }

    sectionItems.push(item);

    if (isStructuralItem(item)) {
      sections.push({
        id: sectionItems[0]?.clientId ?? `section-${sections.length}`,
        items: sectionItems,
        startIndex: sectionInsertIndex,
        appendIndex: index + 1,
      });
      sectionItems = [];
      sectionInsertIndex = index + 1;
    }
  });

  const endsWithCheckpoint = items[items.length - 1]?.kind === "checkpoint";
  if (sectionItems.length > 0 || sections.length === 0 || endsWithCheckpoint) {
    sections.push({
      id: sectionItems[0]?.clientId ?? `section-${sections.length}`,
      items: sectionItems,
      startIndex: sectionInsertIndex,
      appendIndex:
        sectionItems.length > 0
          ? sectionInsertIndex + sectionItems.length
          : sectionInsertIndex,
    });
  }

  return sections;
}

function isStructuralItem(item: DraftPackItem) {
  return item.kind === "checkpoint" || item.kind === "branch";
}

function displayDetails(item: DraftPackItem, formTemplates: FormTemplateSummary[]) {
  if (item.kind === "branch") {
    const options = branchOptions(item.config);
    return `${options.length} ${options.length === 1 ? "option" : "options"}`;
  }
  if (item.kind === "checkpoint") return "Complete everything above to continue";
  if (item.task_type === "document-upload") {
    return displayDocumentType(documentTypeFromConfig(item.config));
  }
  if (item.task_type === "form-completion") {
    return (
      formDocumentTitle(item.config) ||
      formTemplateNameFromConfig(item.config, formTemplates) ||
      "Form template required"
    );
  }
  return "-";
}

function branchOptions(config: Record<string, unknown> | undefined): DDQBranchOption[] {
  const options = config?.options;
  if (!Array.isArray(options)) return [];

  return options.flatMap((option) => {
    if (!option || typeof option !== "object" || Array.isArray(option)) return [];
    const raw = option as Record<string, unknown>;
    if (typeof raw.id !== "string" || typeof raw.label !== "string") return [];
    return [{ id: raw.id, label: raw.label }];
  });
}

function validateBranchOptions(options: DDQBranchOption[]) {
  if (options.length < 2) return "Add at least 2 options.";
  if (options.length > 8) return "Use 8 options or fewer.";

  const labels = new Set<string>();
  for (const option of options) {
    const label = option.label.trim();
    if (!label) return "Option labels are required.";
    const key = label.toLowerCase();
    if (labels.has(key)) return "Option labels must be unique.";
    labels.add(key);
  }

  return "";
}

function createBranchOptionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `option-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getSiblingItems(
  items: DraftPackItem[],
  parentBranchClientId: string | null,
  parentBranchOptionId: string | null,
) {
  return items.filter(
    (item) =>
      item.parent_branch_item_client_id === parentBranchClientId &&
      (item.parent_branch_option_id ?? null) === parentBranchOptionId,
  );
}

function descendantClientIds(items: DraftPackItem[], branchClientId: string) {
  const ids = new Set<string>();
  let changed = true;

  while (changed) {
    changed = false;
    for (const item of items) {
      if (
        (item.parent_branch_item_client_id === branchClientId ||
          (item.parent_branch_item_client_id &&
            ids.has(item.parent_branch_item_client_id))) &&
        !ids.has(item.clientId)
      ) {
        ids.add(item.clientId);
        changed = true;
      }
    }
  }

  return ids;
}

function insertIndexForSiblingAppend(
  items: DraftPackItem[],
  parentBranchClientId: string | null,
  parentBranchOptionId: string | null,
) {
  const siblings = getSiblingItems(items, parentBranchClientId, parentBranchOptionId);
  const lastSibling = siblings[siblings.length - 1];
  if (lastSibling) return insertIndexAfterItemSubtree(items, lastSibling);

  if (!parentBranchClientId) return items.length;

  const parentIndex = items.findIndex((item) => item.clientId === parentBranchClientId);
  if (parentIndex < 0) return items.length;

  return parentIndex + 1;
}

function insertIndexAfterItemSubtree(items: DraftPackItem[], item: DraftPackItem) {
  const descendants = descendantClientIds(items, item.clientId);
  let lastIndex = items.findIndex((candidate) => candidate.clientId === item.clientId);

  items.forEach((candidate, index) => {
    if (descendants.has(candidate.clientId)) lastIndex = Math.max(lastIndex, index);
  });

  return lastIndex + 1;
}

function hasFormCompletionConfig(config: Record<string, unknown>) {
  return Boolean(formDocumentTitle(config) || formTemplateIdFromConfig(config));
}

function formDocumentTitle(config: Record<string, unknown> | undefined) {
  const form = config?.form;
  if (!form || typeof form !== "object" || Array.isArray(form)) return "";

  const definition = (form as Record<string, unknown>).definition;
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return "";
  }

  const title = (definition as Record<string, unknown>).title;
  return typeof title === "string" && title.trim() ? title.trim() : "";
}

function formTemplateIdFromConfig(config: Record<string, unknown> | undefined) {
  const templateId = config?.form_template_id;
  return typeof templateId === "number" && Number.isInteger(templateId) && templateId > 0
    ? templateId
    : "";
}

function formTemplateNameFromConfig(
  config: Record<string, unknown> | undefined,
  formTemplates: FormTemplateSummary[],
) {
  const templateId = formTemplateIdFromConfig(config);
  if (!templateId) return "";

  return (
    formTemplates.find((template) => template.id === templateId)?.short_name ??
    `Template ${templateId}`
  );
}

function displayDocumentType(documentType: DDQDocumentType) {
  return (
    DDQ_DOCUMENT_TYPES.find((type) => type.value === documentType)?.label ?? "Other"
  );
}

function getTaskDefinition(taskType: DDQTaskType | null) {
  return DDQ_TASK_DEFINITIONS.find((definition) => definition.type === taskType);
}

function parseAddItemType(value: string) {
  return taskTypeOptions.find((option) => option.value === value)?.value;
}

function taskTypeBadgeClassName(taskType: DDQTaskType | null) {
  if (taskType === "form-completion") {
    return "border-amber-200 bg-amber-100 text-amber-900";
  }
  if (taskType === "photo-upload") {
    return "border-teal-200 bg-teal-100 text-teal-800";
  }
  return "border-blue-200 bg-blue-100 text-blue-800";
}

function comparableDraft(draft: PackDraftState) {
  return JSON.stringify({
    pack: {
      ...draft.pack,
      name: draft.pack.name.trim(),
    },
    items: draft.items.map(({ clientId: _clientId, id: _id, ...item }) => ({
      ...item,
      title: item.title.trim(),
    })),
  });
}

function packDateRangeError(pack: { valid_from: string; valid_to: string }) {
  if (!pack.valid_from || !pack.valid_to || pack.valid_from <= pack.valid_to) {
    return "";
  }

  return "Valid to must be on or after valid from.";
}

function comparableForm(form: ItemFormState) {
  return JSON.stringify({
    ...form,
    title: form.title.trim(),
  });
}

function getDraftItemIndex(draft: PackDraftState | null, item: DraftPackItem) {
  return (
    draft?.items.findIndex((candidate) => candidate.clientId === item.clientId) ?? -1
  );
}

export default AssociationDDQPackContent;
