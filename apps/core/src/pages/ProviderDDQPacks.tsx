import type { DDQPack, DDQPackItem, ProviderDDQPack } from "@frontend/api/onboarding/types";
import {
  addProviderDDQPack,
  createProviderDDQChecklist,
  listAvailableProviderDDQPacks,
  listProviderDDQPackItems,
  listProviderDDQPacks,
} from "@frontend/api/onboarding/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@frontend/shadcn/components/ui/breadcrumb";
import { Button } from "@frontend/shadcn/components/ui/button";
import { Input } from "@frontend/shadcn/components/ui/input";
import { ScrollArea } from "@frontend/shadcn/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/shadcn/components/ui/table";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Page from "../components/Page";
import Status from "../components/Status";
import StatusBadge from "../components/StatusBadge";
import { CORE_ROUTES } from "../constants/routes";
import { useCurrentUser } from "../context/CurrentUserContext";
import { ProviderPacksTable } from "./ProviderPacksTable";
import { TasksTable } from "./TasksTable";


type PageMode = "list" | "add";

const ProviderDDQPacks = () => {
  const navigate = useNavigate();
  const { hasPermission } = useCurrentUser();
  const [mode, setMode] = useState<PageMode>("list");
  const [providerPacks, setProviderPacks] = useState<ProviderDDQPack[]>([]);
  const [availablePacks, setAvailablePacks] = useState<DDQPack[]>([]);
  const [items, setItems] = useState<DDQPackItem[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);
  const [nameFilter, setNameFilter] = useState("");
  const [onlyValidPacks, setOnlyValidPacks] = useState(true);
  const [loadingProviderPacks, setLoadingProviderPacks] = useState(false);
  const [loadingAvailablePacks, setLoadingAvailablePacks] = useState(false);
  const [savingPack, setSavingPack] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [openingChecklistPackId, setOpeningChecklistPackId] = useState<number | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canViewChecklist =
    hasPermission("ddq-packs:perform-checks") ||
    hasPermission("ddq-packs:review-checks") ||
    hasPermission("ddq-packs:approve-checks");
  const canPerformChecklist = hasPermission("ddq-packs:perform-checks");

  async function loadProviderPacks() {
    setLoadingProviderPacks(true);
    setMessage("");
    setError("");

    try {
      const result = await listProviderDDQPacks();
      setProviderPacks(result.packs.filter(isProviderVisiblePack));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load DDQ Packs.");
    } finally {
      setLoadingProviderPacks(false);
    }
  }

  async function loadAvailablePacks() {
    setLoadingAvailablePacks(true);
    setMessage("");
    setError("");

    try {
      const result = await listAvailableProviderDDQPacks();
      setAvailablePacks(result.packs.filter(isProviderVisiblePack));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load available DDQ Packs.",
      );
    } finally {
      setLoadingAvailablePacks(false);
    }
  }

  async function openAddFlow() {
    setMode("add");
    setSelectedPackId(null);
    setItems([]);
    setNameFilter("");
    setOnlyValidPacks(true);
    await loadAvailablePacks();
  }

  async function selectPack(pack: DDQPack) {
    setSelectedPackId(pack.id);
    setItems([]);
    setLoadingItems(true);
    setMessage("");
    setError("");

    try {
      const result = await listProviderDDQPackItems(pack.id);
      setItems(result.items);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load DDQ Pack tasks.",
      );
    } finally {
      setLoadingItems(false);
    }
  }

  function closeAddFlow() {
    setMode("list");
    setSelectedPackId(null);
    setItems([]);
    setAvailablePacks([]);
    setNameFilter("");
    setOnlyValidPacks(true);
    setMessage("");
    setError("");
  }

  async function saveSelectedPack() {
    if (selectedPackId === null) return;

    setSavingPack(true);
    setMessage("");
    setError("");

    try {
      await addProviderDDQPack(selectedPackId);
      closeAddFlow();
      await loadProviderPacks();
      setMessage("DDQ Pack added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add DDQ Pack.");
    } finally {
      setSavingPack(false);
    }
  }

  async function openChecklist(pack: ProviderDDQPack, createIfMissing: boolean) {
    if (createIfMissing && !canPerformChecklist) return;
    if (!createIfMissing && !canViewChecklist) return;

    setOpeningChecklistPackId(pack.id);
    setMessage("");
    setError("");

    try {
      if (createIfMissing && !pack.checklist_id) {
        await createProviderDDQChecklist(pack.id);
      }
      navigate(CORE_ROUTES.providerDDQPackChecklist(pack.id));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not open DDQ Checklist.",
      );
    } finally {
      setOpeningChecklistPackId(null);
    }
  }

  useEffect(() => {
    void loadProviderPacks();
  }, []);

  const visiblePacks = useMemo(() => {
    const normalizedNameFilter = nameFilter.trim().toLowerCase();

    return availablePacks.filter((pack) => {
      if (!isProviderVisiblePack(pack)) return false;
      if (
        normalizedNameFilter &&
        !pack.name.toLowerCase().includes(normalizedNameFilter)
      ) {
        return false;
      }
      if (onlyValidPacks && !isCurrentlyValid(pack)) return false;
      return true;
    });
  }, [availablePacks, nameFilter, onlyValidPacks]);

  useEffect(() => {
    if (
      selectedPackId !== null &&
      !visiblePacks.some((pack) => pack.id === selectedPackId)
    ) {
      setSelectedPackId(null);
      setItems([]);
    }
  }, [selectedPackId, visiblePacks]);

  return (
    <Page title={null}>
      <Breadcrumb>
        <BreadcrumbList>
          {mode === "add" ? (
            <>
              <BreadcrumbItem>
              <BreadcrumbLink
                asChild
                className="pointer-events-none opacity-50"
                aria-disabled="true"
              >
                <span>DDQ Packs</span>
              </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Add DDQ Pack</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          ) : (
            <BreadcrumbItem>
              <BreadcrumbPage>DDQ Packs</BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      {mode === "list" ? (
        <div className="grid gap-3">
          <Button
            className="w-fit"
            type="button"
            disabled={loadingProviderPacks}
            onClick={openAddFlow}
          >
            <Plus className="size-4" />
            Add DDQ Pack
          </Button>
          <ProviderPacksTable
            packs={providerPacks}
            loading={loadingProviderPacks}
            canViewChecklist={canViewChecklist}
            canPerformChecklist={canPerformChecklist}
            openingChecklistPackId={openingChecklistPackId}
            onViewChecklist={(pack) => openChecklist(pack, false)}
            onCreateChecklist={(pack) => openChecklist(pack, true)}
          />
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <Input
                aria-label="Search DDQ Pack name"
                className="w-full sm:w-72"
                value={nameFilter}
                placeholder="Search packs"
                onChange={(event) => setNameFilter(event.target.value)}
              />
              <label className="flex min-h-9 w-fit items-center gap-2 text-sm">
                <input
                  className="size-4 accent-primary"
                  type="checkbox"
                  checked={onlyValidPacks}
                  onChange={(event) => setOnlyValidPacks(event.target.checked)}
                />
                Only show currently valid packs
              </label>
            </div>
            <Button
              className="w-fit"
              type="button"
              variant="outline"
              disabled={savingPack}
              onClick={closeAddFlow}
            >
              Cancel
            </Button>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatPackCount(visiblePacks.length)}</span>
            {visiblePacks.length !== availablePacks.length && (
              <span>{formatPackCount(availablePacks.length)} before filters</span>
            )}
          </div>

          <ScrollArea className="h-64 rounded-md border lg:h-72">
            <div className="relative w-full overflow-visible">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valid From</TableHead>
                    <TableHead>Valid To</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="[&_tr:last-child]:border-b">
                  {visiblePacks.length > 0 ? (
                    visiblePacks.map((pack) => {
                      const selected = selectedPackId === pack.id;

                    return (
                      <TableRow
                        key={pack.id}
                        className="cursor-pointer"
                        data-state={selected ? "selected" : undefined}
                        onClick={() => selectPack(pack)}
                      >
                        <TableCell>
                          <input
                            aria-label={`Select ${pack.name}`}
                            className="size-4 accent-primary"
                            type="radio"
                            checked={selected}
                            onChange={() => selectPack(pack)}
                            onClick={(event) => event.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell>{pack.name}</TableCell>
                        <TableCell>
                          <StatusBadge status={pack.status} />
                        </TableCell>
                        <TableCell>{formatDate(pack.valid_from)}</TableCell>
                        <TableCell>{formatDate(pack.valid_to)}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      className="py-3 text-muted-foreground"
                      colSpan={5}
                    >
                      {loadingAvailablePacks
                        ? "Loading DDQ Packs."
                        : "No DDQ Packs."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter className="sticky -bottom-px z-20 bg-muted shadow-[0_-1px_0_hsl(var(--border))]">
                <TableRow>
                  <TableCell colSpan={5}>
                    {formatPackCount(visiblePacks.length)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
            </div>
          </ScrollArea>

          <TasksTable
            items={items}
            loading={loadingItems}
            selectedPackId={selectedPackId}
          />

          <div className="flex justify-end">
            <Button
              className="w-fit"
              type="button"
              disabled={savingPack || selectedPackId === null}
              onClick={saveSelectedPack}
            >
              Add selected DDQ Pack
            </Button>
          </div>
        </div>
      )}

      <Status message={message} error={error} />
    </Page>
  );
};

function isProviderVisiblePack(pack: DDQPack) {
  return pack.status !== "draft";
}

function isCurrentlyValid(pack: DDQPack, today = new Date()) {
  const todayKey = toDateKey(today);
  return (
    pack.status === "published" &&
    pack.valid_from <= todayKey &&
    pack.valid_to >= todayKey
  );
}

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value: string) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString() : "-";
}

function formatPackCount(count: number) {
  return `${count} ${count === 1 ? "pack" : "packs"}`;
}

export default ProviderDDQPacks;
