import { ProviderDDQPack } from "@frontend/api/onboarding/types";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@frontend/shadcn/components/ui/table";
import { Eye, ListChecks } from "lucide-react";
import StatusBadge from "../components/StatusBadge";

function formatDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "-";
}

export function ProviderPacksTable({
  packs,
  loading,
  canViewChecklist,
  canPerformChecklist,
  openingChecklistPackId,
  onViewChecklist,
  onCreateChecklist,
}: {
  packs: ProviderDDQPack[];
  loading: boolean;
  canViewChecklist: boolean;
  canPerformChecklist: boolean;
  openingChecklistPackId: number | null;
  onViewChecklist: (pack: ProviderDDQPack) => void;
  onCreateChecklist: (pack: ProviderDDQPack) => void;
}) {
  const showChecklistActions = canViewChecklist || canPerformChecklist;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Valid From</TableHead>
          <TableHead>Valid To</TableHead>
          <TableHead>Progress</TableHead>
          {showChecklistActions && <TableHead>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {packs.length > 0 ? (
          packs.map((pack) => (
            <TableRow key={pack.id}>
              <TableCell>{pack.name}</TableCell>
              <TableCell>
                <StatusBadge status={pack.status} />
              </TableCell>
              <TableCell>{formatDate(pack.valid_from)}</TableCell>
              <TableCell>{formatDate(pack.valid_to)}</TableCell>
              <TableCell>
                <StatusBadge status={pack.checklist_status} />
              </TableCell>
              {showChecklistActions && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    {canViewChecklist && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        type="button"
                        title="View checklist"
                        aria-label={`View checklist for ${pack.name}`}
                        disabled={
                          openingChecklistPackId === pack.id ||
                          !pack.checklist_id
                        }
                        onClick={() => onViewChecklist(pack)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    )}
                    {canPerformChecklist && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        type="button"
                        title="Create or edit checklist"
                        aria-label={`Create or edit checklist for ${pack.name}`}
                        disabled={openingChecklistPackId === pack.id}
                        onClick={() => onCreateChecklist(pack)}
                      >
                        <ListChecks className="size-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              className="py-3 text-muted-foreground"
              colSpan={showChecklistActions ? 6 : 5}
            >
              {loading ? "Loading DDQ Packs." : "No DDQ Packs."}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
