"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database,
  Table2,
  ArrowRight,
  Plus,
  RefreshCw,
  Loader2,
  Search,
  Layers,
  Grid3X3,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Trash2,
  Pencil,
  FileText,
  Download,
  ExternalLink,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import type { DbTable, DbProperty } from "@/lib/vcaas-types";

interface DatabasePanelProps {
  projectId: string;
}

// --- Filter types ---
type FilterOperator = "eq" | "ne" | "contains" | "startsWith" | "endsWith" | "gt" | "gte" | "lt" | "lte" | "regex";

interface FilterRule {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

const OPERATORS: { value: FilterOperator; label: string; types: string[] }[] = [
  { value: "eq", label: "equals", types: ["string", "number", "date", "options", "long-string", "objectReference"] },
  { value: "ne", label: "not equals", types: ["string", "number", "date", "options", "long-string", "objectReference"] },
  { value: "contains", label: "contains", types: ["string", "long-string", "options"] },
  { value: "startsWith", label: "starts with", types: ["string", "long-string"] },
  { value: "endsWith", label: "ends with", types: ["string", "long-string"] },
  { value: "gt", label: ">", types: ["number", "date"] },
  { value: "gte", label: ">=", types: ["number", "date"] },
  { value: "lt", label: "<", types: ["number", "date"] },
  { value: "lte", label: "<=", types: ["number", "date"] },
  { value: "regex", label: "matches regex", types: ["string", "long-string"] },
];

function getOperatorsForType(type: string): { value: FilterOperator; label: string }[] {
  return OPERATORS.filter((op) => op.types.includes(type));
}

function buildFilterObject(filters: FilterRule[]): Record<string, unknown> {
  const filterObj: Record<string, unknown> = {};
  for (const f of filters) {
    if (!f.field || !f.value) continue;
    if (f.operator === "eq") {
      filterObj[f.field] = f.value;
    } else if (f.operator === "contains" || f.operator === "startsWith" || f.operator === "endsWith") {
      filterObj[f.field] = { [f.operator]: f.value };
    } else if (f.operator === "regex") {
      filterObj[f.field] = { regex: f.value, options: "i" };
    } else {
      // gt, gte, lt, lte, ne
      filterObj[f.field] = { [f.operator]: isNaN(Number(f.value)) ? f.value : Number(f.value) };
    }
  }
  return filterObj;
}

let filterId = 0;
function newFilterId(): string {
  filterId += 1;
  return `f_${filterId}_${Date.now()}`;
}

// --- Helpers ---
function getPropertyTypeColor(type: string): string {
  const colors: Record<string, string> = {
    string: "bg-sky-100 text-sky-700",
    number: "bg-emerald-100 text-emerald-700",
    date: "bg-purple-100 text-purple-700",
    options: "bg-amber-100 text-amber-700",
    file: "bg-pink-100 text-pink-700",
    "long-string": "bg-cyan-100 text-cyan-700",
    objectReference: "bg-violet-100 text-violet-700",
  };
  return colors[type] || "bg-gray-100 text-gray-700";
}

// Detect image files by extension, from either the url or the stored name.
function isImageSource(s: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)(\?|$)/i.test(s);
}
function fileExt(s: string): string {
  const m = s.split("?")[0].match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

// Renders a single Totalum file object ({ name, url }) by its type:
// images \u2192 thumbnail, everything else \u2192 typed icon + open/download link.
function FileChip({ file }: { file: { name?: string; url?: string } }) {
  const url = file?.url;
  const name = file?.name || "file";
  if (!url) return <span className="text-gray-500 text-xs">{name}</span>;
  const img = isImageSource(url) || isImageSource(name);
  if (img) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" title={name} className="inline-block group/img relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className="w-9 h-9 rounded-md object-cover border border-gray-200 dark:border-gray-700 group-hover/img:ring-2 group-hover/img:ring-violet-300 transition" />
      </a>
    );
  }
  const ext = fileExt(url) || fileExt(name);
  const isPdf = ext === "pdf";
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={name}
      className="inline-flex items-center gap-1.5 max-w-[160px] px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      {isPdf ? <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" /> : <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
      <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate">{name}</span>
      <Download className="w-3 h-3 text-gray-400 shrink-0" />
    </a>
  );
}

// Rich, type-aware table cell renderer.
function CellRenderer({ value, type }: { value: unknown; type: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-gray-300 dark:text-gray-600">\u2014</span>;
  }
  if (type === "file") {
    const files = Array.isArray(value) ? value : [value];
    const valid = files.filter((f) => f && typeof f === "object");
    if (valid.length === 0) return <span className="text-gray-300">\u2014</span>;
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {valid.slice(0, 4).map((f, i) => <FileChip key={i} file={f as { name?: string; url?: string }} />)}
        {valid.length > 4 && <span className="text-[10px] text-gray-400">+{valid.length - 4}</span>}
      </div>
    );
  }
  if (type === "options") {
    return <span className="inline-block text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">{String(value)}</span>;
  }
  if (type === "objectReference") {
    if (typeof value === "object" && value !== null) {
      const ref = value as Record<string, unknown>;
      const label = (ref.name || ref.title || ref.label || ref._id || "") as string;
      return <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400"><ArrowRight className="w-3 h-3" />{String(label)}</span>;
    }
    return <span className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400"><ArrowRight className="w-3 h-3" />{String(value)}</span>;
  }
  if (type === "date") {
    try { return <span>{new Date(value as string).toLocaleString()}</span>; } catch { return <span>{String(value)}</span>; }
  }
  if (typeof value === "boolean") {
    return <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${value ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{value ? "true" : "false"}</span>;
  }
  if (typeof value === "object") return <span className="font-mono text-[11px]">{JSON.stringify(value)}</span>;
  return <span>{String(value)}</span>;
}

// Plain-text version for inputs / edit prefills.
function toEditableString(value: unknown, type: string): string {
  if (value === null || value === undefined) return "";
  if (type === "objectReference" && typeof value === "object" && value !== null) return (value as { _id?: string })._id || "";
  if (type === "date" && value) { try { return new Date(value as string).toISOString().slice(0, 10); } catch { return String(value); } }
  if (typeof value === "object") return "";
  return String(value);
}

// --- Filter Bar ---
function FilterBar({ properties, filters, onChange }: {
  properties: DbProperty[];
  filters: FilterRule[];
  onChange: (filters: FilterRule[]) => void;
}) {
  const filterableProps = properties.filter((p) => !["_id"].includes(p.name));

  const updateFilter = (id: string, updates: Partial<FilterRule>) => {
    onChange(filters.map((f) => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFilter = (id: string) => {
    onChange(filters.filter((f) => f.id !== id));
  };

  const addFilter = () => {
    const firstProp = filterableProps[0];
    if (!firstProp) return;
    const ops = getOperatorsForType(firstProp.propertyType);
    onChange([...filters, {
      id: newFilterId(),
      field: firstProp.name,
      operator: ops[0]?.value || "eq",
      value: "",
    }]);
  };

  return (
    <div className="space-y-2">
      {filters.map((filter) => {
        const prop = filterableProps.find((p) => p.name === filter.field);
        const propType = prop?.propertyType || "string";
        const ops = getOperatorsForType(propType);

        return (
          <div key={filter.id} className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400 font-medium uppercase w-10 shrink-0">
              {filters.indexOf(filter) === 0 ? "Where" : "And"}
            </span>
            <select
              value={filter.field}
              onChange={(e) => {
                const newProp = filterableProps.find((p) => p.name === e.target.value);
                const newOps = getOperatorsForType(newProp?.propertyType || "string");
                updateFilter(filter.id, {
                  field: e.target.value,
                  operator: newOps[0]?.value || "eq",
                });
              }}
              className="h-7 px-2 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none min-w-[100px]"
            >
              {filterableProps.map((p) => (
                <option key={p.name} value={p.name}>{p.label || p.name}</option>
              ))}
            </select>
            <select
              value={filter.operator}
              onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator })}
              className="h-7 px-2 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none min-w-[90px]"
            >
              {ops.map((op) => (
                <option key={op.value} value={op.value}>{op.label}</option>
              ))}
            </select>
            <input
              type={propType === "number" ? "number" : propType === "date" ? "date" : "text"}
              value={filter.value}
              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
              placeholder="Value..."
              className="h-7 px-2 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none flex-1 min-w-[80px]"
            />
            <button
              onClick={() => removeFilter(filter.id)}
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
      <button
        onClick={addFilter}
        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 transition-colors py-0.5"
      >
        <Plus className="w-3 h-3" /> Add filter
      </button>
    </div>
  );
}

// --- Main Component ---
export function DatabasePanel({ projectId }: DatabasePanelProps) {
  const { t } = useI18n();
  const [tables, setTables] = useState<DbTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [activeView, setActiveView] = useState<"schema" | "data">("data");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  // Edit / delete state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  // Sorting
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Filters
  const [filters, setFilters] = useState<FilterRule[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");

  // Track applied filters for actual query
  const [appliedFilters, setAppliedFilters] = useState<FilterRule[]>([]);
  const [appliedSearch, setAppliedSearch] = useState("");

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ tables: DbTable[] }>(`/api/vcaas/projects/${projectId}/database/tables-structure`);
    if (res.ok && res.data) {
      const tbls = res.data.tables || [];
      setTables(tbls);
      if (tbls.length > 0 && !selectedTable) setSelectedTable(tbls[0].type);
    }
    setLoading(false);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecords = useCallback(async (tableName: string, pg: number, sort: { field: string; dir: "asc" | "desc" }, activeFilters: FilterRule[], search: string) => {
    if (!tableName) return;
    setRecordsLoading(true);

    const queryOptions: Record<string, unknown> = {
      _limit: pageSize,
      _offset: (pg - 1) * pageSize,
      _sort: { [sort.field]: sort.dir },
      _count: true,
    };

    // Build filter
    const filterObj = buildFilterObject(activeFilters);

    // Quick search across string/long-string fields
    if (search.trim()) {
      const table = tables.find((t) => t.type === tableName);
      if (table) {
        const stringFields = Object.values(table.properties).filter(
          (p) => ["string", "long-string"].includes(p.propertyType) && p.name !== "_id"
        );
        if (stringFields.length > 0) {
          const orConditions = stringFields.map((f) => ({ [f.name]: { contains: search.trim() } }));
          filterObj["_or"] = orConditions;
        }
      }
    }

    if (Object.keys(filterObj).length > 0) {
      queryOptions._filter = filterObj;
    }

    const res = await api.post<{ results: Record<string, unknown>[] }>(`/api/vcaas/projects/${projectId}/database/query`, {
      tableName,
      queryOptions,
    });
    if (res.ok && res.data) {
      const results = res.data.results || [];
      setRecords(results);
      // Extract _count._total from first record metadata if present
      if (results.length > 0 && results[0]._count && typeof results[0]._count === "object") {
        const countObj = results[0]._count as { _total?: number };
        if (countObj._total !== undefined) setTotalCount(countObj._total);
        else setTotalCount(results.length);
      } else if (results.length < pageSize && pg === 1) {
        setTotalCount(results.length);
      }
    }
    setRecordsLoading(false);
  }, [projectId, tables, pageSize]);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  useEffect(() => {
    if (selectedTable && activeView === "data") {
      fetchRecords(selectedTable, page, { field: sortField, dir: sortDir }, appliedFilters, appliedSearch);
    }
  }, [selectedTable, activeView, page, sortField, sortDir, appliedFilters, appliedSearch, fetchRecords]);

  // Debounced quick search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setAppliedSearch(quickSearch);
      setPage(1);
    }, 400);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [quickSearch]);

  const currentTable = tables.find((t) => t.type === selectedTable);
  const currentProperties = currentTable ? Object.values(currentTable.properties) : [];
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleCreateRecord = async () => {
    if (!selectedTable) return;
    setCreating(true);
    const res = await api.post(`/api/vcaas/projects/${projectId}/database/records`, { tableName: selectedTable, data: newRecord });
    if (res.ok) {
      toast.success("Record created");
      setCreateDialogOpen(false);
      setNewRecord({});
      fetchRecords(selectedTable, page, { field: sortField, dir: sortDir }, appliedFilters, appliedSearch);
    } else toast.error(res.error || "Failed to create record");
    setCreating(false);
  };

  const openEditDialog = (record: Record<string, unknown>) => {
    const id = record._id as string;
    const values: Record<string, string> = {};
    currentProperties
      .filter((p) => !["_id", "createdAt", "updatedAt"].includes(p.name) && p.propertyType !== "file")
      .forEach((p) => { values[p.name] = toEditableString(record[p.name], p.propertyType); });
    setEditValues(values);
    setEditingId(id);
    setEditDialogOpen(true);
  };

  const handleEditRecord = async () => {
    if (!selectedTable || !editingId) return;
    setSaving(true);
    const res = await api.patch(`/api/vcaas/projects/${projectId}/database/records/${editingId}`, {
      tableName: selectedTable,
      data: editValues,
    });
    if (res.ok) {
      toast.success(t("recordUpdated"));
      setEditDialogOpen(false);
      setEditingId(null);
      fetchRecords(selectedTable, page, { field: sortField, dir: sortDir }, appliedFilters, appliedSearch);
    } else {
      toast.error(res.error || "Failed to update record");
    }
    setSaving(false);
  };

  const handleDeleteRecord = async (record: Record<string, unknown>) => {
    const id = record._id as string;
    if (!id || !selectedTable) return;
    if (!confirm(t("confirmDelete"))) return;
    setDeletingId(id);
    const res = await api.delete(`/api/vcaas/projects/${projectId}/database/records/${id}?tableName=${encodeURIComponent(selectedTable)}`);
    if (res.ok) {
      toast.success(t("recordDeleted"));
      // If we just removed the last row on a page, step back a page.
      if (records.length === 1 && page > 1) setPage(page - 1);
      else fetchRecords(selectedTable, page, { field: sortField, dir: sortDir }, appliedFilters, appliedSearch);
    } else {
      toast.error(res.error || "Failed to delete record");
    }
    setDeletingId(null);
  };

  const handleApplyFilters = () => {
    setAppliedFilters([...filters]);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters([]);
    setAppliedFilters([]);
    setPage(1);
  };

  const handleSort = (fieldName: string) => {
    if (sortField === fieldName) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(fieldName);
      setSortDir("asc");
    }
    setPage(1);
  };

  const handleTableChange = (tableName: string) => {
    setSelectedTable(tableName);
    setPage(1);
    setFilters([]);
    setAppliedFilters([]);
    setQuickSearch("");
    setAppliedSearch("");
    setSortField("createdAt");
    setSortDir("desc");
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
          <Database className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">No database tables</p>
        <p className="text-xs text-gray-400 max-w-xs">Tables will appear here after the AI agent builds your project with database functionality.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="px-4 py-2.5 border-b bg-white dark:bg-gray-900 flex items-center gap-2 flex-wrap">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button onClick={() => setActiveView("data")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === "data" ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white" : "text-gray-500"}`}>
            <Grid3X3 className="w-3.5 h-3.5" /> {t("dataView")}
          </button>
          <button onClick={() => setActiveView("schema")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === "schema" ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white" : "text-gray-500"}`}>
            <Layers className="w-3.5 h-3.5" /> {t("schemaView")}
          </button>
        </div>

        {activeView === "data" && (
          <>
            <Select value={selectedTable} onValueChange={handleTableChange}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Select table" /></SelectTrigger>
              <SelectContent>{tables.map((tbl) => <SelectItem key={tbl.type} value={tbl.type}>{tbl.label || tbl.type}</SelectItem>)}</SelectContent>
            </Select>

            {/* Quick search */}
            <div className="relative flex-1 min-w-[120px] max-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                placeholder="Quick search..."
                className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-gray-300"
              />
              {quickSearch && (
                <button onClick={() => setQuickSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium border transition-colors ${
                showFilters || appliedFilters.length > 0
                  ? "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-600 dark:bg-violet-900/20 dark:text-violet-400"
                  : "border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <Filter className="w-3 h-3" />
              Filter
              {appliedFilters.length > 0 && (
                <Badge className="text-[9px] h-3.5 border-0 bg-violet-200 text-violet-800 dark:bg-violet-800 dark:text-violet-200 ml-0.5">{appliedFilters.length}</Badge>
              )}
            </button>
          </>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {activeView === "data" && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New {currentTable?.label || selectedTable} Record</DialogTitle></DialogHeader>
                <div className="space-y-3 mt-3">
                  {currentProperties.filter((p) => !["_id", "createdAt", "updatedAt"].includes(p.name) && p.propertyType !== "file").map((prop) => (
                    <div key={prop.id}>
                      <Label className="text-xs text-gray-600">{prop.label || prop.name} <span className="text-gray-400">({prop.propertyType})</span></Label>
                      <Input
                        className="mt-1 h-8 text-sm"
                        type={prop.propertyType === "number" ? "number" : prop.propertyType === "date" ? "date" : "text"}
                        placeholder={prop.propertyType === "objectReference" ? "Referenced record _id" : `Enter ${prop.label || prop.name}`}
                        value={newRecord[prop.name] || ""}
                        onChange={(e) => setNewRecord((prev) => ({ ...prev, [prop.name]: e.target.value }))}
                      />
                    </div>
                  ))}
                  {currentProperties.some((p) => p.propertyType === "file") && (
                    <p className="text-[10px] text-gray-400 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> File fields are uploaded by your app and can be viewed in the table.</p>
                  )}
                  <Button className="w-full" size="sm" onClick={handleCreateRecord} disabled={creating}>
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} {t("create")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* Edit record dialog (controlled) */}
          <Dialog open={editDialogOpen} onOpenChange={(o) => { setEditDialogOpen(o); if (!o) setEditingId(null); }}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("editRecord")} · {currentTable?.label || selectedTable}</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-3">
                {currentProperties.filter((p) => !["_id", "createdAt", "updatedAt"].includes(p.name) && p.propertyType !== "file").map((prop) => (
                  <div key={prop.id}>
                    <Label className="text-xs text-gray-600">{prop.label || prop.name} <span className="text-gray-400">({prop.propertyType})</span></Label>
                    <Input
                      className="mt-1 h-8 text-sm"
                      type={prop.propertyType === "number" ? "number" : prop.propertyType === "date" ? "date" : "text"}
                      placeholder={prop.propertyType === "objectReference" ? "Referenced record _id" : `Enter ${prop.label || prop.name}`}
                      value={editValues[prop.name] ?? ""}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [prop.name]: e.target.value }))}
                    />
                  </div>
                ))}
                {currentProperties.filter((p) => !["_id", "createdAt", "updatedAt"].includes(p.name) && p.propertyType !== "file").length === 0 && (
                  <p className="text-xs text-gray-400 py-4 text-center">{t("noEditableFields")}</p>
                )}
                {currentProperties.some((p) => p.propertyType === "file") && (
                  <p className="text-[10px] text-gray-400 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> File fields are managed by your app and shown read-only in the table.</p>
                )}
                <Button className="w-full" size="sm" onClick={handleEditRecord} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />} {t("saveChanges")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => {
            fetchTables();
            if (activeView === "data" && selectedTable) {
              fetchRecords(selectedTable, page, { field: sortField, dir: sortDir }, appliedFilters, appliedSearch);
            }
          }}><RefreshCw className="w-3.5 h-3.5 text-gray-500" /></Button>
        </div>
      </div>

      {/* Filter Panel */}
      {activeView === "data" && showFilters && (
        <div className="px-4 py-3 border-b bg-gray-50/50 dark:bg-gray-900/50">
          <FilterBar
            properties={currentProperties}
            filters={filters}
            onChange={setFilters}
          />
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={handleApplyFilters}
              disabled={filters.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-violet-600 text-white text-[11px] font-medium hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 transition-colors"
            >
              <Filter className="w-3 h-3" /> Apply Filters
            </button>
            {appliedFilters.length > 0 && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeView === "schema" ? (
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tables.map((table) => (
              <div key={table._id} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-gray-50 dark:border-gray-700">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                    <Table2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm dark:text-gray-200">{table.label || table.type}</h3>
                    {table.description && <p className="text-[10px] text-gray-400 truncate">{table.description}</p>}
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{Object.keys(table.properties).length} fields</Badge>
                </div>
                <div className="space-y-1">
                  {Object.values(table.properties).map((prop: DbProperty) => (
                    <div key={prop.id} className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <span className="text-xs text-gray-700 dark:text-gray-300 font-mono flex-1 truncate">{prop.name}</span>
                      <Badge className={`text-[9px] h-4 border-0 shrink-0 font-medium ${getPropertyTypeColor(prop.propertyType)}`}>{prop.propertyType}</Badge>
                      {prop.propertyType === "objectReference" && prop.objectReference?.tableTo && (
                        <span className="flex items-center gap-0.5 text-violet-500 shrink-0">
                          <ArrowRight className="w-2.5 h-2.5" />
                          <span className="font-mono text-[9px]">{prop.objectReference.tableTo}</span>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="min-h-full flex flex-col">
            {recordsLoading ? (
              <div className="p-4 space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center py-16">
                <Search className="w-8 h-8 text-gray-200 mb-3" />
                <p className="text-sm text-gray-500">
                  {appliedFilters.length > 0 || appliedSearch
                    ? "No records match your filters"
                    : `No records in ${currentTable?.label || selectedTable}`}
                </p>
                {(appliedFilters.length > 0 || appliedSearch) && (
                  <button onClick={() => { handleClearFilters(); setQuickSearch(""); }} className="text-xs text-violet-600 hover:underline mt-1">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
                      <tr>
                        {currentProperties.slice(0, 8).map((prop) => (
                          <th
                            key={prop.id}
                            onClick={() => handleSort(prop.name)}
                            className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors select-none group"
                          >
                            <div className="flex items-center gap-1">
                              {prop.label || prop.name}
                              {sortField === prop.name ? (
                                sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-violet-500" /> : <ArrowDown className="w-3 h-3 text-violet-500" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap border-b border-gray-100 dark:border-gray-700 sticky right-0 bg-gray-50 dark:bg-gray-800/50">
                          {t("actions")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {records.map((record, idx) => (
                        <tr key={(record._id as string) || idx} className="group/row hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                          {currentProperties.slice(0, 8).map((prop) => (
                            <td key={prop.id} className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400 max-w-[220px] truncate align-middle">
                              <CellRenderer value={record[prop.name]} type={prop.propertyType} />
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-gray-900 group-hover/row:bg-gray-50/50 dark:group-hover/row:bg-gray-800/30">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditDialog(record)}
                                title={t("editRecord")}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRecord(record)}
                                disabled={deletingId === (record._id as string)}
                                title={t("deleteRecord")}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                              >
                                {deletingId === (record._id as string) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">
                    {totalCount > 0
                      ? `${(page - 1) * pageSize + 1}\u2013${Math.min(page * pageSize, totalCount)} of ${totalCount}`
                      : `${records.length} records`}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page <= 1}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronsLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page <= 1}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs text-gray-500 px-2 min-w-[60px] text-center">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page >= totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page >= totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronsRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
