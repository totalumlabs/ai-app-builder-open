"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Trash2, Loader2, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { VcaasDomain } from "@/lib/vcaas-types";

interface DomainPanelProps {
  projectId: string;
  domain: VcaasDomain | null | undefined;
  productionUrl?: string;
  onDomainChanged: () => void;
}

export function DomainPanel({
  projectId,
  domain,
  productionUrl,
  onDomainChanged,
}: DomainPanelProps) {
  const [hostname, setHostname] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!hostname.trim()) return;
    setAdding(true);
    console.log("[Domain] Adding domain:", hostname.trim());
    const res = await api.put(`/api/vcaas/projects/${projectId}/domain`, {
      hostname: hostname.trim(),
    });
    if (res.ok) {
      toast.success("Custom domain added! Configure the DNS records below.");
      setHostname("");
      onDomainChanged();
    } else {
      toast.error(res.error || "Failed to add domain. Make sure you've deployed first.");
    }
    setAdding(false);
  };

  const handleRemove = async () => {
    if (!confirm("Remove custom domain?")) return;
    setRemoving(true);
    const res = await api.delete(`/api/vcaas/projects/${projectId}/domain`);
    if (res.ok) {
      toast.success("Domain removed");
      onDomainChanged();
    } else {
      toast.error(res.error || "Failed to remove domain");
    }
    setRemoving(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-emerald-100 text-emerald-700";
      case "pending_validation":
        return "bg-amber-100 text-amber-700";
      case "pending_deployment":
        return "bg-blue-100 text-blue-700";
      case "blocked":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b bg-gray-50/80">
        <span className="text-xs font-medium text-gray-500">Custom Domain</span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Production URL */}
        {productionUrl && (
          <Card className="p-4 border-gray-100">
            <Label className="text-[10px] text-gray-400 uppercase tracking-wider">
              Production URL
            </Label>
            <div className="flex items-center gap-2 mt-1.5">
              <code className="text-sm font-mono text-gray-700 flex-1 truncate">
                {productionUrl}
              </code>
              <a
                href={`https://${productionUrl}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="ghost" size="icon" className="w-7 h-7">
                  <ExternalLink className="w-3.5 h-3.5 text-violet-600" />
                </Button>
              </a>
            </div>
          </Card>
        )}

        {/* Domain configured */}
        {domain ? (
          <Card className="p-4 border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-violet-600" />
                </div>
                <span className="font-medium text-sm">{domain.hostname}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  className={`text-[10px] h-5 border-0 ${getStatusColor(domain.status)}`}
                >
                  {domain.status.replace(/_/g, " ")}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-7 h-7 text-gray-400 hover:text-red-500"
                  onClick={handleRemove}
                  disabled={removing}
                >
                  {removing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>

            {/* DNS Records */}
            {domain.dnsRecordsToAdd && domain.dnsRecordsToAdd.length > 0 && (
              <div>
                <Label className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 block">
                  DNS Records to Configure
                </Label>
                <div className="space-y-2">
                  {domain.dnsRecordsToAdd.map((record, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 rounded-lg p-3 text-xs"
                    >
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <span className="text-gray-400 block mb-0.5">Type</span>
                          <p className="font-mono font-semibold">{record.type}</p>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-400 block mb-0.5">Name</span>
                          <div className="flex items-center gap-1">
                            <p className="font-mono font-medium truncate">
                              {record.name}
                            </p>
                            <button
                              onClick={() =>
                                copyToClipboard(record.name, `name-${idx}`)
                              }
                              className="shrink-0"
                            >
                              {copiedField === `name-${idx}` ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <span className="text-gray-400 block mb-0.5">Value</span>
                          <div className="flex items-center gap-1">
                            <p className="font-mono font-medium truncate">
                              {record.value}
                            </p>
                            <button
                              onClick={() =>
                                copyToClipboard(record.value, `value-${idx}`)
                              }
                              className="shrink-0"
                            >
                              {copiedField === `value-${idx}` ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ) : (
          /* Add domain form */
          <Card className="p-4 border-gray-100">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium">Add Custom Domain</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              Connect a custom subdomain (e.g., app.yourdomain.com). Your project must
              be deployed first.
            </p>
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm"
                placeholder="app.yourdomain.com"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
              />
              <Button
                size="sm"
                className="h-8 shrink-0"
                onClick={handleAdd}
                disabled={adding || !hostname.trim()}
              >
                {adding ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Add"
                )}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
