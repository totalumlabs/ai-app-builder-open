"use client";

import { useState } from "react";
import { vcaasApi } from "@/lib/vcaas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Trash2, Loader2, Copy, CheckCircle2, ExternalLink, Link2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import type { VcaasDomain } from "@/lib/vcaas-types";

interface DomainPanelProps {
  projectId: string;
  domain: VcaasDomain | null | undefined;
  productionUrl?: string;
  onDomainChanged: () => void;
}

export function DomainPanel({ projectId, domain, productionUrl, onDomainChanged }: DomainPanelProps) {
  const [hostname, setHostname] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!hostname.trim()) return;
    setAdding(true);
    const res = await vcaasApi.domain.set(projectId, { hostname: hostname.trim() });
    if (res.ok) { toast.success("Domain added! Configure DNS records below."); setHostname(""); onDomainChanged(); }
    else toast.error(res.error || "Failed to add domain. Deploy your project first.");
    setAdding(false);
  };

  const handleRemove = async () => {
    if (!confirm("Remove custom domain?")) return;
    setRemoving(true);
    const res = await vcaasApi.domain.remove(projectId);
    if (res.ok) { toast.success("Domain removed"); onDomainChanged(); }
    else toast.error(res.error || "Failed to remove domain");
    setRemoving(false);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "active": return { color: "bg-emerald-100 text-emerald-700", label: "Active" };
      case "pending_validation": return { color: "bg-amber-100 text-amber-700", label: "Pending DNS" };
      case "pending_deployment": return { color: "bg-blue-100 text-blue-700", label: "Deploying" };
      case "blocked": return { color: "bg-red-100 text-red-700", label: "Blocked" };
      default: return { color: "bg-gray-100 text-gray-600", label: status };
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-white flex items-center gap-2">
        <Globe className="w-4 h-4 text-violet-600" />
        <span className="text-sm font-medium">Custom Domain</span>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Production URL card */}
        {productionUrl && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                <Link2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider">Production URL</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-sm font-mono text-emerald-800 flex-1 truncate">{productionUrl}</code>
              <a href={`https://${productionUrl}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="w-7 h-7 text-emerald-600 hover:text-emerald-800">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>
          </div>
        )}

        {/* Domain configured */}
        {domain ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Domain header */}
            <div className="p-4 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{domain.hostname}</h3>
                  <Badge className={`text-[9px] h-4 border-0 mt-0.5 ${getStatusInfo(domain.status).color}`}>
                    {getStatusInfo(domain.status).label}
                  </Badge>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-red-500 h-8 text-xs" onClick={handleRemove} disabled={removing}>
                {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3 h-3 mr-1" /> Remove</>}
              </Button>
            </div>

            {/* DNS Records */}
            {domain.dnsRecordsToAdd && domain.dnsRecordsToAdd.length > 0 && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-amber-700">Configure these DNS records at your domain provider</span>
                </div>
                {/* DNS propagation warning */}
                <div className="flex items-start gap-2 mb-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-700 leading-snug">{"DNS changes can take up to 5 hours to propagate. Your domain will go live automatically once the records are verified."}</p>
                </div>
                <div className="space-y-2">
                  {domain.dnsRecordsToAdd.map((record, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider block mb-0.5">Type</span>
                          <Badge variant="secondary" className="text-xs font-mono">{record.type}</Badge>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider block mb-0.5">Name</span>
                          <div className="flex items-center gap-1">
                            <code className="text-xs font-mono text-gray-800 truncate">{record.name}</code>
                            <button onClick={() => copyToClipboard(record.name, `n${idx}`)} className="shrink-0 p-0.5">
                              {copiedField === `n${idx}` ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-gray-400 hover:text-gray-600" />}
                            </button>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-gray-400 uppercase tracking-wider block mb-0.5">Value</span>
                          <div className="flex items-center gap-1">
                            <code className="text-xs font-mono text-gray-800 truncate">{record.value}</code>
                            <button onClick={() => copyToClipboard(record.value, `v${idx}`)} className="shrink-0 p-0.5">
                              {copiedField === `v${idx}` ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-gray-400 hover:text-gray-600" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Add domain form */
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                <Globe className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Connect Custom Domain</h3>
                <p className="text-xs text-gray-400">Use a subdomain like app.yourdomain.com</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Input className="h-9 text-sm flex-1" placeholder="app.yourdomain.com" value={hostname} onChange={(e) => setHostname(e.target.value)} />
              <Button size="sm" className="h-9 px-4 shrink-0 bg-gradient-to-r from-violet-600 to-indigo-600" onClick={handleAdd} disabled={adding || !hostname.trim()}>
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 mt-3">Your project must be deployed before adding a domain. DNS records will be shown after connecting.</p>
          </div>
        )}
      </div>
    </div>
  );
}
