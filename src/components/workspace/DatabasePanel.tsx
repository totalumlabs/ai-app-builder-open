"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Database,
  Table2,
  ArrowRight,
  Plus,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { DbTable, DbProperty } from "@/lib/vcaas-types";

interface DatabasePanelProps {
  projectId: string;
}

function getPropertyTypeColor(type: string): string {
  const colors: Record<string, string> = {
    string: "bg-blue-100 text-blue-700",
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
    try {
      return new Date(value as string).toLocaleDateString();
    } catch {
      return String(value);
    }
  }
  if (type === "file" && typeof value === "object" && value !== null) {
    return (value as { name?: string }).name || "File";
  }
  if (type === "objectReference" && typeof value === "object" && value !== null) {
    return (value as { _id?: string })._id || JSON.stringify(value);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DatabasePanel({ projectId }: DatabasePanelProps) {
  const [tables, setTables] = useState<DbTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [activeView, setActiveView] = useState("schema");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const fetchTables = useCallback(async () => {
    setLoading(true);
    const res = await api.get<{ tables: DbTable[] }>(
      `/api/vcaas/projects/${projectId}/database/tables-structure`
    );
    if (res.ok && res.data) {
      const t = res.data.tables || [];
      setTables(t);
      if (t.length > 0 && !selectedTable) {
        setSelectedTable(t[0].type);
      }
    }
    setLoading(false);
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRecords = useCallback(
    async (tableName: string) => {
      if (!tableName) return;
      setRecordsLoading(true);
      const res = await api.post<{ results: Record<string, unknown>[] }>(
        `/api/vcaas/projects/${projectId}/database/query`,
        {
          tableName,
          queryOptions: { _limit: 50, _sort: { createdAt: "desc" } },
        }
      );
      if (res.ok && res.data) {
        setRecords(res.data.results || []);
      }
      setRecordsLoading(false);
    },
    [projectId]
  );

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  useEffect(() => {
    if (selectedTable && activeView === "data") {
      fetchRecords(selectedTable);
    }
  }, [selectedTable, activeView, fetchRecords]);

  const currentTable = tables.find((t) => t.type === selectedTable);
  const currentProperties = currentTable
    ? Object.values(currentTable.properties)
    : [];

  const handleCreateRecord = async () => {
    if (!selectedTable) return;
    setCreating(true);
    const res = await api.post(
      `/api/vcaas/projects/${projectId}/database/records`,
      { tableName: selectedTable, data: newRecord }
    );
    if (res.ok) {
      toast.success("Record created");
      setCreateDialogOpen(false);
      setNewRecord({});
      fetchRecords(selectedTable);
    } else {
      toast.error("Failed to create record");
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <Database className="w-8 h-8 text-gray-300" />
        </div>
        <p className="text-sm font-medium text-gray-500 mb-1">No database tables</p>
        <p className="text-xs text-gray-400">
          Build your project first to create database tables.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs
        value={activeView}
        onValueChange={setActiveView}
        className="flex-1 flex flex-col"
      >
        <div className="px-3 py-2 border-b bg-gray-50/80 flex items-center justify-between">
          <TabsList className="h-8 bg-white">
            <TabsTrigger value="schema" className="text-xs h-7 px-3">
              Schema
            </TabsTrigger>
            <TabsTrigger value="data" className="text-xs h-7 px-3">
              Data
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={fetchTables}>
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
          </Button>
        </div>

        {/* Schema View */}
        <TabsContent value="schema" className="flex-1 overflow-auto p-4 mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tables.map((table) => (
              <Card
                key={table._id}
                className="p-4 hover:shadow-md transition-shadow border-gray-100"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center">
                    <Table2 className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">
                      {table.label || table.type}
                    </h3>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {Object.keys(table.properties).length} fields
                  </Badge>
                </div>
                {table.description && (
                  <p className="text-xs text-gray-400 mb-3 line-clamp-1">
                    {table.description}
                  </p>
                )}
                <div className="space-y-1.5">
                  {Object.values(table.properties)
                    .slice(0, 8)
                    .map((prop: DbProperty) => (
                      <div
                        key={prop.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span className="text-gray-600 font-mono truncate flex-1">
                          {prop.name}
                        </span>
                        <Badge
                          className={`text-[10px] h-4 border-0 shrink-0 ${getPropertyTypeColor(
                            prop.propertyType
                          )}`}
                        >
                          {prop.propertyType}
                        </Badge>
                        {prop.propertyType === "objectReference" &&
                          prop.objectReference?.tableTo && (
                            <span className="flex items-center gap-0.5 text-violet-500 shrink-0">
                              <ArrowRight className="w-3 h-3" />
                              <span className="font-mono text-[10px]">
                                {prop.objectReference.tableTo}
                              </span>
                            </span>
                          )}
                      </div>
                    ))}
                  {Object.keys(table.properties).length > 8 && (
                    <p className="text-[10px] text-gray-400 pt-1">
                      +{Object.keys(table.properties).length - 8} more fields
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Data View */}
        <TabsContent value="data" className="flex-1 flex flex-col overflow-hidden mt-0">
          {/* Controls */}
          <div className="px-3 py-2.5 border-b flex items-center gap-3 bg-white">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Select table" />
              </SelectTrigger>
              <SelectContent>
                {tables.map((t) => (
                  <SelectItem key={t.type} value={t.type}>
                    {t.label || t.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7"
              onClick={() => fetchRecords(selectedTable)}
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="ml-auto h-7 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Record
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    Create Record in {currentTable?.label || selectedTable}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-4">
                  {currentProperties
                    .filter(
                      (p) =>
                        p.name !== "_id" &&
                        p.name !== "createdAt" &&
                        p.name !== "updatedAt"
                    )
                    .map((prop) => (
                      <div key={prop.id}>
                        <Label className="text-xs">
                          {prop.label || prop.name}
                          <span className="text-gray-400 ml-1">({prop.propertyType})</span>
                        </Label>
                        <Input
                          className="mt-1 h-8 text-sm"
                          placeholder={`Enter ${prop.label || prop.name}`}
                          value={newRecord[prop.name] || ""}
                          onChange={(e) =>
                            setNewRecord((prev) => ({
                              ...prev,
                              [prop.name]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    ))}
                  <Button
                    className="w-full"
                    size="sm"
                    onClick={handleCreateRecord}
                    disabled={creating}
                  >
                    {creating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Create Record
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Records Table */}
          <div className="flex-1 overflow-auto">
            {recordsLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">No records found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {currentProperties.slice(0, 6).map((prop) => (
                      <TableHead
                        key={prop.id}
                        className="text-xs whitespace-nowrap font-medium"
                      >
                        {prop.label || prop.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record, idx) => (
                    <TableRow key={(record._id as string) || idx}>
                      {currentProperties.slice(0, 6).map((prop) => (
                        <TableCell
                          key={prop.id}
                          className="text-xs max-w-[200px] truncate"
                        >
                          {formatCellValue(record[prop.name], prop.propertyType)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
