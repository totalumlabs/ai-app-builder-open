"use client";

import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import type { ConversationMessage } from "@/lib/vcaas-types";

interface ChatPanelProps {
  messages: ConversationMessage[];
  isBuilding: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  sending: boolean;
}

export function ChatPanel({
  messages,
  isBuilding,
  prompt,
  setPrompt,
  onSend,
  onStop,
  sending,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isBuilding]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const getMessageStyle = (msg: ConversationMessage) => {
    if (msg.author === "user") return "bg-violet-50 border-violet-100";
    switch (msg.messageType) {
      case "starting":
        return "bg-blue-50 border-blue-100";
      case "building":
        return "bg-amber-50 border-amber-100";
      case "finished":
        return "bg-emerald-50 border-emerald-100";
      case "error":
        return "bg-red-50 border-red-100";
      case "limit-reached":
        return "bg-orange-50 border-orange-100";
      default:
        return "bg-gray-50 border-gray-100";
    }
  };

  const getStatusIcon = (msg: ConversationMessage) => {
    switch (msg.messageType) {
      case "finished":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
      case "error":
        return <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
      case "building":
        return <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />;
      case "starting":
        return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !isBuilding && (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
              <Bot className="w-7 h-7 text-violet-400" />
            </div>
            <h3 className="font-medium text-gray-600 mb-2">Start building</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Describe what you want to build and the AI agent will create it for you in minutes.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={`${msg.createdAt}-${i}`} className={`rounded-lg border p-3 ${getMessageStyle(msg)}`}>
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {msg.author === "user" ? (
                  <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center">
                    <User className="w-3 h-3 text-white" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-500">
                    {msg.author === "user" ? "You" : "Agent"}
                  </span>
                  {getStatusIcon(msg)}
                  <span className="text-[10px] text-gray-400">
                    {new Date(msg.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                  {msg.message}
                </p>

                {/* Secret keys needed */}
                {msg.secretKeysNeeded &&
                  Object.keys(msg.secretKeysNeeded).length > 0 && (
                    <div className="mt-3 p-2.5 bg-white rounded-lg border border-amber-200">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Key className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-amber-700">
                          Secret keys needed
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(msg.secretKeysNeeded).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 text-xs">
                            <code className="bg-amber-50 px-1.5 py-0.5 rounded font-mono text-amber-800 text-[11px]">
                              {key}
                            </code>
                            <span className="text-gray-500 flex-1 truncate">{val.description}</span>
                            {val.isProvided ? (
                              <Badge className="text-[10px] h-4 bg-emerald-100 text-emerald-700 border-0">
                                Set
                              </Badge>
                            ) : (
                              <Badge className="text-[10px] h-4 bg-red-100 text-red-700 border-0">
                                Missing
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Git diff link */}
                {msg.gitDiffUrl && (
                  <a
                    href={msg.gitDiffUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs text-violet-600 hover:text-violet-800 hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View changes
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Building animation */}
        {isBuilding && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100">
            <div className="flex gap-1">
              <span
                className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-sm font-medium text-violet-600">
              Building your project...
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t bg-white">
        <div className="flex gap-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isBuilding ? "Agent is working..." : "Describe what you want to build..."}
            className="min-h-[56px] max-h-[120px] resize-none text-sm"
            disabled={isBuilding}
          />
          {isBuilding ? (
            <Button
              variant="destructive"
              size="icon"
              className="shrink-0 self-end h-10 w-10"
              onClick={onStop}
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="shrink-0 self-end h-10 w-10 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              onClick={onSend}
              disabled={!prompt.trim() || sending}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
