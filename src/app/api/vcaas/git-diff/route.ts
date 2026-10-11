import { NextRequest, NextResponse } from "next/server";
import { publicUrlRejectionReason } from "@/lib/safe-url";
import { TOTALUM_API_ORIGIN } from "@/lib/vcaas-server";

// Git-diff text proxy. The `gitDiffUrl` returned by the VCaaS conversation API
// points at an external (signed) storage host, so the browser can't fetch it
// directly — CORS blocks it. We download it server-side and hand back the raw
// unified-diff text, mirroring the source-code proxy.

// The URL arrives from the client, so it must be validated before we fetch it:
// an unrestricted fetch(url) here would be an SSRF hole (internal metadata
// endpoints, localhost, private ranges...). Only hosts VCaaS actually serves
// diffs from are allowed.
/**
 * ⚠️ A diff is text; nothing legitimate is anywhere near this. The cap stops a URL on an
 * allowed host from making the server buffer an arbitrarily large body into memory.
 */
const MAX_DIFF_BYTES = 10 * 1024 * 1024;

const ALLOWED_HOSTS = [
  "totalum.app",
  "totalum-project.com",
  "webapp-project.com", 
  "storage.googleapis.com",
];

function isAllowedDiffUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  // The configured Totalum API host serves diffs too (another environment's host, when `TOTALUM_API_URL` is set).
  if (url.origin === TOTALUM_API_ORIGIN) return true;
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");

  if (!target) {
    return NextResponse.json(
      { ok: false, error: "Missing `url` query parameter" },
      { status: 400 }
    );
  }

  // Older conversation messages store `gitDiffUrl` as a bare storage object path
  // rather than an absolute URL. Those objects live in a private bucket and are
  // only reachable via a signed URL, so there is nothing we can fetch for them.
  // Say so plainly instead of reporting a misleading "host not allowed".
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error:
          "This diff was saved in an older format and is no longer available.",
      },
      { status: 410 }
    );
  }

  if (!isAllowedDiffUrl(parsed)) {
    return NextResponse.json(
      { ok: false, error: "This diff URL is not from an allowed host" },
      { status: 400 }
    );
  }

  /**
   * ⚠️⚠️ THE HOST ALLOWLIST ALONE WAS NOT ENOUGH. `*.totalum-project.com` is where every
   * customer app is published — it serves whatever its owner wrote, including a redirect.
   * `fetch` followed redirects, so an allowed host could bounce this server to
   * `http://169.254.169.254/` and the allowlist, which only ever saw the first hop, never
   * noticed. Redirects are now refused outright (signed storage URLs never redirect), and
   * the resolving guard also refuses an allowed-looking name that points somewhere private.
   */
  const rejection = await publicUrlRejectionReason(target);
  if (rejection) {
    return NextResponse.json({ ok: false, error: rejection }, { status: 400 });
  }

  try {
    const res = await fetch(target, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Failed to download diff (HTTP ${res.status})` },
        { status: 502 }
      );
    }

    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_DIFF_BYTES) {
      return NextResponse.json({ ok: false, error: "That diff is too large to show" }, { status: 413 });
    }
    const diff = await res.text();
    if (diff.length > MAX_DIFF_BYTES) {
      return NextResponse.json({ ok: false, error: "That diff is too large to show" }, { status: 413 });
    }
    return NextResponse.json({ ok: true, data: { diff } }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to fetch diff",
      },
      { status: 500 }
    );
  }
}
