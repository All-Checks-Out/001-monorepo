import { Button } from "@frontend/shadcn/components/ui/button";
import { TableCell, TableRow } from "@frontend/shadcn/components/ui/table";
import { Plus } from "lucide-react";

interface InsertionRowProps {
  disabled: boolean;
  onAdd: () => void;
}

export const InsertionRow = ({ disabled, onAdd }: InsertionRowProps) => (
  <TableRow className="group h-0 border-0 hover:bg-transparent">
    <TableCell className="relative h-0 overflow-visible p-0" colSpan={6}>
      <div className="relative h-0">
        <div className="absolute left-4 right-0 top-0 h-0.5 bg-primary/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
        <Button
          className="absolute left-0 top-0 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-primary/50 bg-background text-primary opacity-0 shadow-xs transition-opacity hover:bg-primary/10 group-hover:opacity-100 group-focus-within:opacity-100"
          size="icon-sm"
          variant="outline"
          type="button"
          title="Insert item here"
          disabled={disabled}
          onClick={onAdd}
        >
          <Plus className="size-4" />
        </Button>
      </div>
    </TableCell>
  </TableRow>
);
