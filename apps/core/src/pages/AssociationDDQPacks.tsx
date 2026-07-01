import type { DDQPack } from "@frontend/api/onboarding/types";
import {
  changeDDQPackStatus,
  createDDQPack,
  listDDQPacks,
  type DDQPackStatusAction,
  type DDQPackPayload,
} from "@frontend/api/onboarding/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@frontend/shadcn/components/ui/breadcrumb";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Input } from "@frontend/shadcn/components/ui/input";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, Edit, FileText, Rocket, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DataTable from "@frontend/app-ui/data-display/AppDataTable";
import Page from "../components/Page";
import Status from "../components/Status";
import StatusBadge from "../components/StatusBadge";
import { CORE_ROUTES } from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";
import { displayPackStatus, statusActionForPack } from "../utils/ddqPackStatus";

type PackFormState = {
  name: string;
  valid_from: string;
  valid_to: string;
};

const blankForm: PackFormState = {
  name: "",
  valid_from: "",
  valid_to: "",
};

const AssociationDDQPacks = () => {
  const { hasPermission } = useCurrentUser();
  const [packs, setPacks] = useState<DDQPack[]>([]);
  const [form, setForm] = useState<PackFormState>(blankForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const result = await listDDQPacks();
    setPacks(result.packs);
  }

  useEffect(() => {
    async function loadPacks() {
      try {
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load DDQ Packs.");
      }
    }

    void loadPacks();
  }, []);

  function openCreateForm() {
    setForm(blankForm);
    setShowForm(true);
    setMessage("");
    setError("");
  }

  async function savePack() {
    setLoading(true);
    setMessage("");
    setError("");

    const payload: DDQPackPayload = {
      ...form,
      name: form.name.trim(),
    };

    try {
      await createDDQPack(payload);
      setMessage("DDQ Pack created.");
      setShowForm(false);
      setForm(blankForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save DDQ Pack.");
    } finally {
      setLoading(false);
    }
  }

  async function changePackStatus(pack: DDQPack, action: DDQPackStatusAction) {
    const statusAction = statusActionForPack(pack);
    if (!statusAction || statusAction.action !== action) return;

    if (
      !window.confirm(
        `${statusAction.confirmVerb} ${pack.name} now? ${statusAction.confirmConsequence}`,
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage("");
    setError("");

    try {
      await changeDDQPackStatus(pack.id, action);
      setMessage(statusAction.successMessage);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update DDQ Pack status.",
      );
    } finally {
      setLoading(false);
    }
  }

  const isCreateDirty = !isSamePackForm(form, blankForm);
  const dateRangeError = packDateRangeError(form);
  const isCreateValid = Boolean(
    form.name.trim() && form.valid_from && form.valid_to && !dateRangeError,
  );
  const hasActiveEdits = showForm && isCreateDirty;
  const canEditDDQPacks = hasPermission("association-ddq-packs:edit");

  const columns = useMemo<ColumnDef<DDQPack>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
      },
      {
        accessorKey: "created_at",
        header: "Created At",
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      {
        accessorKey: "valid_from",
        header: "Valid From",
        cell: ({ row }) => formatDate(row.original.valid_from),
      },
      {
        accessorKey: "valid_to",
        header: "Valid To",
        cell: ({ row }) => formatDate(row.original.valid_to),
      },
      {
        accessorFn: displayPackStatus,
        id: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const pack = row.original;
          const statusAction = statusActionForPack(pack);

          return (
            <div className="flex flex-wrap items-center gap-1">
              {hasActiveEdits ? (
                <>
                  <Button size="icon-sm" variant="ghost" title="View pack" disabled>
                    <FileText className="size-4" />
                  </Button>
                  <Button size="icon-sm" variant="ghost" title="Edit pack" disabled>
                    <Edit className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    asChild
                    size="icon-sm"
                    variant="ghost"
                    title="View pack"
                    aria-label={`View ${pack.name}`}
                  >
                    <Link to={CORE_ROUTES.associationDDQPackReadOnly(pack.id)}>
                      <FileText className="size-4" />
                    </Link>
                  </Button>
                  {canEditDDQPacks && (
                    <Button
                      asChild
                      size="icon-sm"
                      variant="ghost"
                      title="Edit pack"
                      aria-label={`Edit ${pack.name}`}
                    >
                      <Link to={CORE_ROUTES.associationDDQPack(pack.id)}>
                        <Edit className="size-4" />
                      </Link>
                    </Button>
                  )}
                </>
              )}
              {canEditDDQPacks && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  type="button"
                  title={statusAction?.label ?? "Pack status"}
                  aria-label={`${statusAction?.label ?? "Pack status"} for ${pack.name}`}
                  disabled={loading || hasActiveEdits || !statusAction}
                  onClick={() =>
                    statusAction && changePackStatus(pack, statusAction.action)
                  }
                >
                  {statusAction?.action === "publish" && (
                    <Rocket className="size-4" />
                  )}
                  {statusAction?.action === "archive" && (
                    <Archive className="size-4" />
                  )}
                  {statusAction?.action === "restore" && (
                    <RotateCcw className="size-4" />
                  )}
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [canEditDDQPacks, hasActiveEdits, loading],
  );

  return (
    <Page title={null}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-2xl font-semibold text-foreground">
              DDQ Packs
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {canEditDDQPacks && showForm && (
        <div className="grid gap-3 border bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <Input
              aria-label="Pack name"
              value={form.name}
              placeholder="Pack name"
              disabled={loading}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <Input
              aria-label="Valid from"
              type="date"
              value={form.valid_from}
              disabled={loading}
              onChange={(event) =>
                setForm({ ...form, valid_from: event.target.value })
              }
            />
            <Input
              aria-label="Valid to"
              type="date"
              value={form.valid_to}
              disabled={loading}
              onChange={(event) =>
                setForm({ ...form, valid_to: event.target.value })
              }
            />
          </div>
          <div className="text-sm text-muted-foreground">
            New DDQ Packs start as drafts.
          </div>
          {dateRangeError && (
            <p className="text-sm text-destructive">{dateRangeError}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={loading || !isCreateDirty || !isCreateValid}
              onClick={savePack}
            >
              Create Pack
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => {
                setShowForm(false);
                setForm(blankForm);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      <DataTable
        columns={columns}
        data={packs}
        empty="No DDQ Packs."
        createLabel="Add Pack"
        onCreate={canEditDDQPacks ? openCreateForm : undefined}
        createDisabled={loading || hasActiveEdits}
        filters={[
          {
            column: "name",
            label: "Search DDQ Pack name",
            placeholder: "Search packs",
            className: "sm:w-72",
          },
          {
            column: "status",
            type: "select",
            label: "Filter pack status",
            allLabel: "All states",
            className: "sm:w-44",
            options: [
              { label: "Published", value: "Published" },
              { label: "Draft", value: "Draft" },
              { label: "Archived", value: "Archived" },
            ],
          },
        ]}
      />
      <Status message={message} error={error} />
    </Page>
  );
};

function formatDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "-";
}

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString() : "-";
}

function isSamePackForm(first: PackFormState, second: PackFormState) {
  return (
    first.name === second.name &&
    first.valid_from === second.valid_from &&
    first.valid_to === second.valid_to
  );
}

function packDateRangeError(form: PackFormState) {
  if (!form.valid_from || !form.valid_to || form.valid_from <= form.valid_to) {
    return "";
  }

  return "Valid to must be on or after valid from.";
}

export default AssociationDDQPacks;
