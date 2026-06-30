import { Button } from "@frontend/shadcn/components/ui/button";
import { Input } from "@frontend/shadcn/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/shadcn/components/ui/table";
import type {
  ColumnDef,
  ColumnFiltersState,
  RowData,
  SortingState,
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@frontend/shadcn/lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from "lucide-react";
import { useState } from "react";

type AppDataTableTextFilter = {
  column: string;
  type?: "text";
  label?: string;
  placeholder?: string;
  className?: string;
};

type AppDataTableSelectFilter = {
  column: string;
  type: "select";
  label?: string;
  options: { label: string; value: string }[];
  allLabel?: string;
  className?: string;
};

type AppDataTableFilter = AppDataTableTextFilter | AppDataTableSelectFilter;

interface AppDataTableProps<TData extends RowData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  empty: string;
  filters?: AppDataTableFilter[];
  filterColumn?: string;
  filterPlaceholder?: string;
  createLabel?: string;
  onCreate?: () => void;
  createDisabled?: boolean;
}

const AppDataTable = <TData extends RowData, TValue>({
  columns,
  data,
  empty,
  filters,
  filterColumn,
  filterPlaceholder = "Filter table",
  createLabel = "Add",
  onCreate,
  createDisabled = false,
}: AppDataTableProps<TData, TValue>) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      sorting,
    },
  });

  const configuredFilters =
    filters ??
    (filterColumn
      ? [{ column: filterColumn, placeholder: filterPlaceholder }]
      : []);
  const availableFilters = configuredFilters
    .map((filter) => ({
      filter,
      column: table.getColumn(filter.column),
    }))
    .filter((filter) => Boolean(filter.column));
  const hasToolbar = Boolean(availableFilters.length || onCreate);

  return (
    <div className="space-y-3">
      {hasToolbar && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {availableFilters.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              {availableFilters.map(({ filter, column }) => {
                if (!column) return null;

                const value = (column.getFilterValue() as string) ?? "";

                if (filter.type === "select") {
                  return (
                    <select
                      key={filter.column}
                      aria-label={filter.label ?? `Filter ${filter.column}`}
                      className={cn(
                        "h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none transition-[color,box-shadow] md:text-sm dark:bg-input/30",
                        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        filter.className ?? "sm:w-44",
                      )}
                      value={value}
                      onChange={(event) =>
                        column.setFilterValue(event.target.value || undefined)
                      }
                    >
                      <option value="">{filter.allLabel ?? "All"}</option>
                      {filter.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  );
                }

                return (
                  <Input
                    key={filter.column}
                    aria-label={
                      filter.label ?? filter.placeholder ?? "Filter table"
                    }
                    className={cn("w-full sm:w-64", filter.className)}
                    value={value}
                    placeholder={filter.placeholder ?? "Filter table"}
                    onChange={(event) =>
                      column.setFilterValue(event.target.value || undefined)
                    }
                  />
                );
              })}
            </div>
          ) : (
            <div />
          )}
          {onCreate && (
            <Button
              className="w-fit"
              type="button"
              disabled={createDisabled}
              onClick={onCreate}
            >
              <Plus className="size-4" />
              {createLabel}
            </Button>
          )}
        </div>
      )}
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const sortDirection = header.column.getIsSorted();

                return (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        className="inline-flex items-center gap-1 text-left font-medium disabled:cursor-default"
                        type="button"
                        disabled={!header.column.getCanSort()}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {header.column.getCanSort() && (
                          <>
                            {sortDirection === "asc" && (
                              <ArrowUp className="size-3.5" />
                            )}
                            {sortDirection === "desc" && (
                              <ArrowDown className="size-3.5" />
                            )}
                            {!sortDirection && (
                              <ArrowUpDown className="size-3.5 opacity-50" />
                            )}
                          </>
                        )}
                      </button>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length > 0 ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                className="py-3 text-muted-foreground"
                colSpan={columns.length}
              >
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default AppDataTable;
export type { AppDataTableProps };
