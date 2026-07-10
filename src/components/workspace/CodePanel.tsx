"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import { unzipSync, gunzipSync } from "fflate";
import {
  Loader2,
  RefreshCw,
  ChevronRight,
  Folder,
  FolderOpen,
  File as FileIcon,
  FileCode2,
  FileJson,
  FileText,
  FileType2,
  ImageIcon,
  Download,
  AlertTriangle,
  FileWarning,
  Search,
  Sparkles,
  X,
} from "lucide-react";

// Monaco must never run during SSR — bring it in dynamically with ssr:false.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
    </div>
  ),
});

interface CodePanelProps {
  projectId: string;
  darkMode?: boolean;
  // Called when the user clicks "Ask AI to edit this file" — receives the file path.
  onAskAiEdit?: (path: string) => void;
}

// ── In-memory byte cache (survives tab switches within the session) ──────────
// Keyed by projectId → { paths → raw bytes }. Images/binaries are rendered
// from here without re-hitting the network.
const byteCacheByProject: Map<string, Map<string, Uint8Array>> = new Map();

// ── In-flight request dedup ──────────────────────────────────────────────────
// The panel is mounted twice at once (desktop + mobile blocks), so both instances
// would otherwise download + decompress the same archive simultaneously. Share a
// single in-flight promise per projectId so the network+unzip work runs only once.
type ArchiveResult = { files: { [path: string]: Uint8Array }; sha: string; count: number };
const inflightByProject: Map<string, Promise<ArchiveResult>> = new Map();

async function downloadAndDecompress(projectId: string): Promise<ArchiveResult> {
  const res = await fetch(`/api/vcaas/source-code/${projectId}`, { cache: "no-store" });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.includes("application/zip")) {
    // Error path: the route returns JSON { ok:false, error }.
    let message = `Request failed (HTTP ${res.status})`;
    try {
      const j = (await res.json()) as { ok?: boolean; error?: unknown };
      if (j && j.error) message = typeof j.error === "string" ? j.error : JSON.stringify(j.error);
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new Error(message);
  }
  const sha = res.headers.get("x-commit-sha") || "";
  const count = parseInt(res.headers.get("x-files-count") || "0", 10) || 0;
  const buffer = await res.arrayBuffer();
  const files = decompressArchive(buffer);
  return { files, sha, count };
}

// Returns a shared in-flight promise for the archive, creating one if none exists.
function loadArchiveOnce(projectId: string): Promise<ArchiveResult> {
  const existing = inflightByProject.get(projectId);
  if (existing) return existing;
  const p = downloadAndDecompress(projectId).finally(() => {
    // Clear once settled so a later refresh/expired-cache load starts fresh.
    inflightByProject.delete(projectId);
  });
  inflightByProject.set(projectId, p);
  return p;
}

// ── Cache constants ──────────────────────────────────────────────────────────
const CACHE_PREFIX = "vibebuild-code-";
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

interface CachePayload {
  ts: number;
  sha: string;
  textFiles: { [path: string]: string };
  paths: string[];
}

// Folders/files that must never be shown even if the archive slips one through.
const IGNORED_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".open-next",
  ".wrangler",
  ".vercel",
  "dist",
  "build",
  "coverage",
  ".turbo",
]);
const IGNORED_FILES = new Set([".DS_Store"]);

function isIgnoredPath(path: string): boolean {
  const segments = path.split("/");
  for (const seg of segments) {
    if (IGNORED_SEGMENTS.has(seg)) return true;
  }
  const base = segments[segments.length - 1];
  if (IGNORED_FILES.has(base)) return true;
  return false;
}

// ── File-type helpers ────────────────────────────────────────────────────────
function getExt(path: string): string {
  const base = path.split("/").pop() || "";
  // Handle dotfiles like ".env" → "env"
  if (base.startsWith(".") && base.indexOf(".", 1) === -1) return base.slice(1).toLowerCase();
  const idx = base.lastIndexOf(".");
  return idx >= 0 ? base.slice(idx + 1).toLowerCase() : "";
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "avif", "ico"]);
// svg is treated as an image when rendered (but is decodable as text too).
const BINARY_EXTS = new Set([
  "pdf", "zip", "gz", "tar", "rar", "7z",
  "mp4", "mov", "webm", "avi", "mkv",
  "mp3", "wav", "ogg", "flac", "m4a",
  "woff", "woff2", "ttf", "otf", "eot",
  "exe", "dll", "so", "dylib", "bin", "wasm",
]);

const TEXT_EXTS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "css", "scss", "less",
  "html", "htm", "md", "mdx", "py", "sh", "bash", "yml", "yaml", "sql",
  "xml", "svg", "toml", "env", "txt", "gitignore", "npmrc", "prettierrc",
  "eslintrc", "editorconfig", "lock", "map", "d", "cts", "mts",
]);

// ── Archive decompression ────────────────────────────────────────────────────
// The VCaaS source-code archive is a gzipped TAR (git archive format). We also
// transparently support a plain ZIP in case the backend ever changes format.
function decompressArchive(buffer: ArrayBuffer): { [path: string]: Uint8Array } {
  const bytes = new Uint8Array(buffer);
  // ZIP magic: "PK\x03\x04"
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return unzipSync(bytes);
  }
  // GZIP magic: 0x1f 0x8b → decompress to raw TAR, then untar.
  let tarBytes: Uint8Array;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    tarBytes = gunzipSync(bytes);
  } else {
    tarBytes = bytes; // assume already-uncompressed TAR
  }
  return untar(tarBytes);
}

function tarReadString(b: Uint8Array, off: number, len: number): string {
  let end = off;
  const max = off + len;
  while (end < max && b[end] !== 0) end++;
  return new TextDecoder("utf-8").decode(b.subarray(off, end));
}

function tarReadOctal(b: Uint8Array, off: number, len: number): number {
  const s = tarReadString(b, off, len).trim();
  return s ? parseInt(s, 8) || 0 : 0;
}

// Minimal TAR parser supporting ustar prefix, GNU long names ('L') and pax
// extended headers ('x'/'g') for long/unicode paths.
function untar(b: Uint8Array): { [path: string]: Uint8Array } {
  const files: { [path: string]: Uint8Array } = {};
  let offset = 0;
  let longName: string | null = null;
  let paxPath: string | null = null;

  while (offset + 512 <= b.length) {
    // End of archive = a block of all zeros.
    let allZero = true;
    for (let i = 0; i < 512; i++) {
      if (b[offset + i] !== 0) { allZero = false; break; }
    }
    if (allZero) break;

    let name = tarReadString(b, offset, 100);
    const size = tarReadOctal(b, offset + 124, 12);
    const typeflag = String.fromCharCode(b[offset + 156]);
    const magic = tarReadString(b, offset + 257, 6);
    const prefix = tarReadString(b, offset + 345, 155);
    if (prefix && magic.startsWith("ustar")) name = prefix + "/" + name;

    const dataStart = offset + 512;

    if (typeflag === "L") {
      // GNU long-name entry: the name for the NEXT file is in this data block.
      longName = tarReadString(b, dataStart, size).replace(/\0+$/, "");
    } else if (typeflag === "x" || typeflag === "g") {
      // pax extended header — look for a "path=" record.
      const paxData = new TextDecoder("utf-8").decode(b.subarray(dataStart, dataStart + size));
      const m = paxData.match(/^\d+ path=(.+)$/m);
      if (m) paxPath = m[1];
    } else if (typeflag === "0" || typeflag === "\u0000" || typeflag === "7") {
      // Regular file.
      const fname = (paxPath || longName || name).replace(/\/+$/, "");
      if (fname) files[fname] = b.slice(dataStart, dataStart + size);
      longName = null;
      paxPath = null;
    } else {
      // Directory ('5'), symlink, etc. — reset any pending long/pax name.
      if (typeflag !== "L" && typeflag !== "x" && typeflag !== "g") {
        longName = null;
        paxPath = null;
      }
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return files;
}

type FileKind = "text" | "image" | "binary";

function detectKind(path: string): FileKind {
  const ext = getExt(path);
  if (IMAGE_EXTS.has(ext)) return "image";
  if (ext === "svg") return "image"; // render SVG as an image
  if (BINARY_EXTS.has(ext)) return "binary";
  return "text";
}

// Monaco language id from extension.
function langFromExt(path: string): string {
  const ext = getExt(path);
  switch (ext) {
    case "ts": case "cts": case "mts": return "typescript";
    case "tsx": return "typescript";
    case "js": case "jsx": case "mjs": case "cjs": return "javascript";
    case "json": return "json";
    case "css": return "css";
    case "scss": return "scss";
    case "less": return "less";
    case "html": case "htm": return "html";
    case "md": case "mdx": return "markdown";
    case "py": return "python";
    case "sh": case "bash": return "shell";
    case "yml": case "yaml": return "yaml";
    case "sql": return "sql";
    case "xml": case "svg": return "xml";
    case "toml": return "ini";
    case "env": return "ini";
    default: return "plaintext";
  }
}

// Decode bytes as text; return null if it looks binary (has NUL bytes or a high
// ratio of replacement characters).
function tryDecodeText(bytes: Uint8Array): string | null {
  // Quick binary sniff: NUL byte in the first chunk → binary.
  const sniffLen = Math.min(bytes.length, 8000);
  for (let i = 0; i < sniffLen; i++) {
    if (bytes[i] === 0) return null;
  }
  const text = new TextDecoder("utf-8").decode(bytes);
  // Count replacement chars (U+FFFD) — a high ratio means it was not UTF-8 text.
  let bad = 0;
  const checkLen = Math.min(text.length, 4000);
  for (let i = 0; i < checkLen; i++) {
    if (text.charCodeAt(i) === 0xfffd) bad++;
  }
  if (checkLen > 0 && bad / checkLen > 0.1) return null;
  return text;
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── File tree types ──────────────────────────────────────────────────────────
interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] };
  for (const p of paths) {
    const segments = p.split("/").filter(Boolean);
    let node = root;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const isLast = i === segments.length - 1;
      const curPath = segments.slice(0, i + 1).join("/");
      let child = node.children.find((c) => c.name === seg && c.isDir === !isLast);
      if (!child) {
        // If a file and a dir share a name at the same level, keep them distinct.
        child = node.children.find((c) => c.name === seg);
        if (!child || child.isDir !== !isLast) {
          child = { name: seg, path: curPath, isDir: !isLast, children: [] };
          node.children.push(child);
        }
      }
      node = child;
    }
  }
  sortTree(root);
  return root;
}

function sortTree(node: TreeNode) {
  node.children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1; // folders first
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
  for (const c of node.children) if (c.isDir) sortTree(c);
}

// Pick a lucide icon for a file by extension.
function iconForFile(path: string) {
  const ext = getExt(path);
  const kind = detectKind(path);
  if (kind === "image") return <ImageIcon className="w-3.5 h-3.5 text-pink-500 shrink-0" />;
  if (kind === "binary") return <FileType2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  switch (ext) {
    case "ts": case "tsx": case "js": case "jsx": case "mjs": case "cjs": case "cts": case "mts":
      return <FileCode2 className="w-3.5 h-3.5 text-sky-500 shrink-0" />;
    case "json":
      return <FileJson className="w-3.5 h-3.5 text-yellow-500 shrink-0" />;
    case "md": case "mdx": case "txt":
      return <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />;
    case "css": case "scss": case "less":
      return <FileCode2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />;
    case "html": case "htm": case "xml":
      return <FileCode2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />;
    default:
      return <FileIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />;
  }
}

// ── Tree row (recursive) ─────────────────────────────────────────────────────
function TreeRow({
  node,
  depth,
  expanded,
  toggle,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  const isOpen = expanded.has(node.path);
  const pad = 8 + depth * 12;

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => toggle(node.path)}
          style={{ paddingLeft: pad }}
          className="w-full flex items-center gap-1.5 pr-2 py-1 rounded-md text-[13px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors group"
        >
          <ChevronRight
            className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
          />
          {isOpen ? (
            <FolderOpen className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {isOpen && (
          <div>
            {node.children.map((child) => (
              <TreeRow
                key={child.path + (child.isDir ? "/" : "")}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                toggle={toggle}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isSelected = selected === node.path;
  return (
    <button
      onClick={() => onSelect(node.path)}
      style={{ paddingLeft: pad + 18 }}
      className={`w-full flex items-center gap-1.5 pr-2 py-1 rounded-md text-[13px] transition-colors ${
        isSelected
          ? "bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 font-medium"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/70"
      }`}
    >
      {iconForFile(node.path)}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function CodePanel({ projectId, darkMode, onAskAiEdit }: CodePanelProps) {

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [textFiles, setTextFiles] = useState<{ [path: string]: string }>({});
  const [filesCount, setFilesCount] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bytesReady, setBytesReady] = useState(false); // whether raw bytes are in memory

  const objectUrlRef = useRef<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const cacheKey = `${CACHE_PREFIX}${projectId}`;

  // Get (or lazily create) the in-memory byte map for this project.
  const getByteMap = useCallback((): Map<string, Uint8Array> => {
    let m = byteCacheByProject.get(projectId);
    if (!m) {
      m = new Map();
      byteCacheByProject.set(projectId, m);
    }
    return m;
  }, [projectId]);

  // Apply an unzipped byte map into state + memory + localStorage cache.
  const applyUnzipped = useCallback(
    (files: { [path: string]: Uint8Array }, sha: string, count: number) => {
      const byteMap = getByteMap();
      byteMap.clear();

      const filteredPaths: string[] = [];
      const decodedText: { [path: string]: string } = {};

      for (const rawPath of Object.keys(files)) {
        // fflate uses forward slashes; directories end with "/" (empty entries).
        const path = rawPath.replace(/\\/g, "/");
        if (path.endsWith("/")) continue; // skip directory entries
        if (isIgnoredPath(path)) continue;
        const bytes = files[rawPath];
        byteMap.set(path, bytes);
        filteredPaths.push(path);

        // Only try to decode reasonably-sized non-binary files as text.
        const kind = detectKind(path);
        if (kind === "text") {
          const decoded = tryDecodeText(bytes);
          if (decoded !== null) decodedText[path] = decoded;
        }
      }

      setPaths(filteredPaths);
      setTextFiles(decodedText);
      setFilesCount(count || filteredPaths.length);
      setBytesReady(true);

      // Persist to localStorage (best-effort — may fail on quota).
      const payload: CachePayload = {
        ts: Date.now(),
        sha,
        textFiles: decodedText,
        paths: filteredPaths,
      };
      try {
        localStorage.setItem(cacheKey, JSON.stringify(payload));
      } catch {
        /* ignore */
      }

      return filteredPaths;
    },
    [cacheKey, getByteMap]
  );

  // Expand a couple of top-level folders for a nicer first view.
  const autoExpand = useCallback((allPaths: string[]) => {
    const topDirs = new Set<string>();
    for (const p of allPaths) {
      const seg = p.split("/");
      if (seg.length > 1) topDirs.add(seg[0]);
    }
    // Expand "src" and "public" by default if present.
    const toExpand = new Set<string>();
    if (topDirs.has("src")) toExpand.add("src");
    if (topDirs.has("public")) toExpand.add("public");
    if (toExpand.size === 0 && topDirs.size > 0) {
      toExpand.add([...topDirs][0]);
    }
    setExpanded(toExpand);
  }, []);

  // Fetch + unzip the code archive from the server. bypassCache re-downloads.
  const fetchCode = useCallback(
    async (bypassCache: boolean) => {
      setLoading(true);
      setError(null);

      // Try the 3-minute localStorage cache first.
      if (!bypassCache) {
        try {
          const raw = localStorage.getItem(cacheKey);
          if (raw) {
            const payload = JSON.parse(raw) as CachePayload;
            if (payload && typeof payload.ts === "number" && Date.now() - payload.ts < CACHE_TTL_MS) {
              setPaths(payload.paths || []);
              setTextFiles(payload.textFiles || {});
              setFilesCount((payload.paths || []).length);
              // Bytes may or may not be in memory (survives tab switch, not reload).
              setBytesReady((byteCacheByProject.get(projectId)?.size || 0) > 0);
              autoExpand(payload.paths || []);
              setLoading(false);
              return;
            }
          }
        } catch {
          /* ignore */
        }
      }

      try {
        // On an explicit refresh, drop any shared in-flight promise so we truly re-download.
        if (bypassCache) inflightByProject.delete(projectId);
        // Shared loader dedups the concurrent desktop+mobile mounts into one download.
        const { files, sha, count } = await loadArchiveOnce(projectId);
        const filtered = applyUnzipped(files, sha, count);
        autoExpand(filtered);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    },
    [projectId, cacheKey, applyUnzipped, autoExpand]
  );

  // Initial load — only once per mount; reuses cache/in-memory within 3 min.
  useEffect(() => {
    fetchCode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Clean up any object URL on unmount.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  // ── File search (by name AND by contents) ──────────────────────────────────
  const query = search.trim().toLowerCase();
  const filteredPaths = useMemo(() => {
    if (!query) return paths;
    return paths.filter((p) => {
      if (p.toLowerCase().includes(query)) return true; // name/path match
      const text = textFiles[p];
      return text ? text.toLowerCase().includes(query) : false; // content match
    });
  }, [paths, textFiles, query]);

  const tree = useMemo(() => buildTree(filteredPaths), [filteredPaths]);

  // While searching, force every ancestor folder of a match open so results show.
  const searchExpanded = useMemo(() => {
    if (!query) return null;
    const s = new Set<string>();
    for (const p of filteredPaths) {
      const seg = p.split("/");
      for (let i = 1; i < seg.length; i++) s.add(seg.slice(0, i).join("/"));
    }
    return s;
  }, [query, filteredPaths]);

  const effectiveExpanded = searchExpanded || expanded;

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Background re-fetch of raw bytes when serving from a text-only cache and the
  // user opens an image/binary whose bytes aren't in memory.
  const ensureBytes = useCallback(async () => {
    const byteMap = byteCacheByProject.get(projectId);
    if (byteMap && byteMap.size > 0) return byteMap;
    try {
      const res = await fetch(`/api/vcaas/source-code/${projectId}`, { cache: "no-store" });
      if (!res.ok) {
        return null;
      }
      const buffer = await res.arrayBuffer();
      const files = decompressArchive(buffer);
      const sha = res.headers.get("x-commit-sha") || "";
      const count = parseInt(res.headers.get("x-files-count") || "0", 10) || 0;
      applyUnzipped(files, sha, count);
      return byteCacheByProject.get(projectId) || null;
    } catch {
      return null;
    }
  }, [projectId, applyUnzipped]);

  // When the selected file changes, prepare an image object URL if needed.
  useEffect(() => {
    // Revoke any previous object URL.
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setImageUrl(null);

    if (!selected) return;
    const kind = detectKind(selected);
    if (kind !== "image") return;

    let cancelled = false;
    (async () => {
      let byteMap = byteCacheByProject.get(projectId);
      if (!byteMap || !byteMap.has(selected)) {
        byteMap = await ensureBytes();
      }
      if (cancelled || !byteMap) return;
      const bytes = byteMap.get(selected);
      if (!bytes) return;
      const ext = getExt(selected);
      const mime =
        ext === "svg" ? "image/svg+xml" :
        ext === "png" ? "image/png" :
        ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
        ext === "gif" ? "image/gif" :
        ext === "webp" ? "image/webp" :
        ext === "avif" ? "image/avif" :
        ext === "bmp" ? "image/bmp" :
        ext === "ico" ? "image/x-icon" : "application/octet-stream";
      // Copy into a fresh ArrayBuffer to satisfy the Blob typing.
      const copy = new Uint8Array(bytes);
      const url = URL.createObjectURL(new Blob([copy], { type: mime }));
      objectUrlRef.current = url;
      if (!cancelled) setImageUrl(url);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, projectId, bytesReady]);

  // Download a binary/other file by creating a temporary anchor.
  const handleDownload = useCallback(
    async (path: string) => {
      let byteMap = byteCacheByProject.get(projectId);
      if (!byteMap || !byteMap.has(path)) {
        byteMap = await ensureBytes();
      }
      if (!byteMap) return;
      const bytes = byteMap.get(path);
      if (!bytes) return;
      const copy = new Uint8Array(bytes);
      const url = URL.createObjectURL(new Blob([copy]));
      const a = document.createElement("a");
      a.href = url;
      a.download = path.split("/").pop() || "file";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    [projectId, ensureBytes]
  );

  // ── Render states ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        <p className="text-sm text-gray-400">{"Loading source code..."}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{"Failed to load source code"}</p>
          <p className="text-xs text-gray-400 max-w-sm break-words">{String(error)}</p>
        </div>
        <button
          onClick={() => fetchCode(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {"Retry"}
        </button>
      </div>
    );
  }

  const selectedKind = selected ? detectKind(selected) : null;
  const selectedBytes = selected ? byteCacheByProject.get(projectId)?.get(selected) : undefined;
  const selectedSize = selectedBytes ? selectedBytes.length : (selected && textFiles[selected] ? new Blob([textFiles[selected]]).size : 0);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 shrink-0">
        <FileCode2 className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{"Code Explorer"}</span>
        <span className="text-[11px] text-gray-400">· {filesCount} {"files"}</span>
        <div className="ml-auto flex items-center gap-2">
          {/* Ask-AI-to-edit — only meaningful once a file is open */}
          {selected && onAskAiEdit && (
            <button
              onClick={() => onAskAiEdit(selected)}
              className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors shadow-sm"
              title={"Ask AI to edit this file"}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{"Ask AI to edit this file"}</span>
            </button>
          )}
          <button
            onClick={() => fetchCode(true)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title={"Refresh"}
          >
            <RefreshCw className="w-3.5 h-3.5" /> {"Refresh"}
          </button>
        </div>
      </div>

      {/* Body: tree + viewer */}
      <div className="flex-1 flex min-h-0">
        {/* Tree sidebar */}
        <div className="w-64 shrink-0 border-r border-gray-100 dark:border-gray-800 flex flex-col bg-gray-50/40 dark:bg-gray-900/40">
          {/* Search by file name or content */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={"Search by file name or content..."}
                className="w-full h-8 pl-8 pr-7 rounded-lg text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-violet-200 dark:focus:ring-violet-900/40 transition-shadow"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-1.5 px-1.5">
            {tree.children.length === 0 ? (
              <p className="text-xs text-gray-400 p-3">{query ? "No files match your search" : "Failed to load source code"}</p>
            ) : (
              tree.children.map((child) => (
                <TreeRow
                  key={child.path + (child.isDir ? "/" : "")}
                  node={child}
                  depth={0}
                  expanded={effectiveExpanded}
                  toggle={toggle}
                  selected={selected}
                  onSelect={setSelected}
                />
              ))
            )}
          </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <FileCode2 className="w-6 h-6 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-sm text-gray-400">{"Select a file to view its contents"}</p>
            </div>
          ) : (
            <>
              {/* Breadcrumb */}
              <div className="px-3 py-1.5 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2 shrink-0">
                <code className="text-xs font-mono text-gray-600 dark:text-gray-300 truncate">{selected}</code>
                <span className="text-[10px] text-gray-400 shrink-0">{humanSize(selectedSize)}</span>
              </div>

              {/* Content by kind */}
              <div className="flex-1 min-h-0 relative">
                {selectedKind === "text" ? (
                  textFiles[selected] !== undefined ? (
                    <MonacoEditor
                      key={selected}
                      height="100%"
                      language={langFromExt(selected)}
                      value={textFiles[selected]}
                      theme={darkMode ? "vs-dark" : "light"}
                      options={{
                        readOnly: true,
                        minimap: { enabled: true },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        automaticLayout: true,
                        renderLineHighlight: "all",
                      }}
                    />
                  ) : (
                    <PlaceholderBinary onDownload={() => handleDownload(selected)} />
                  )
                ) : selectedKind === "image" ? (
                  <div className="absolute inset-0 flex items-center justify-center overflow-auto checkerboard p-6">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt={selected} className="max-w-full max-h-full object-contain rounded shadow-lg bg-white/10" />
                    ) : (
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                    )}
                  </div>
                ) : (
                  <PlaceholderBinary onDownload={() => handleDownload(selected)} />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Checkerboard style for image background */}
      <style jsx>{`
        .checkerboard {
          background-image:
            linear-gradient(45deg, ${darkMode ? "#2a2a2a" : "#e5e5e5"} 25%, transparent 25%),
            linear-gradient(-45deg, ${darkMode ? "#2a2a2a" : "#e5e5e5"} 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, ${darkMode ? "#2a2a2a" : "#e5e5e5"} 75%),
            linear-gradient(-45deg, transparent 75%, ${darkMode ? "#2a2a2a" : "#e5e5e5"} 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
          background-color: ${darkMode ? "#1e1e1e" : "#fafafa"};
        }
      `}</style>
    </div>
  );
}

// Placeholder for binary / non-previewable files.
function PlaceholderBinary({ onDownload }: { onDownload: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
        <FileWarning className="w-7 h-7 text-gray-300 dark:text-gray-600" />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">{"Preview not available for this file type"}</p>
      <button
        onClick={onDownload}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
      >
        <Download className="w-3.5 h-3.5" /> {"Download"}
      </button>
    </div>
  );
}
