import { NextRequest, NextResponse } from "next/server";

// Git-diff text proxy. The `gitDiffUrl` returned by the VCaaS conversation API
// points at an external (signed) storage host, so the browser can't fetch it
// directly — CORS blocks it. We download it server-side and hand back the raw
// unified-diff text, mirroring the source-code proxy.

// The URL arrives from the client, so it must be validated before we fetch it:
// an unrestricted fetch(url) here would be an SSRF hole (internal metadata
// endpoints, localhost, private ranges...). Only hosts VCaaS actually serves
// diffs from are allowed.
const ALLOWED_HOSTS = [
  "totalum.app",
  "totalum-project.com",
  "storage.googleapis.com",
];

function isAllowedDiffUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
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

  try {
    const res = await fetch(target, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Failed to download diff (HTTP ${res.status})` },
        { status: 502 }
      );
    }

    const diff = await res.text();
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
