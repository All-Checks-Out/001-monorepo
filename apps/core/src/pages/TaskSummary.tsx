import { DDQDocumentType, ProviderDDQChecklist, ProviderDDQChecklistTask } from "@frontend/api/onboarding/types";
import { DDQ_DOCUMENT_TYPES } from "@frontend/api/onboarding/client";
import StatusBadge from "../components/StatusBadge";

function displayTaskType(task: ProviderDDQChecklistTask) {
  if (task.kind === "checkpoint") return "Checkpoint";
  if (task.task_type === "document-upload") return "Document upload";
  if (task.task_type === "form-completion") return "Form completion";
  if (task.task_type === "photo-upload") return "Photo upload";
  return "-";
}

function displayTaskConfig(task: ProviderDDQChecklistTask) {
  if (task.kind === "checkpoint") return "Complete everything above to continue";
  if (task.task_type === "form-completion") return task.title;
  if (task.task_type !== "document-upload") return "";

  const documentType = task.config.document_type;
  if (typeof documentType !== "string") return "";

  return (
    DDQ_DOCUMENT_TYPES.find((type) => type.value === (documentType as DDQDocumentType))
      ?.label ?? "Other"
  );
}

export function TaskSummary({
  checklist,
  task,
}: {
  checklist: ProviderDDQChecklist;
  task: ProviderDDQChecklistTask;
}) {
  return (
    <div className="border bg-muted/10 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{displayTaskType(task)}</span>
        <span className="inline-flex items-center gap-1">
          Task progress: <StatusBadge status={task.status} />
        </span>
        <span className="inline-flex items-center gap-1">
          Checklist progress: <StatusBadge status={checklist.status} />
        </span>
        <span>Position {task.position}</span>
        {displayTaskConfig(task) && <span>{displayTaskConfig(task)}</span>}
      </div>
    </div>
  );
}
