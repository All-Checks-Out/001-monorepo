import { Badge } from "@frontend/shadcn/components/ui/badge";

interface StatusBadgeProps {
  status: string | null | undefined;
}

const statusClassName = {
  success: "border-green-200 bg-green-100 text-green-800",
  warning: "border-amber-200 bg-amber-100 text-amber-900",
  neutral: "border-transparent bg-secondary text-secondary-foreground",
  muted: "bg-background text-muted-foreground",
  destructive: "border-transparent bg-destructive text-white",
} as const;

const statusTone = {
  active: "warning",
  approved: "success",
  archived: "neutral",
  completed: "success",
  disabled: "neutral",
  draft: "muted",
  failed: "destructive",
  invited: "muted",
  pending: "warning",
  pending_upload: "warning",
  published: "success",
  rejected: "destructive",
  replaced: "neutral",
  uploaded: "success",
  withdrawn: "neutral",
} as const;

const fallbackTone = "muted";

function StatusBadge({ status }: StatusBadgeProps) {
  const statusKey = status ?? "not-started";
  const tone = statusTone[statusKey as keyof typeof statusTone] ?? fallbackTone;

  return (
    <Badge variant="outline" className={statusClassName[tone]}>
      {displayStatus(statusKey)}
    </Badge>
  );
}

function displayStatus(status: string) {
  return status
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

export default StatusBadge;
