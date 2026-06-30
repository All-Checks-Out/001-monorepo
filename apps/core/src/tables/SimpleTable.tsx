import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import DataTable from "@frontend/app-ui/data-display/AppDataTable";

type SimpleTableRow = {
  id: string | number;
  values: ReactNode[];
};

interface SimpleTableProps {
  headers: string[];
  rows: SimpleTableRow[];
  empty: string;
}

const SimpleTable = ({ headers, rows, empty }: SimpleTableProps) => {
  const columns: ColumnDef<SimpleTableRow>[] = headers.map((header, index) => ({
    id: `${header}-${index}`,
    header,
    enableSorting: false,
    cell: ({ row }) => row.original.values[index],
  }));

  return <DataTable columns={columns} data={rows} empty={empty} />;
};

export default SimpleTable;
export type { SimpleTableRow };
