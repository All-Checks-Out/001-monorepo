import type { FormTemplateSummary } from "@frontend/api/onboarding/types";
import DataTable from "@frontend/app-ui/data-display/AppDataTable";
import { deleteAssociationFormTemplate, listAssociationFormTemplates } from "@frontend/api/onboarding/client";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Edit, FileText, Plus, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Page } from "../components/Page";
import { Status } from "../components/Status";
import { FORM_DESIGN_ROUTES } from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString() : "-";
}

export const AssociationFormsPage = () => {
  const { hasPermission } = useCurrentUser();
  const canEditForms = hasPermission("forms:edit");
  const [templates, setTemplates] = useState<FormTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const columns = useMemo<ColumnDef<FormTemplateSummary>[]>(
    () => [
      {
        accessorKey: "short_name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.short_name || "-"}</span>
        ),
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ row }) => (
          <span className="block max-w-lg whitespace-normal text-muted-foreground">
            {row.original.description || "-"}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Created at",
        cell: ({ row }) => formatDateTime(row.original.created_at),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => {
          const template = row.original;

          return (
            <div className="flex flex-wrap items-center gap-1">
              <Button
                asChild
                size="icon-sm"
                variant="ghost"
                title="View form"
                aria-label={`View ${template.short_name || "form template"}`}
              >
                <Link to={FORM_DESIGN_ROUTES.associationFormDesignerReadOnly(template.id)}>
                  <FileText className="size-4" />
                </Link>
              </Button>
              <Button
                asChild={canEditForms}
                size="icon-sm"
                variant="ghost"
                title="Edit form"
                aria-label={`Edit ${template.short_name || "form template"}`}
                disabled={!canEditForms}
              >
                {canEditForms ? (
                  <Link to={FORM_DESIGN_ROUTES.associationFormDesigner(template.id)}>
                    <Edit className="size-4" />
                  </Link>
                ) : (
                  <span>
                    <Edit className="size-4" />
                  </span>
                )}
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Delete form"
                aria-label={`Delete ${template.short_name || "form template"}`}
                disabled={!canEditForms || deletingId !== null}
                onClick={() => deleteTemplate(template)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        },
      },
    ],
    [canEditForms, deletingId],
  );

  async function loadTemplates() {
    setLoading(true);
    setLoadError("");

    try {
      const result = await listAssociationFormTemplates();
      setTemplates(result.formTemplates);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load form templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  async function deleteTemplate(template: FormTemplateSummary) {
    if (
      !window.confirm(
        `Delete ${template.short_name}? Existing DDQ pack tasks keep their copied form definitions. This only removes the reusable template.`,
      )
    ) {
      return;
    }

    setDeletingId(template.id);
    setMessage("");
    setActionError("");

    try {
      await deleteAssociationFormTemplate(template.id);
      setMessage("Form template deleted.");
      await loadTemplates();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete form template.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Page title="Forms">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage reusable form templates for this Association.
        </p>
        {canEditForms && (
          <Button asChild>
            <Link to={FORM_DESIGN_ROUTES.associationFormNew}>
              <Plus className="size-4" />
              Add Form
            </Link>
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <DataTable
          columns={columns}
          data={loading || loadError ? [] : templates}
          empty={
            loading
              ? "Loading form templates..."
              : loadError || "No form templates yet."
          }
        />
      </div>

      <Status message={message} error={actionError} />
    </Page>
  );
};
