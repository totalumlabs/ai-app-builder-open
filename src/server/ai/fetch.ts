import "server-only";

const RETRY_DELAYS = [400, 1200, 3000];
const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * Fetch with timeout + bounded retry. Retries on 429/5xx and network errors;
 * never retries 4xx (auth/validation). The aiError helper is imported lazily
 * to avoid a cycle with registry.ts.
 */
export async function aiFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init;
  let res: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS[attempt - 1]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      res = await fetch(url, { ...fetchInit, signal: controller.signal });
      if (res.status === 429 || res.status >= 500) {
        lastError = null;
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      res = null;
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastError) {
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    throw aiError("network", `Request failed after ${RETRY_DELAYS.length + 1} attempts: ${msg}`);
  }
  if (res) {
    return res; // exhausted retries on 429/5xx — caller reads the status
  }
  throw new Error("unreachable");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function aiError(kind: string, message: string): Error {
  const err = new Error(message);
  (err as { kind?: string }).kind = kind;
  return err;
}
