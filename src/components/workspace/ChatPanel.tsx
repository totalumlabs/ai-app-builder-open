"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Square,
  Loader2,
  Bot,
  User,
  AlertCircle,
  CheckCircle2,
  Key,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Paperclip,
  X,
} from "lucide-react";
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

// Group consecutive building messages between start/finish
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

    // Check if this is a start of a build sequence
    if (msg.author === "agent" && (msg.messageType === "starting" || msg.messageType === "building")) {
      const buildGroup: ConversationMessage[] = [];
      let startMsg: ConversationMessage | undefined;
      let finishMsg: ConversationMessage | undefined;
      const buildMsgs: ConversationMessage[] = [];

      // Collect all related messages until finished/error or user message
      while (i < messages.length) {
        const current = messages[i];
        if (current.author === "user" && buildGroup.length > 0) break;

        buildGroup.push(current);
        if (current.messageType === "starting") {
          startMsg = current;
        } else if (current.messageType === "finished" || current.messageType === "error" || current.messageType === "limit-reached") {
          finishMsg = current;
          i++;
          break;
        } else if (current.messageType === "building") {
          buildMsgs.push(current);
        }
        i++;
      }

      groups.push({
        type: "build-group",
        messages: buildGroup,
        startMsg,
        finishMsg,
        buildMsgs,
      });
    } else {
      groups.push({ type: "single", messages: [msg] });
      i++;
    }
  }
  return groups;
}

function BuildGroup({ group }: { group: MessageGroup }) {
  const [expanded, setExpanded] = useState(false);
  const hasBuildMsgs = (group.buildMsgs?.length || 0) > 0;
  const isComplete = !!group.finishMsg;

  return (
    <div className="space-y-1.5">
      {/* Start message */}
      {group.startMsg && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-blue-50/80 border border-blue-100">
          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin mt-0.5 shrink-0" />
          <span className="text-sm text-blue-700">{group.startMsg.message}</span>
        </div>
      )}

      {/* Collapsible build messages */}
      {hasBuildMsgs && isComplete && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 transition-colors"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {group.buildMsgs!.length} build step{group.buildMsgs!.length !== 1 ? "s" : ""}
        </button>
      )}

      {/* Build messages - collapsed when done, shown when building or expanded */}
      {((!isComplete || expanded) && group.buildMsgs) &&
        group.buildMsgs.map((msg, idx) => (
          <div key={idx} className="flex items-start gap-2 px-3 py-1.5 rounded-md bg-amber-50/60 border border-amber-100/60 ml-3">
            {!isComplete ? (
              <Loader2 className="w-3 h-3 text-amber-500 animate-spin mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
            )}
            <span className="text-xs text-amber-700/80 leading-relaxed">{msg.message}</span>
          </div>
        ))}

      {/* Finish message */}
      {group.finishMsg && (
        <div className={`px-3 py-2.5 rounded-lg border ${
          group.finishMsg.messageType === "error" ? "bg-red-50/80 border-red-100" :
          group.finishMsg.messageType === "limit-reached" ? "bg-orange-50/80 border-orange-100" :
          "bg-emerald-50/80 border-emerald-100"
        }`}>
          <div className="flex items-start gap-2">
            {group.finishMsg.messageType === "error" ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-700 leading-relaxed">{group.finishMsg.message}</span>
              {/* Secret keys */}
              {group.finishMsg.secretKeysNeeded && Object.keys(group.finishMsg.secretKeysNeeded).length > 0 && (
                <div className="mt-2 p-2 bg-white rounded-md border border-amber-200">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Key className="w-3 h-3 text-amber-500" />
                    <span className="text-[11px] font-semibold text-amber-700">Secret keys needed</span>
                  </div>
                  {Object.entries(group.finishMsg.secretKeysNeeded).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1.5 text-[11px] mt-1">
                      <code className="bg-amber-50 px-1 py-0.5 rounded font-mono text-amber-800">{key}</code>
                      <span className="text-gray-500 flex-1 truncate">{val.description}</span>
                      <Badge className={`text-[9px] h-3.5 border-0 ${val.isProvided ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {val.isProvided ? "Set" : "Missing"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {group.finishMsg.gitDiffUrl && (
                <a href={group.finishMsg.gitDiffUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-violet-600 hover:underline">
                  <ExternalLink className="w-2.5 h-2.5" /> View changes
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatPanel({
  messages,
  isBuilding,
  prompt,
  setPrompt,
  onSend,
  onStop,
  sending,
  projectId,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; url: string; imageDescription: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isBuilding]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!prompt.trim() && attachedFiles.length === 0) return;
    onSend(attachedFiles.length > 0 ? attachedFiles : undefined);
    setAttachedFiles([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/vcaas/upload/${projectId}`, {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as { ok: boolean; data?: { url: string; fileNameId: string } };
      if (json.ok && json.data) {
        setAttachedFiles((prev) => [...prev, {
          name: file.name,
          url: json.data!.url,
          imageDescription: file.name,
        }]);
      }
    } catch (err) {
      console.error("[ChatPanel] File upload error:", err);
    }
    setUploading(false);
    e.target.value = "";
  };

  const messageGroups = groupMessages(messages);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 && !isBuilding && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center mb-3">
              <Bot className="w-6 h-6 text-violet-500" />
            </div>
            <h3 className="font-medium text-gray-600 mb-1 text-sm">Start building</h3>
            <p className="text-xs text-gray-400 leading-relaxed max-w-[240px]">
              Describe what you want and the AI will build it for you.
            </p>
          </div>
        )}

        {messageGroups.map((group, gi) => {
          if (group.type === "build-group") {
            return <BuildGroup key={gi} group={group} />;
          }

          const msg = group.messages[0];
          if (msg.author === "user") {
            return (
              <div key={gi} className="flex justify-end">
                <div className="max-w-[85%] bg-violet-600 text-white rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-sm">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                </div>
              </div>
            );
          }

          return (
            <div key={gi} className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-3 h-3 text-gray-500" />
              </div>
              <div className="max-w-[85%] bg-gray-50 rounded-2xl rounded-bl-md px-3.5 py-2.5 border border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
              </div>
            </div>
          );
        })}

        {/* Building animation */}
        {isBuilding && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
              <Bot className="w-3 h-3 text-violet-500" />
            </div>
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 rounded-2xl rounded-bl-md px-3.5 py-2.5 border border-violet-100">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-violet-600 font-medium">Building...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Attached files preview */}
      {attachedFiles.length > 0 && (
        <div className="px-3 pb-1 flex gap-2 flex-wrap">
          {attachedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-violet-50 text-violet-700 rounded-lg px-2 py-1 text-xs">
              <Paperclip className="w-3 h-3" />
              <span className="truncate max-w-[120px]">{f.name}</span>
              <button onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}>
                <X className="w-3 h-3 hover:text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-white">
        <div className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 px-3 py-2 transition-all">
          {/* File upload */}
          <label className="cursor-pointer shrink-0 self-end pb-0.5">
            <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.svg" />
            {uploading ? (
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            ) : (
              <Paperclip className="w-4 h-4 text-gray-400 hover:text-violet-600 transition-colors" />
            )}
          </label>

          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isBuilding ? "Agent is working..." : "Describe what to build..."}
            className="flex-1 bg-transparent border-0 resize-none text-sm outline-none placeholder:text-gray-400 min-h-[24px] max-h-[160px] py-0.5 leading-relaxed"
            disabled={isBuilding}
            rows={1}
          />

          {isBuilding ? (
            <Button variant="ghost" size="icon" className="shrink-0 w-8 h-8 rounded-xl text-red-500 hover:bg-red-50" onClick={onStop}>
              <Square className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              onClick={handleSend}
              disabled={(!prompt.trim() && attachedFiles.length === 0) || sending}
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
