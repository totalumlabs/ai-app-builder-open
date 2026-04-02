"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Send, Square, Loader2, Bot, AlertCircle, CheckCircle2,
  Key, ExternalLink, ChevronDown, ChevronRight, Paperclip, X, Check,
  Plus, Eye, EyeOff, CheckCircle, ArrowRight,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";
import type { ConversationMessage } from "@/lib/vcaas-types";

interface ChatPanelProps {
  messages: ConversationMessage[];
  isBuilding: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  onSend: (files?: { name: string; url: string; imageDescription: string }[]) => void;
  onStop: () => void;
  sending: boolean;
  projectId: string;
}

interface MessageGroup {
  type: "single" | "build-group";
  messages: ConversationMessage[];
  startMsg?: ConversationMessage;
  finishMsg?: ConversationMessage;
  buildMsgs?: ConversationMessage[];
}

function groupMessages(messages: ConversationMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.author === "agent" && (msg.messageType === "starting" || msg.messageType === "building")) {
      const buildGroup: ConversationMessage[] = [];
      let startMsg: ConversationMessage | undefined;
      let finishMsg: ConversationMessage | undefined;
      const buildMsgs: ConversationMessage[] = [];
      while (i < messages.length) {
        const current = messages[i];
        if (current.author === "user" && buildGroup.length > 0) break;
        buildGroup.push(current);
        if (current.messageType === "starting") startMsg = current;
        else if (current.messageType === "finished" || current.messageType === "error" || current.messageType === "limit-reached") { finishMsg = current; i++; break; }
        else if (current.messageType === "building") buildMsgs.push(current);
        i++;
      }
      groups.push({ type: "build-group", messages: buildGroup, startMsg, finishMsg, buildMsgs });
    } else {
      groups.push({ type: "single", messages: [msg] });
      i++;
    }
  }
  return groups;
}

function renderInline(text: string, keyPrefix: string = "0"): React.ReactNode[] {
  // Split by: bold, links, inline code
  const tokens = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g);
  return tokens.map((token, ti) => {
    const key = `${keyPrefix}-${ti}`;
    // Bold
    if (token.startsWith("**") && token.endsWith("**")) {
      return <strong key={key} className="font-semibold">{token.slice(2, -2)}</strong>;
    }
    // Link [text](url)
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return <a key={key} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">{linkMatch[1]}</a>;
    }
    // Inline code
    if (token.startsWith("`") && token.endsWith("`")) {
      return <code key={key} className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs font-mono">{token.slice(1, -1)}</code>;
    }
    return <span key={key}>{token}</span>;
  });
}

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed space-y-1">
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const code = part.slice(3, -3).replace(/^\w+\n/, "");
          return <pre key={i} className="bg-gray-900 text-gray-200 rounded-lg p-3 text-xs font-mono overflow-x-auto my-2">{code}</pre>;
        }
        return part.split("\n").map((line, li) => {
          const lineKey = `${i}-${li}`;
          if (line.startsWith("# ")) return <h3 key={lineKey} className="font-semibold text-base mt-2">{renderInline(line.slice(2), lineKey)}</h3>;
          if (line.startsWith("## ")) return <h4 key={lineKey} className="font-semibold text-[15px] mt-1.5">{renderInline(line.slice(3), lineKey)}</h4>;
          if (line.startsWith("### ")) return <h5 key={lineKey} className="font-semibold text-sm mt-1">{renderInline(line.slice(4), lineKey)}</h5>;
          if (line.startsWith("- ") || line.startsWith("* ")) return <div key={lineKey} className="flex gap-1.5"><span className="text-gray-400 shrink-0">•</span><span>{renderInline(line.slice(2), lineKey)}</span></div>;
          const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
          if (numberedMatch) return <div key={lineKey} className="flex gap-1.5"><span className="text-gray-400 shrink-0 min-w-[1.2em] text-right">{numberedMatch[1]}.</span><span>{renderInline(numberedMatch[2], lineKey)}</span></div>;
          if (line.trim() === "") return <div key={lineKey} className="h-1" />;
          return <p key={lineKey}>{renderInline(line, lineKey)}</p>;
        });
      })}
    </div>
  );
}

// --- Interactive Secret Keys Form ---
interface SecretEntry {
  secretName: string;
  description: string;
  entries: { value: string; environment: "both" | "development" | "production"; showValue: boolean }[];
}

function SecretKeysForm({ secretKeysNeeded, projectId, onTellAi }: {
  secretKeysNeeded: Record<string, { isProvided: boolean; description: string }>;
  projectId: string;
  onTellAi: (count: number) => void;
}) {
  const { t } = useI18n();
  const unprovided = Object.entries(secretKeysNeeded).filter(([, v]) => !v.isProvided);
  const provided = Object.entries(secretKeysNeeded).filter(([, v]) => v.isProvided);

  const [secrets, setSecrets] = useState<SecretEntry[]>(() =>
    unprovided.map(([key, val]) => ({
      secretName: key,
      description: val.description,
      entries: [{ value: "", environment: "both", showValue: false }],
    }))
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // No unprovided secrets → nothing to render (all set)
  if (unprovided.length === 0 && provided.length > 0) {
    return (
      <div className="mt-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{t("requiredSecrets")}</span>
        </div>
        {provided.map(([key]) => (
          <div key={key} className="flex items-center gap-2 text-xs mt-1.5">
            <code className="bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded font-mono text-[10px] text-emerald-800 dark:text-emerald-300">{key}</code>
            <Badge className="text-[9px] h-3.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">{t("alreadyProvided")}</Badge>
          </div>
        ))}
      </div>
    );
  }

  if (unprovided.length === 0) return null;

  const updateEntry = (si: number, ei: number, field: string, val: string | boolean) => {
    setSecrets(prev => prev.map((s, i) => i !== si ? s : {
      ...s, entries: s.entries.map((e, j) => j !== ei ? e : { ...e, [field]: val })
    }));
  };

  const addEntry = (si: number) => {
    setSecrets(prev => prev.map((s, i) => {
      if (i !== si || s.entries.length >= 2) return s;
      // Pick a different environment than the first
      const firstEnv = s.entries[0].environment;
      let newEnv: "development" | "production" = "production";
      if (firstEnv === "production") newEnv = "development";
      else if (firstEnv === "both") newEnv = "production";
      return { ...s, entries: [...s.entries, { value: "", environment: newEnv, showValue: false }] };
    }));
  };

  const removeEntry = (si: number, ei: number) => {
    setSecrets(prev => prev.map((s, i) => {
      if (i !== si || s.entries.length <= 1) return s;
      return { ...s, entries: s.entries.filter((_, j) => j !== ei) };
    }));
  };

  const allFilled = secrets.every(s => s.entries.every(e => e.value.trim().length > 0));

  const handleSubmit = async () => {
    if (!allFilled) return;
    setSubmitting(true);
    let successCount = 0;
    for (const secret of secrets) {
      for (const entry of secret.entries) {
        const res = await api.post(`/api/vcaas/projects/${projectId}/secrets`, {
          secretName: secret.secretName,
          secretValue: entry.value.trim(),
          environment: entry.environment,
        });
        if (res.ok) successCount++;
        else console.error(`[SecretKeysForm] Failed to create secret ${secret.secretName}:`, res.error);
      }
    }
    console.log(`[SecretKeysForm] Saved ${successCount} secrets`);
    setSubmitting(false);
    setSubmitted(true);
  };

  const envLabel = (env: string) => {
    if (env === "development") return "Dev";
    if (env === "production") return "Prod";
    return "Dev + Prod";
  };

  if (submitted) {
    const totalKeys = secrets.length;
    return (
      <div className="mt-3 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{t("secretsSaved")}</span>
        </div>
        {secrets.map((s) => (
          <div key={s.secretName} className="flex items-center gap-2 text-xs mt-1">
            <code className="bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded font-mono text-[10px] text-emerald-800 dark:text-emerald-300">{s.secretName}</code>
            <span className="text-emerald-500 text-[10px]">{s.entries.map(e => envLabel(e.environment)).join(", ")}</span>
          </div>
        ))}
        <button
          onClick={() => onTellAi(totalKeys)}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          {t("tellAiSecretsReady")}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-3 pb-1">
        <Key className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t("requiredSecrets")}</span>
        <Badge className="text-[9px] h-3.5 border-0 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 ml-auto">{unprovided.length} {t("missing").toLowerCase()}</Badge>
      </div>

      {/* Already provided keys */}
      {provided.length > 0 && (
        <div className="px-3 pt-1">
          {provided.map(([key]) => (
            <div key={key} className="flex items-center gap-2 text-xs mt-1">
              <code className="bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded font-mono text-[10px] text-emerald-800 dark:text-emerald-300">{key}</code>
              <Badge className="text-[9px] h-3.5 border-0 bg-emerald-100 text-emerald-700">{t("alreadyProvided")}</Badge>
            </div>
          ))}
        </div>
      )}

      {/* Secret inputs */}
      <div className="p-3 space-y-3">
        {secrets.map((secret, si) => (
          <div key={secret.secretName} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="mb-2">
              <code className="text-xs font-mono font-semibold text-gray-800 dark:text-gray-200">{secret.secretName}</code>
              <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{secret.description}</p>
            </div>

            {secret.entries.map((entry, ei) => (
              <div key={ei} className="mt-2">
                {secret.entries.length > 1 && (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-gray-400 font-medium">Environment {ei + 1}</span>
                    <button onClick={() => removeEntry(si, ei)} className="text-[10px] text-red-400 hover:text-red-600 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type={entry.showValue ? "text" : "password"}
                      value={entry.value}
                      onChange={(e) => updateEntry(si, ei, "value", e.target.value)}
                      placeholder={t("secretValue")}
                      className="w-full h-8 px-2.5 pr-8 text-xs rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-amber-300 font-mono"
                    />
                    <button
                      onClick={() => updateEntry(si, ei, "showValue", !entry.showValue)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {entry.showValue ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                  <select
                    value={entry.environment}
                    onChange={(e) => updateEntry(si, ei, "environment", e.target.value)}
                    className="h-8 px-2 text-[11px] rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none focus:ring-1 focus:ring-amber-300 min-w-[90px]"
                  >
                    <option value="both">Dev + Prod</option>
                    <option value="development">Dev only</option>
                    <option value="production">Prod only</option>
                  </select>
                </div>
              </div>
            ))}

            {secret.entries.length < 2 && (
              <button
                onClick={() => addEntry(si)}
                className="flex items-center gap-1 mt-2 text-[10px] text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {t("addEnvironment")}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 pb-3">
        <button
          onClick={handleSubmit}
          disabled={!allFilled || submitting}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white text-xs font-medium transition-colors disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
          {submitting ? t("submittingSecrets") : t("submitSecrets")}
        </button>
      </div>
    </div>
  );
}

// --- Build Group ---
function BuildGroup({ group, projectId, onTellAi }: { group: MessageGroup; projectId: string; onTellAi: (count: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const hasBuildMsgs = (group.buildMsgs?.length || 0) > 0;
  const isComplete = !!group.finishMsg;
  const { t } = useI18n();

  return (
    <div className="space-y-1">
      {hasBuildMsgs && (
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-0.5 transition-colors">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {isComplete ? `${group.buildMsgs!.length} ${t("buildSteps")}` : `${t("building")} (${group.buildMsgs!.length})`}
          {!isComplete && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
        </button>
      )}
      {expanded && group.buildMsgs?.map((msg, idx) => (
        <div key={idx} className="text-xs text-gray-400 dark:text-gray-500 pl-4 py-0.5 border-l-2 border-gray-100 dark:border-gray-700">{msg.message}</div>
      ))}

      {/* Finish message - NO background at all */}
      {group.finishMsg && (
        <div className="py-1">
          {group.finishMsg.messageType === "error" ? (
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <FormattedText text={group.finishMsg.message} />
            </div>
          ) : (
            <div>
              <FormattedText text={group.finishMsg.message} />
              {/* Checkmark + Completed at the end */}
              <div className="flex items-center gap-1.5 mt-3 text-sm text-emerald-600 dark:text-emerald-400">
                <Check className="w-4 h-4" />
                <span className="font-medium">{t("completed")}</span>
              </div>
            </div>
          )}
          {/* Interactive Secret Keys Form */}
          {group.finishMsg.secretKeysNeeded && Object.keys(group.finishMsg.secretKeysNeeded).length > 0 && (
            <SecretKeysForm
              secretKeysNeeded={group.finishMsg.secretKeysNeeded}
              projectId={projectId}
              onTellAi={onTellAi}
            />
          )}
          {group.finishMsg.gitDiffUrl && (
            <a href={group.finishMsg.gitDiffUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><ExternalLink className="w-2.5 h-2.5" /> {t("viewChanges")}</a>
          )}
        </div>
      )}
      {!isComplete && !hasBuildMsgs && group.startMsg && (
        <div className="flex items-center gap-2 text-[15px] text-gray-500 py-1"><Loader2 className="w-4 h-4 animate-spin" /><span>{group.startMsg.message}</span></div>
      )}
    </div>
  );
}

export function ChatPanel({ messages, isBuilding, prompt, setPrompt, onSend, onStop, sending, projectId }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; url: string; imageDescription: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const { t } = useI18n();

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages, isBuilding]);
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = "auto"; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px"; } }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const handleSend = () => { if (!prompt.trim() && attachedFiles.length === 0) return; onSend(attachedFiles.length > 0 ? attachedFiles : undefined); setAttachedFiles([]); };

  const handleTellAiSecretsReady = useCallback((count: number) => {
    const msg = `I have already filled and saved ${count} secret key${count > 1 ? "s" : ""}. Please continue.`;
    setPrompt(msg);
    // Auto-send after a tiny delay so the prompt is set
    setTimeout(() => { onSend(); }, 100);
  }, [setPrompt, onSend]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData(); formData.append("file", file);
      const res = await fetch(`/api/vcaas/upload/${projectId}`, { method: "POST", body: formData });
      const json = (await res.json()) as { ok: boolean; data?: { url: string; fileNameId: string } };
      if (json.ok && json.data) setAttachedFiles((prev) => [...prev, { name: file.name, url: json.data!.url, imageDescription: file.name }]);
    } catch (err) { console.error("[ChatPanel] Upload error:", err); }
    setUploading(false); e.target.value = "";
  };

  const messageGroups = groupMessages(messages);

  return (
    <div className="flex flex-col h-full bg-inherit">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isBuilding && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3"><Bot className="w-5 h-5 text-gray-400" /></div>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 mb-1">{t("startBuilding2")}</p>
            <p className="text-sm text-gray-400">{t("describeIdea")}</p>
          </div>
        )}

        {messageGroups.map((group, gi) => {
          if (group.type === "build-group") return <BuildGroup key={gi} group={group} projectId={projectId} onTellAi={handleTellAiSecretsReady} />;
          const msg = group.messages[0];
          if (msg.author === "user") {
            return (
              <div key={gi} className="flex justify-end">
                <div className="max-w-[88%] rounded-2xl rounded-br-sm px-4 py-2.5" style={{ background: "var(--user-bubble, #eeecea)" }}>
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200">{msg.message}</p>
                </div>
              </div>
            );
          }
          // Agent message - NO background
          return <div key={gi} className="max-w-full"><FormattedText text={msg.message} /></div>;
        })}

        {isBuilding && (
          <div className="flex items-center gap-2 py-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-sm text-gray-400">{t("building")}</span>
          </div>
        )}
      </div>

      {attachedFiles.length > 0 && (
        <div className="px-4 pb-1 flex gap-1.5 flex-wrap">
          {attachedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-md px-2 py-0.5 text-[11px]">
              <Paperclip className="w-2.5 h-2.5" /><span className="truncate max-w-[100px]">{f.name}</span>
              <button onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}><X className="w-2.5 h-2.5 hover:text-red-500" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="shrink-0 px-3 pb-3 pt-2">
        <div className="rounded-2xl overflow-hidden transition-all focus-within:ring-2 focus-within:ring-gray-200 dark:focus-within:ring-gray-600" style={{ background: "var(--textarea-bg, #f3f1ee)" }}>
          <textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyDown}
            placeholder={isBuilding ? t("agentWorking") : t("askAnything")}
            className="w-full bg-transparent border-0 resize-none text-base outline-none placeholder:text-gray-400 min-h-[48px] max-h-[200px] px-4 pt-3.5 pb-1 leading-relaxed dark:text-gray-200"
            disabled={isBuilding} rows={1} />
          <div className="flex items-center justify-between px-3 pb-2.5">
            <label className="cursor-pointer p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
              <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.svg" />
              {uploading ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" /> : <Paperclip className="w-4 h-4 text-gray-400" />}
            </label>
            {isBuilding ? (
              <button onClick={onStop} className="w-8 h-8 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"><Square className="w-3 h-3 text-white" /></button>
            ) : (
              <button onClick={handleSend} disabled={(!prompt.trim() && attachedFiles.length === 0) || sending}
                className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:bg-gray-300 dark:disabled:bg-gray-600 flex items-center justify-center transition-colors">
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white dark:text-gray-900" /> : <Send className="w-3.5 h-3.5 text-white dark:text-gray-900" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
