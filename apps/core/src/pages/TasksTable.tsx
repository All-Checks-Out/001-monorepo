import { DDQPackItem } from "@frontend/api/onboarding/types";
import { DDQ_DOCUMENT_TYPES } from "@frontend/api/onboarding/client";
import { ScrollArea } from "@frontend/shadcn/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@frontend/shadcn/components/ui/table";

function displayTaskType(item: DDQPackItem) {
  if (item.kind === "checkpoint") return "Checkpoint";
  if (item.task_type === "document-upload") return "Document upload";
  if (item.task_type === "form-completion") return "Form completion";
  if (item.task_type === "photo-upload") return "Photo upload";
  return "-";
}

function displayDocumentType(item: DDQPackItem) {
  if (item.kind !== "ddq-task" || item.task_type !== "document-upload") {
    return "-";
  }

  const documentType = item.config.document_type;
  if (typeof documentType !== "string") return "-";

  return (
    DDQ_DOCUMENT_TYPES.find((type) => type.value === documentType)?.label ??
    documentType
  );
}

function tasksEmptyText({
  loading,
  selectedPackId,
}: {
  loading: boolean;
  selectedPackId: number | null;
}) {
  if (loading) return "Loading tasks.";
  if (selectedPackId === null) return "Select a DDQ Pack to view its tasks.";
  return "This DDQ Pack has no tasks.";
}

function formatTaskCount(count: number) {
  return `${count} ${count === 1 ? "task" : "tasks"}`;
}

export function TasksTable({
  items,
  loading,
  selectedPackId,
}: {
  items: DDQPackItem[];
  loading: boolean;
  selectedPackId: number | null;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-sm text-muted-foreground">
        {formatTaskCount(items.length)}
      </div>
      <ScrollArea className="h-44 rounded-md border lg:h-52">
        <div className="relative w-full overflow-visible">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Document Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:last-child]:border-b">
              {items.length > 0 ? (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.position}</TableCell>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>{displayTaskType(item)}</TableCell>
                    <TableCell>{displayDocumentType(item)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="py-3 text-muted-foreground" colSpan={4}>
                    {tasksEmptyText({ loading, selectedPackId })}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter className="sticky -bottom-px z-20 bg-muted shadow-[0_-1px_0_hsl(var(--border))]">
              <TableRow>
                <TableCell colSpan={4}>
                  {formatTaskCount(items.length)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </ScrollArea>
    </div>
  );
}
