"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Key, Plus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { VcaasSecret } from "@/lib/vcaas-types";

interface SecretsPanelProps {
  projectId: string;
  secrets: VcaasSecret[];
  onSecretsChanged: () => void;
}

export function SecretsPanel({
  projectId,
  secrets,
  onSecretsChanged,
}: SecretsPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [env, setEnv] = useState("both");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !value.trim()) return;
    setSaving(true);
    console.log("[Secrets] Creating secret:", name.trim());
    const res = await api.post(`/api/vcaas/projects/${projectId}/secrets`, {
      secretName: name.trim(),
      secretValue: value.trim(),
      environment: env,
    });
    if (res.ok) {
      toast.success("Secret created");
      setName("");
      setValue("");
      setShowForm(false);
      onSecretsChanged();
    } else {
      toast.error(res.error || "Failed to create secret");
    }
    setSaving(false);
  };

  const handleDelete = async (secretId: string, secretName: string) => {
    if (!confirm(`Delete secret "${secretName}"?`)) return;
    setDeleting(secretId);
    const res = await api.delete(
      `/api/vcaas/projects/${projectId}/secrets/${secretId}`
    );
    if (res.ok) {
      toast.success("Secret deleted");
      onSecretsChanged();
    } else {
      toast.error(res.error || "Failed to delete secret");
    }
    setDeleting(null);
  };

  const getEnvColor = (environment: string) => {
    switch (environment) {
      case "development":
        return "bg-blue-100 text-blue-700";
      case "production":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b bg-gray-50/80 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">
          {secrets.length} secret{secrets.length !== 1 ? "s" : ""}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Secret
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {/* Create form */}
        {showForm && (
          <Card className="p-4 border-violet-200 bg-violet-50/30">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Name</Label>
                <Input
                  className="mt-1 h-8 text-sm bg-white"
                  placeholder="STRIPE_SECRET_KEY"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Value</Label>
                <Input
                  className="mt-1 h-8 text-sm bg-white"
                  type="password"
                  placeholder="sk_live_..."
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Environment</Label>
                <Select value={env} onValueChange={setEnv}>
                  <SelectTrigger className="mt-1 h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-8"
                  onClick={handleCreate}
                  disabled={saving || !name.trim() || !value.trim()}
                >
                  {saving ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 mr-1" />
                  )}
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Empty state */}
        {secrets.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
              <ShieldCheck className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">
              No secrets configured
            </p>
            <p className="text-xs text-gray-400">
              Add API keys and environment variables your app needs.
            </p>
          </div>
        )}

        {/* Secret list */}
        {secrets.map((secret) => (
          <Card
            key={secret._id}
            className="p-3 flex items-center justify-between border-gray-100"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                <Key className="w-4 h-4 text-gray-400" />
              </div>
              <div className="min-w-0">
                <code className="text-sm font-mono font-medium block truncate">
                  {secret.secretName}
                </code>
                <Badge
                  className={`text-[10px] h-4 border-0 mt-0.5 ${getEnvColor(
                    secret.environment
                  )}`}
                >
                  {secret.environment}
                </Badge>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-gray-400 hover:text-red-500 shrink-0"
              onClick={() => handleDelete(secret._id, secret.secretName)}
              disabled={deleting === secret._id}
            >
              {deleting === secret._id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
