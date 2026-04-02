"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import type { DbTable, DbProperty } from "@/lib/vcaas-types";

interface DatabasePanelProps {
  projectId: string;
}

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

function formatCellValue(value: unknown, type: string): string {
  if (value === null || value === undefined) return "\u2014";
  if (type === "date" && value) {
    try { return new Date(value as string).toLocaleDateString(); } catch { return String(value); }
  }
  if (type === "file" && typeof value === "object" && value !== null) return (value as { name?: string }).name || "File";
  if (type === "objectReference" && typeof value === "object" && value !== null) return (value as { _id?: string })._id || JSON.stringify(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DatabasePanel({ projectId }: DatabasePanelProps) {
  const [tables, setTables] = useState<DbTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [activeView, setActiveView] = useState<"schema" | "data">("schema");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ tables: DbTable[] }>(`/api/vcaas/projects/${projectId}/database/tables-structure`);
    if (res.ok && res.data) {
      const t = res.data.tables || [];
      setTables(t);
      if (t.length > 0 && !selectedTable) setSelectedTable(t[0].type);
    }
    setLoading(false);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecords = useCallback(async (tableName: string) => {
    if (!tableName) return;
    setRecordsLoading(true);
    const res = await api.post<{ results: Record<string, unknown>[] }>(`/api/vcaas/projects/${projectId}/database/query`, {
      tableName,
      queryOptions: { _limit: 50, _sort: { createdAt: "desc" } },
    });
    if (res.ok && res.data) setRecords(res.data.results || []);
    setRecordsLoading(false);
  }, [projectId]);

  useEffect(() => { fetchTables(); }, [fetchTables]);
  useEffect(() => { if (selectedTable && activeView === "data") fetchRecords(selectedTable); }, [selectedTable, activeView, fetchRecords]);

  const currentTable = tables.find((t) => t.type === selectedTable);
  const currentProperties = currentTable ? Object.values(currentTable.properties) : [];

  const handleCreateRecord = async () => {
    if (!selectedTable) return;
    setCreating(true);
    const res = await api.post(`/api/vcaas/projects/${projectId}/database/records`, { tableName: selectedTable, data: newRecord });
    if (res.ok) { toast.success("Record created"); setCreateDialogOpen(false); setNewRecord({}); fetchRecords(selectedTable); }
    else toast.error("Failed to create record");
    setCreating(false);
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
      <div className="px-4 py-3 border-b bg-white flex items-center gap-3 flex-wrap">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setActiveView("schema")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === "schema" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
            <Layers className="w-3.5 h-3.5" /> Schema
          </button>
          <button onClick={() => setActiveView("data")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeView === "data" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
            <Grid3X3 className="w-3.5 h-3.5" /> Data
          </button>
        </div>

        {activeView === "data" && (
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Select table" /></SelectTrigger>
            <SelectContent>{tables.map((t) => <SelectItem key={t.type} value={t.type}>{t.label || t.type}</SelectItem>)}</SelectContent>
          </Select>
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
                  {currentProperties.filter((p) => !["_id", "createdAt", "updatedAt"].includes(p.name)).map((prop) => (
                    <div key={prop.id}>
                      <Label className="text-xs text-gray-600">{prop.label || prop.name} <span className="text-gray-400">({prop.propertyType})</span></Label>
                      <Input className="mt-1 h-8 text-sm" placeholder={`Enter ${prop.label || prop.name}`} value={newRecord[prop.name] || ""} onChange={(e) => setNewRecord((prev) => ({ ...prev, [prop.name]: e.target.value }))} />
                    </div>
                  ))}
                  <Button className="w-full" size="sm" onClick={handleCreateRecord} disabled={creating}>
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Create
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={fetchTables}><RefreshCw className="w-3.5 h-3.5 text-gray-500" /></Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeView === "schema" ? (
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tables.map((table) => (
              <div key={table._id} className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-gray-50">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center">
                    <Table2 className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{table.label || table.type}</h3>
                    {table.description && <p className="text-[10px] text-gray-400 truncate">{table.description}</p>}
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{Object.keys(table.properties).length} fields</Badge>
                </div>
                <div className="space-y-1">
                  {Object.values(table.properties).map((prop: DbProperty) => (
                    <div key={prop.id} className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-gray-50 transition-colors">
                      <span className="text-xs text-gray-700 font-mono flex-1 truncate">{prop.name}</span>
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
          <div className="min-h-full">
            {recordsLoading ? (
              <div className="p-4 space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Search className="w-8 h-8 text-gray-200 mb-3" />
                <p className="text-sm text-gray-500">No records in {currentTable?.label || selectedTable}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>{currentProperties.slice(0, 6).map((prop) => (
                      <th key={prop.id} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 whitespace-nowrap border-b">{prop.label || prop.name}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {records.map((record, idx) => (
                      <tr key={(record._id as string) || idx} className="hover:bg-gray-50/50 transition-colors">
                        {currentProperties.slice(0, 6).map((prop) => (
                          <td key={prop.id} className="px-4 py-2.5 text-xs text-gray-600 max-w-[200px] truncate">{formatCellValue(record[prop.name], prop.propertyType)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
