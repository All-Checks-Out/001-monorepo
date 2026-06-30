import { ProviderDDQChecklist, ProviderDDQChecklistTask } from "@frontend/api/onboarding/types";

function capitalize(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

export function ReadOnlyNotice({
  checklist,
  task,
  canPerformChecklist,
  noun = "evidence",
}: {
  checklist: ProviderDDQChecklist;
  task: ProviderDDQChecklistTask;
  canPerformChecklist: boolean;
  noun?: string;
}) {
  const text = !canPerformChecklist
    ? `Review mode. ${capitalize(noun)} changes are read-only for your permissions.`
    : checklist.status === "withdrawn"
      ? `Restore the checklist before changing ${noun}.`
      : task.status !== "active"
        ? `Reopen this task before changing ${noun}.`
        : `This task does not accept ${noun}.`;

  return <p className="text-sm text-muted-foreground">{text}</p>;
}
