"use client";

import { useState } from "react";
import { vcaasApi } from "@/lib/vcaas";
import { Button } from "@/components/ui/button";
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
import { Key, Plus, Trash2, Loader2, ShieldCheck, Lock, X } from "lucide-react";
import { toast } from "sonner";
import type { VcaasSecret } from "@/lib/vcaas-types";

interface SecretsPanelProps {
  projectId: string;
  secrets: VcaasSecret[];
  onSecretsChanged: () => void;
}

export function SecretsPanel({ projectId, secrets, onSecretsChanged }: SecretsPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [env, setEnv] = useState("both");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim() || !value.trim()) return;
    setSaving(true);
    const res = await vcaasApi.secrets.create(projectId, {
      secretName: name.trim(),
      secretValue: value.trim(),
      environment: env,
    });
    if (res.ok) {
      toast.success("Secret created");
      setName(""); setValue(""); setShowForm(false);
      onSecretsChanged();
    } else toast.error(res.error || "Failed to create secret");
    setSaving(false);
  };

  const handleDelete = async (secretId: string, secretName: string) => {
    if (!confirm(`Delete "${secretName}"?`)) return;
    setDeleting(secretId);
    const res = await vcaasApi.secrets.remove(projectId, secretId);
    if (res.ok) { toast.success("Secret deleted"); onSecretsChanged(); }
    else toast.error(res.error || "Failed to delete secret");
    setDeleting(null);
  };

  const getEnvLabel = (environment: string) => {
    switch (environment) {
      case "development": return { label: "Dev", color: "bg-sky-100 text-sky-700" };
      case "production": return { label: "Prod", color: "bg-orange-100 text-orange-700" };
      default: return { label: "All", color: "bg-gray-100 text-gray-600" };
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-medium">Environment Variables</span>
          <Badge variant="secondary" className="text-[10px]">{secrets.length}</Badge>
        </div>
        <Button size="sm" className="h-7 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700" onClick={() => setShowForm(!showForm)}>
          {showForm ? <><X className="w-3 h-3 mr-1" /> Cancel</> : <><Plus className="w-3 h-3 mr-1" /> Add Secret</>}
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Create form */}
        {showForm && (
          <div className="m-4 p-4 bg-violet-50/50 rounded-xl border border-violet-100">
            <h4 className="text-xs font-semibold text-gray-700 mb-3">New Secret</h4>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Variable Name</Label>
                <Input className="mt-1 h-9 text-sm bg-white font-mono" placeholder="STRIPE_SECRET_KEY" value={name} onChange={(e) => setName(e.target.value.toUpperCase())} />
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input className="mt-1 h-9 text-sm bg-white" type="password" placeholder="sk_live_..." value={value} onChange={(e) => setValue(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Environment</Label>
                <Select value={env} onValueChange={setEnv}>
                  <SelectTrigger className="mt-1 h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Both (Dev + Prod)</SelectItem>
                    <SelectItem value="development">Development only</SelectItem>
                    <SelectItem value="production">Production only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full h-8 text-xs" onClick={handleCreate} disabled={saving || !name.trim() || !value.trim()}>
                {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />} Create Secret
              </Button>
            </div>
          </div>
        )}

        {/* Secrets list */}
        {secrets.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center mb-4">
              <Lock className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">No secrets configured</p>
            <p className="text-xs text-gray-400 max-w-xs">Add API keys and environment variables your app needs. The AI agent may suggest keys it needs.</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {secrets.map((secret) => {
              const envInfo = getEnvLabel(secret.environment);
              return (
                <div key={secret._id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3.5 hover:shadow-sm transition-shadow group">
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <Key className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono font-medium text-gray-800 block truncate">{secret.secretName}</code>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-[9px] h-4 border-0 ${envInfo.color}`}>{envInfo.label}</Badge>
                      <span className="text-[10px] text-gray-400">{'*'.repeat(16)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => handleDelete(secret._id, secret.secretName)}
                    disabled={deleting === secret._id}
                  >
                    {deleting === secret._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
