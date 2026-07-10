"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2, AlertCircle, Copy, Check, Download,
  ChevronDown, ChevronRight, UnfoldVertical, FoldVertical, FileDiff,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

/* ────────────────────────── unified diff parsing ────────────────────────── */

type LineKind = "add" | "del" | "context" | "hunk" | "meta";

interface DiffLine {
  kind: LineKind;
  content: string;
  /** Line number in the original file (null for added lines / hunk headers). */
  oldNo: number | null;
  /** Line number in the new file (null for removed lines / hunk headers). */
  newNo: number | null;
}

type FileStatus = "added" | "deleted" | "renamed" | "modified";

interface DiffFile {
  /** Path shown in the header — the new path, or the old path when deleted. */
  path: string;
  oldPath: string | null;
  status: FileStatus;
  isBinary: boolean;
  additions: number;
  deletions: number;
  lines: DiffLine[];
}

/** Strip a leading `a/` or `b/` prefix that git puts on diff paths. */
function stripPrefix(p: string): string {
  return p.replace(/^[ab]\//, "");
}

/**
 * Parse a unified (git) diff into per-file blocks.
 *
 * Handles the shapes VCaaS emits: `diff --git` headers, new/deleted file modes,
 * renames, binary markers, and standard `@@` hunks. Anything unrecognised is
 * kept as a `meta` line rather than dropped, so nothing silently disappears
 * from the review.
 */
export function parseDiff(raw: string): DiffFile[] {
  const files: DiffFile[] = [];
  const lines = raw.split("\n");

  let current: DiffFile | null = null;
  let oldNo = 0;
  let newNo = 0;

  const push = () => {
    if (current) files.push(current);
  };

  for (const line of lines) {
    // ── New file block ──
    if (line.startsWith("diff --git ")) {
      push();
      const m = line.match(/^diff --git (\S+) (\S+)$/);
      const oldP = m ? stripPrefix(m[1]) : "";
      const newP = m ? stripPrefix(m[2]) : "";
      current = {
        path: newP || oldP,
        oldPath: oldP && oldP !== newP ? oldP : null,
        status: "modified",
        isBinary: false,
        additions: 0,
        deletions: 0,
        lines: [],
      };
      continue;
    }

    if (!current) continue; // preamble before the first file — ignore

    // ── File-level metadata ──
    if (line.startsWith("new file mode")) { current.status = "added"; continue; }
    if (line.startsWith("deleted file mode")) { current.status = "deleted"; continue; }
    if (line.startsWith("rename from ")) {
      current.status = "renamed";
      current.oldPath = line.slice("rename from ".length);
      continue;
    }
    if (line.startsWith("rename to ")) {
      current.status = "renamed";
      current.path = line.slice("rename to ".length);
      continue;
    }
    if (line.startsWith("Binary files") || line.startsWith("GIT binary patch")) {
      current.isBinary = true;
      current.lines.push({ kind: "meta", content: line, oldNo: null, newNo: null });
      continue;
    }
    // Noise we don't need to render.
    if (
      line.startsWith("index ") ||
      line.startsWith("old mode") ||
      line.startsWith("new mode") ||
      line.startsWith("similarity index") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    ) {
      continue;
    }

    // ── Hunk header: @@ -oldStart,oldLen +newStart,newLen @@ ──
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldNo = parseInt(hunk[1], 10);
      newNo = parseInt(hunk[2], 10);
      current.lines.push({ kind: "hunk", content: line, oldNo: null, newNo: null });
      continue;
    }

    // ── Body lines ──
    if (line.startsWith("+")) {
      current.additions++;
      current.lines.push({ kind: "add", content: line.slice(1), oldNo: null, newNo: newNo++ });
    } else if (line.startsWith("-")) {
      current.deletions++;
      current.lines.push({ kind: "del", content: line.slice(1), oldNo: oldNo++, newNo: null });
    } else if (line.startsWith("\\")) {
      // "\ No newline at end of file"
      current.lines.push({ kind: "meta", content: line, oldNo: null, newNo: null });
    } else if (line.startsWith(" ") || line === "") {
      current.lines.push({ kind: "context", content: line.slice(1), oldNo: oldNo++, newNo: newNo++ });
    } else {
      current.lines.push({ kind: "meta", content: line, oldNo: null, newNo: null });
    }
  }

  push();

  // Drop a trailing empty context line produced by the diff's final newline.
  for (const f of files) {
    const last = f.lines[f.lines.length - 1];
    if (last && last.kind === "context" && last.content === "") f.lines.pop();
  }

  return files;
}

/* ──────────────────────────────── styling ──────────────────────────────── */

const STATUS_STYLES: Record<FileStatus, string> = {
  added: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  deleted: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  renamed: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  modified: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const LINE_STYLES: Record<LineKind, string> = {
  add: "bg-green-50 dark:bg-green-950/40",
  del: "bg-red-50 dark:bg-red-950/40",
  context: "",
  hunk: "bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 select-none",
  meta: "text-gray-400 dark:text-gray-500 italic",
};

const SIGN: Record<LineKind, string> = {
  add: "+", del: "-", context: " ", hunk: "", meta: "",
};

/* ───────────────────────────── file block ──────────────────────────────── */

function FileBlock({
  file, open, onToggle, statusLabel,
}: {
  file: DiffFile;
  open: boolean;
  onToggle: () => void;
  statusLabel: string;
}) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-500" />
          : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-500" />}

        <span className="font-mono text-[11px] truncate flex-1 text-gray-800 dark:text-gray-200">
          {file.status === "renamed" && file.oldPath && (
            <span className="text-gray-400">{file.oldPath} → </span>
          )}
          {file.path}
        </span>

        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium uppercase tracking-wide ${STATUS_STYLES[file.status]}`}>
          {statusLabel}
        </span>

        <span className="shrink-0 font-mono text-[10px] tabular-nums">
          {file.additions > 0 && <span className="text-green-600 dark:text-green-400">+{file.additions}</span>}
          {file.additions > 0 && file.deletions > 0 && " "}
          {file.deletions > 0 && <span className="text-red-600 dark:text-red-400">-{file.deletions}</span>}
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto bg-white dark:bg-gray-900">
          {file.isBinary || file.lines.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-gray-400 italic">
              {file.isBinary ? "Binary file — no textual diff" : "No changes to display"}
            </p>
          ) : (
            <table className="w-full border-collapse font-mono text-[11px] leading-[1.5]">
              <tbody>
                {file.lines.map((l, i) => (
                  <tr key={i} className={LINE_STYLES[l.kind]}>
                    <td className="w-10 min-w-10 px-1.5 text-right align-top select-none text-gray-400 dark:text-gray-600 tabular-nums border-r border-gray-100 dark:border-gray-800">
                      {l.oldNo ?? ""}
                    </td>
                    <td className="w-10 min-w-10 px-1.5 text-right align-top select-none text-gray-400 dark:text-gray-600 tabular-nums border-r border-gray-100 dark:border-gray-800">
                      {l.newNo ?? ""}
                    </td>
                    <td className="w-4 min-w-4 pl-1.5 text-center align-top select-none text-gray-400 dark:text-gray-500">
                      {SIGN[l.kind]}
                    </td>
                    <td className="px-1.5 align-top whitespace-pre-wrap break-all text-gray-800 dark:text-gray-200">
                      {l.content || " "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────── modal ────────────────────────────────── */

interface DiffViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The external `gitDiffUrl` from the VCaaS conversation message. */
  diffUrl: string;
}

export function DiffViewer({ open, onOpenChange, diffUrl }: DiffViewerProps) {
  const { t } = useI18n();

  const [raw, setRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  // Fetch through our proxy (the storage host blocks cross-origin browser reads).
  useEffect(() => {
    if (!open || !diffUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    api
      .get<{ diff: string }>(`/api/vcaas/git-diff?url=${encodeURIComponent(diffUrl)}`)
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data) {
          setRaw(res.data.diff);
          setCollapsed(new Set()); // start fully expanded
        } else {
          setError(typeof res.error === "string" ? res.error : t("diffLoadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, diffUrl, t]);

  const files = useMemo(() => (raw ? parseDiff(raw) : []), [raw]);

  const totals = useMemo(
    () => files.reduce(
      (acc, f) => ({ add: acc.add + f.additions, del: acc.del + f.deletions }),
      { add: 0, del: 0 }
    ),
    [files]
  );

  const allCollapsed = files.length > 0 && collapsed.size === files.length;

  const toggleFile = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setCollapsed((prev) =>
      prev.size === files.length ? new Set() : new Set(files.map((f) => f.path))
    );
  }, [files]);

  const handleCopy = useCallback(async () => {
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t("diffCopyFailed"));
    }
  }, [raw, t]);

  const handleDownload = useCallback(() => {
    if (!raw) return;
    const blob = new Blob([raw], { type: "text/x-patch;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "changes.diff";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [raw]);

  const statusLabel = (s: FileStatus) =>
    s === "added" ? t("diffAdded")
      : s === "deleted" ? t("diffDeleted")
        : s === "renamed" ? t("diffRenamed")
          : t("diffModified");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] sm:max-w-5xl max-h-[88vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 space-y-0">
          <div className="flex items-center gap-3 pr-8">
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileDiff className="w-4 h-4" />
              {t("viewChanges")}
            </DialogTitle>

            {files.length > 0 && (
              <span className="font-mono text-[11px] text-gray-500 tabular-nums">
                {files.length} {files.length === 1 ? t("diffFile") : t("diffFiles")}
                {" · "}
                <span className="text-green-600 dark:text-green-400">+{totals.add}</span>
                {" "}
                <span className="text-red-600 dark:text-red-400">-{totals.del}</span>
              </span>
            )}

            <div className="ml-auto flex items-center gap-1.5">
              {files.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {allCollapsed
                    ? <><UnfoldVertical className="w-3 h-3" /> {t("diffExpandAll")}</>
                    : <><FoldVertical className="w-3 h-3" /> {t("diffCollapseAll")}</>}
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                disabled={!raw}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copied
                  ? <><Check className="w-3 h-3 text-green-600" /> {t("diffCopied")}</>
                  : <><Copy className="w-3 h-3" /> {t("diffCopyAll")}</>}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                disabled={!raw}
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-3 h-3" /> {t("diffDownload")}
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> {t("diffLoading")}
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-2 py-10 px-3 text-sm text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{t("diffLoadFailed")}</p>
                <p className="text-xs mt-1 text-red-500/80 break-all">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && files.length === 0 && raw !== null && (
            <p className="py-16 text-center text-sm text-gray-400">{t("diffEmpty")}</p>
          )}

          {!loading && !error && files.map((f) => (
            <FileBlock
              key={f.path}
              file={f}
              open={!collapsed.has(f.path)}
              onToggle={() => toggleFile(f.path)}
              statusLabel={statusLabel(f.status)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
