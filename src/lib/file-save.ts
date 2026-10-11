/**
 * repairlive (2026-10-02): a file save the engine accepted but has not committed yet answers `202 {saved: false}` —
 * its sandbox is still being prepared (measured: up to 5 minutes). It is confirmed by reading the file back until it
 * holds what was sent; `false` when it never does within the wait (the save failed or was replaced).
 */
export async function confirmSaved(
  read: () => Promise<string | null>,
  expected: string,
  {
    tries = 40,
    everyMs = 15_000,
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  } = {},
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    await sleep(everyMs);
    if ((await read().catch(() => null)) === expected) return true;
  }
  return false;
}

/** The hex SHA-256 of a file's text: the base a save names (`baseSha256`), so a stale copy is refused (SP6). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * SP6: the project's files changed underneath the editor (a version restore, a GitHub pull, a run). Every cached copy
 * without an unsaved edit is dropped (the next open reads the file again); one with an edit is kept, marked `stale`,
 * so the editor can say so — and the server refuses its save (`409 FILE_CHANGED`) until it is reloaded.
 */
export function invalidateFiles<B extends { saved: string; draft: string; kind: string; stale?: boolean }>(
  cache: Map<string, B>,
  projectId: string,
): void {
  for (const [key, entry] of [...cache]) {
    if (!key.startsWith(`${projectId}::`)) continue;
    if (entry.kind === "text" && entry.draft !== entry.saved) cache.set(key, { ...entry, stale: true });
    else cache.delete(key);
  }
}

/** SP6/SP16: fired on `window` (detail: the project id) when a restore, a pull or a run changed the project's files. */
export const FILES_CHANGED_EVENT = "totalum:code-files-changed";
