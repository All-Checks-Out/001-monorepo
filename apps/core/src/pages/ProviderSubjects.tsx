import type { Subject, SubjectType } from "@frontend/api/onboarding/types";
import {
  listProviderSubjects,
  listSubjectTypes,
} from "@frontend/api/onboarding/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@frontend/shadcn/components/ui/breadcrumb";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Checkbox } from "@frontend/shadcn/components/ui/checkbox";
import { Input } from "@frontend/shadcn/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@frontend/shadcn/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/shadcn/components/ui/table";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Page from "../components/Page";
import Status from "../components/Status";
import { CORE_ROUTES } from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";

const allSubjectTypesValue = "__all_subject_types";

const ProviderSubjects = () => {
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const [subjectTypes, setSubjectTypes] = useState<SubjectType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [q, setQ] = useState("");
  const [subjectTypeKey, setSubjectTypeKey] = useState(allSubjectTypesValue);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canEditSubjects = hasPermission("provider-subjects:edit");

  async function loadSubjects() {
    setLoading(true);
    setError("");

    try {
      const [typeResult, subjectResult] = await Promise.all([
        listSubjectTypes(),
        listProviderSubjects({
          q,
          includeArchived,
          subjectTypeKey:
            subjectTypeKey === allSubjectTypesValue ? undefined : subjectTypeKey,
        }),
      ]);
      setSubjectTypes(typeResult.subjectTypes);
      setSubjects(subjectResult.subjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Subjects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSubjects();
  }, [includeArchived, subjectTypeKey]);

  const subjectTypesByKey = useMemo(
    () => new Map(subjectTypes.map((subjectType) => [subjectType.key, subjectType])),
    [subjectTypes],
  );

  return (
    <Page title={null}>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Subjects</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Input
              aria-label="Search Subjects"
              className="w-full sm:w-72"
              placeholder="Search subjects"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadSubjects();
              }}
            />
            <Select value={subjectTypeKey} onValueChange={setSubjectTypeKey}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Subject type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allSubjectTypesValue}>All types</SelectItem>
                {subjectTypes.map((subjectType) => (
                  <SelectItem key={subjectType.key} value={subjectType.key}>
                    {subjectType.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex min-h-9 w-fit items-center gap-2 text-sm">
              <Checkbox
                checked={includeArchived}
                onCheckedChange={(checked) => setIncludeArchived(checked === true)}
              />
              Include archived
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => loadSubjects()}
            >
              Search
            </Button>
          </div>
          {canEditSubjects && (
            <Button
              className="w-fit"
              type="button"
              onClick={() => navigate(CORE_ROUTES.providerSubjectNew)}
            >
              <Plus className="size-4" />
              New Subject
            </Button>
          )}
        </div>

        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-24">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.length > 0 ? (
                subjects.map((subject) => (
                  <TableRow key={subject.id}>
                    <TableCell className="font-medium">
                      {subject.display_name}
                    </TableCell>
                    <TableCell>
                      {subjectTypesByKey.get(subject.subject_type_key)?.label ??
                        subject.subject_type_key}
                    </TableCell>
                    <TableCell>
                      {subject.archived_at ? "Archived" : "Active"}
                    </TableCell>
                    <TableCell>{formatDateTime(subject.updated_at)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => navigate(CORE_ROUTES.providerSubject(subject.id))}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="py-4 text-muted-foreground" colSpan={5}>
                    {loading ? "Loading Subjects." : "No Subjects."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Status message="" error={error} />
    </Page>
  );
};

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString() : "-";
}

export default ProviderSubjects;
