import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import DataTable from "@frontend/app-ui/data-display/AppDataTable";
import { Button } from "@frontend/shadcn/components/ui/button";

type ApprovalTableRow = {
  id: number;
  values: ReactNode[];
  disabled: boolean;
};

interface ApprovalTableProps {
  headers: string[];
  rows: ApprovalTableRow[];
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  empty: string;
}

const ApprovalTable = ({
  headers,
  rows,
  onApprove,
  onReject,
  empty,
}: ApprovalTableProps) => {
  const columns: ColumnDef<ApprovalTableRow>[] = [
    ...headers.map((header, index): ColumnDef<ApprovalTableRow> => ({
      id: `${header}-${index}`,
      header,
      enableSorting: false,
      cell: ({ row }) => row.original.values[index],
    })),
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            type="button"
            disabled={row.original.disabled}
            onClick={() => onApprove(row.original.id)}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={row.original.disabled}
            onClick={() => onReject(row.original.id)}
          >
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} data={rows} empty={empty} />;
};

export default ApprovalTable;
export type { ApprovalTableRow };
