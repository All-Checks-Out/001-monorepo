import type {
  DDQDocumentType,
  DDQPack,
  ProviderDDQChecklist as ProviderDDQChecklistModel,
  ProviderDDQChecklistTask,
} from "@frontend/api/onboarding/types";
import {
  changeProviderDDQChecklistStatus,
  changeProviderDDQChecklistTaskStatus,
  createProviderDDQChecklist,
  DDQ_DOCUMENT_TYPES,
  getProviderDDQChecklist,
  type DDQChecklistStatusAction,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/shadcn/components/ui/table";
import {
  Ban,
  CheckCircle2,
  Eye,
  FileText,
  ListChecks,
  RotateCcw,
  Undo2,
  UploadCloud,
} from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Page from "../components/Page";
import Status from "../components/Status";
import StatusBadge from "../components/StatusBadge";
import { CORE_ROUTES } from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";
import { ProgressMeter } from "./ProgressMeter";


type ChecklistState = {
  pack: DDQPack;
  checklist: ProviderDDQChecklistModel;
  tasks: ProviderDDQChecklistTask[];
};

const ProviderDDQChecklist = () => {
  const { packId } = useParams();
  const numericPackId = Number(packId);
  const { hasPermission } = useCurrentUser();
  const canPerformChecklist = hasPermission("provider-ddq-packs:perform-checks");
  const canViewChecklist =
    canPerformChecklist ||
    hasPermission("provider-ddq-packs:review-checks") ||
    hasPermission("provider-ddq-packs:approve-checks");
  const [state, setState] = useState<ChecklistState | null>(null);
  const [loading, setLoading] = useState(false);
  const [missingChecklist, setMissingChecklist] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    if (!canViewChecklist) {
      setError("Permission required.");
      return;
    }
    if (!Number.isInteger(numericPackId) || numericPackId < 1) {
      setError("Invalid DDQ Pack.");
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");
    setMissingChecklist(false);

    try {
      const result = await getProviderDDQChecklist(numericPackId);
      setState(result);
    } catch (err) {
      setState(null);
      setMissingChecklist(true);
      setError(
        err instanceof Error ? err.message : "Could not load DDQ Checklist.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createChecklist() {
    if (!canPerformChecklist || !Number.isInteger(numericPackId) || numericPackId < 1) {
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const result = await createProviderDDQChecklist(numericPackId);
      setState(result);
      setMissingChecklist(false);
      setMessage("DDQ Checklist created.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create DDQ Checklist.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function changeChecklistStatus(action: DDQChecklistStatusAction) {
    if (!canPerformChecklist || !state) return;

    const statusAction = checklistStatusActionFor(state, action);
    if (!statusAction) return;
    if (
      statusAction.confirm &&
      !window.confirm(statusAction.confirm)
    ) {
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const result = await changeProviderDDQChecklistStatus(
        state.pack.id,
        action,
      );
      setState(result);
      setMessage(statusAction.successMessage);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update DDQ Checklist progress.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function changeTaskStatus(
    task: ProviderDDQChecklistTask,
    action: DDQChecklistStatusAction,
  ) {
    if (!canPerformChecklist || !state) return;

    const statusAction = taskStatusActionFor(task, action);
    if (!statusAction) return;
    if (
      statusAction.confirm &&
      !window.confirm(statusAction.confirm)
    ) {
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const result = await changeProviderDDQChecklistTaskStatus(
        state.pack.id,
        task.id,
        action,
      );
      setState(result);
      setMessage(statusAction.successMessage);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update DDQ Checklist Task progress.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [numericPackId, canViewChecklist]);

  const counts = useMemo(() => countTasks(state?.tasks ?? []), [state]);
  const checklist = state?.checklist ?? null;
  const checklistActions = state
    ? checklistStatusActions(state, counts, canPerformChecklist)
    : [];
  const taskActionsDisabled =
    loading || !canPerformChecklist || checklist?.status === "withdrawn";

  return (
    <Page title={null}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={CORE_ROUTES.providerDDQPacks}>DDQ Packs</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{state?.pack.name ?? "DDQ Checklist"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {state && checklist ? (
        <>
          <div className="border bg-muted/10 px-3 py-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Progress</span>
                <StatusBadge status={checklist.status} />
                <span>
                  {counts.completed} completed / {counts.active} active /{" "}
                  {counts.withdrawn} withdrawn
                </span>
                <ProgressMeter completed={counts.completed} total={counts.total} />
              </div>
              {canPerformChecklist && (
                <div className="flex flex-wrap gap-2">
                  {checklistActions.map((action) => (
                    <Button
                      key={action.action}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={loading || action.disabled}
                      onClick={() => changeChecklistStatus(action.action)}
                    >
                      {action.icon}
                      {action.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Progress</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Config</TableHead>
                {canViewChecklist && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.tasks.length > 0 ? (
                state.tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell>{task.position}</TableCell>
                    <TableCell>{task.title}</TableCell>
                    <TableCell>{displayTaskType(task)}</TableCell>
                    <TableCell>{displayTaskConfig(task)}</TableCell>
                    {canViewChecklist && (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {canPerformChecklist &&
                            isActiveExecutableTask(task) &&
                            (taskActionsDisabled ? (
                              <Button
                                key="execute"
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                disabled
                                aria-label={executeTaskLabel(task)}
                                title={executeTaskLabel(task)}
                              >
                                {executeTaskIcon(task)}
                              </Button>
                            ) : (
                              <Button
                                key="execute"
                                type="button"
                                size="icon-sm"
                                variant="outline"
                                asChild
                                aria-label={executeTaskLabel(task)}
                                title={executeTaskLabel(task)}
                              >
                                <Link
                                  to={CORE_ROUTES.providerDDQPackChecklistTask(
                                    state.pack.id,
                                    task.id,
                                  )}
                                >
                                  {executeTaskIcon(task)}
                                </Link>
                              </Button>
                            ))}
                          <Button
                            key="review"
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            asChild
                            aria-label="Review task"
                            title="Review task"
                          >
                            <Link
                              to={CORE_ROUTES.providerDDQPackChecklistTask(
                                state.pack.id,
                                task.id,
                              )}
                            >
                              <Eye className="size-4" />
                            </Link>
                          </Button>
                          {canPerformChecklist && taskStatusActions(task).map((action) => (
                            <Button
                              key={action.action}
                              type="button"
                              size="icon-sm"
                              variant="outline"
                              disabled={taskActionsDisabled}
                              aria-label={action.label}
                              title={action.label}
                              onClick={() => changeTaskStatus(task, action.action)}
                            >
                              {action.icon}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    className="py-3 text-muted-foreground"
                    colSpan={canViewChecklist ? 6 : 5}
                  >
                    {loading
                      ? "Loading DDQ Checklist."
                      : "This checklist has no tasks."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </>
      ) : (
        <div className="grid gap-3 border bg-muted/20 p-4">
          <div className="text-sm text-muted-foreground">
            {loading
              ? "Loading DDQ Checklist."
              : missingChecklist
                ? "No checklist exists for this DDQ Pack yet."
                : "DDQ Checklist unavailable."}
          </div>
          {missingChecklist && canPerformChecklist && (
            <Button
              className="w-fit"
              type="button"
              disabled={loading}
              onClick={createChecklist}
            >
              <ListChecks className="size-4" />
              Create checklist
            </Button>
          )}
        </div>
      )}

      <Status message={message} error={error} />
    </Page>
  );
};

type StatusAction = {
  action: DDQChecklistStatusAction;
  label: string;
  icon: ReactElement;
  disabled?: boolean;
  confirm?: string;
  successMessage: string;
};

function checklistStatusActions(
  state: ChecklistState,
  counts: ReturnType<typeof countTasks>,
  canPerformChecklist: boolean,
): StatusAction[] {
  if (!canPerformChecklist) return [];

  if (state.checklist.status === "active") {
    return [
      {
        action: "complete",
        label: "Complete checklist",
        icon: <CheckCircle2 className="size-4" />,
        disabled: counts.total === 0 || counts.completed !== counts.total,
        successMessage: "DDQ Checklist completed.",
      },
      {
        action: "withdraw",
        label: "Withdraw checklist",
        icon: <Ban className="size-4" />,
        confirm: "Withdraw checklist now? This change is immediate.",
        successMessage: "DDQ Checklist withdrawn.",
      },
    ];
  }

  if (state.checklist.status === "withdrawn") {
    return [
      {
        action: "restore",
        label: "Restore checklist",
        icon: <RotateCcw className="size-4" />,
        successMessage: "DDQ Checklist restored.",
      },
    ];
  }

  return [
    {
      action: "reopen",
      label: "Reopen checklist",
      icon: <Undo2 className="size-4" />,
      successMessage: "DDQ Checklist reopened.",
    },
  ];
}

function checklistStatusActionFor(
  state: ChecklistState,
  action: DDQChecklistStatusAction,
) {
  return checklistStatusActions(state, countTasks(state.tasks), true).find(
    (candidate) => candidate.action === action,
  );
}

function taskStatusActions(task: ProviderDDQChecklistTask): StatusAction[] {
  if (task.status === "active") {
    const actions: StatusAction[] = [
      {
        action: "withdraw",
        label: "Withdraw",
        icon: <Ban className="size-4" />,
        confirm: `Withdraw ${task.title} now? This change is immediate.`,
        successMessage: "DDQ Checklist Task withdrawn.",
      },
    ];

    if (!isUploadTask(task) && task.task_type !== "form-completion") {
      actions.unshift({
        action: "complete",
        label: "Mark task complete",
        icon: <CheckCircle2 className="size-4" />,
        successMessage: "DDQ Checklist Task completed.",
      });
    }

    return actions;
  }

  if (task.status === "withdrawn") {
    return [
      {
        action: "restore",
        label: "Restore",
        icon: <RotateCcw className="size-4" />,
        successMessage: "DDQ Checklist Task restored.",
      },
    ];
  }

  return [
    {
      action: "reopen",
      label: "Reopen",
      icon: <Undo2 className="size-4" />,
      successMessage: "DDQ Checklist Task reopened.",
    },
  ];
}

function isActiveExecutableTask(task: ProviderDDQChecklistTask) {
  return (
    task.status === "active" &&
    (isUploadTask(task) || task.task_type === "form-completion")
  );
}

function isUploadTask(task: ProviderDDQChecklistTask) {
  return task.task_type === "document-upload" || task.task_type === "photo-upload";
}

function executeTaskLabel(task: ProviderDDQChecklistTask) {
  return task.task_type === "form-completion" ? "Complete form" : "Execute task";
}

function executeTaskIcon(task: ProviderDDQChecklistTask) {
  return task.task_type === "form-completion"
    ? <FileText className="size-4" />
    : <UploadCloud className="size-4" />;
}

function taskStatusActionFor(
  task: ProviderDDQChecklistTask,
  action: DDQChecklistStatusAction,
) {
  return taskStatusActions(task).find((candidate) => candidate.action === action);
}

function countTasks(tasks: ProviderDDQChecklistTask[]) {
  const counts = {
    active: 0,
    completed: 0,
    withdrawn: 0,
    total: 0,
  };

  for (const task of tasks) {
    counts[task.status] += 1;
    if (task.status !== "withdrawn") counts.total += 1;
  }

  return counts;
}

function displayTaskType(task: ProviderDDQChecklistTask) {
  if (task.kind === "checkpoint") return "Checkpoint";
  if (task.task_type === "document-upload") return "Document upload";
  if (task.task_type === "form-completion") return "Form completion";
  if (task.task_type === "photo-upload") return "Photo upload";
  return "-";
}

function displayTaskConfig(task: ProviderDDQChecklistTask) {
  if (task.kind === "checkpoint") return "Complete everything above to continue";
  if (task.task_type === "form-completion") {
    return formDocumentTitle(task.config) || "-";
  }
  if (task.task_type !== "document-upload") return "-";

  const documentType = task.config.document_type;
  if (typeof documentType !== "string") return "-";

  return displayDocumentType(documentType as DDQDocumentType);
}

function formDocumentTitle(config: Record<string, unknown>) {
  const form = config.form;
  if (!form || typeof form !== "object" || Array.isArray(form)) return "";

  const definition = (form as Record<string, unknown>).definition;
  if (!definition || typeof definition !== "object" || Array.isArray(definition)) {
    return "";
  }

  const title = (definition as Record<string, unknown>).title;
  return typeof title === "string" && title.trim() ? title.trim() : "";
}

function displayDocumentType(documentType: DDQDocumentType) {
  return (
    DDQ_DOCUMENT_TYPES.find((type) => type.value === documentType)?.label ??
    "Other"
  );
}

export default ProviderDDQChecklist;
