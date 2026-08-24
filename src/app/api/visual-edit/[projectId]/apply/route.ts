import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
    authFailed,
    enforceProjectScope,
    isRoutableProjectSlug,
    resolveVcaasContext,
} from "../../../vcaas/_shared";
import { vcaasRequest } from "@/lib/vcaas-server";
import { applyEdits, verifyEdits, type VisualChange } from "@/lib/visual-edit";
import { resolveChangesDeep } from "@/lib/visual-edit-resolve";
import { installSourceTags } from "@/lib/visual-edit-upgrade";
import { urlRejectionReason } from "@/lib/safe-url";

export const dynamic = "force-dynamic";

/**
 * ═══ APPLY VISUAL CHANGES (Feature F12) ═════════════════════════════════════
 *
 * `POST { changes: VisualChange[] }` → resolve each change to a concrete file edit,
 * write the touched files, start a rebuild, and report exactly what could not be
 * placed.
 *
 * It is built entirely on **Feature 11's** endpoints — `files/tree`,
 * `files/content` (GET and PUT) and `rebuild` — which is why F11 came first.
 *
 * ⚠️ THE SESSION IS THE ONLY IDENTITY. `resolveVcaasContext()` mints the caller's
 * own VCaaS key server-side; the body carries changes, never a user, a project owner
 * or a plan. A project the session does not own 404s upstream.
 *
 * ⚠️ IT READS ONLY THE FILES IT MIGHT NEED. Fetching the whole project would be
 * dozens of round trips; instead it reads the source files (`.tsx`/`.jsx`) from the
 * tree, capped, and searches those. F11's server-side snapshot cache means those
 * reads are one upstream archive fetch, not one per file.
 *
 * ⚠️ NOTHING IS WRITTEN UNTIL EVERY CHANGE HAS BEEN RESOLVED. A half-applied batch
 * is the worst outcome: the preview would show some edits, the file history would
 * show others, and the user could not tell which. Resolve first, then write.
 */

/**
 * Source files worth searching.
 *
 * ⭐ G5 — `.ts` AND `.js` ARE IN THE LIST NOW, and the audit's "not fixed, and why"
 * entry is the reason. Two real failures needed them: `src={assets.hero}`, whose URL is
 * a constant in `src/assets/files.ts`, and every `.map()`-rendered feature list, whose
 * copy lives in `src/data/*.ts` rather than in any markup.
 *
 * ⚠️ THE OLD OBJECTION WAS RIGHT ABOUT THE OLD ENGINE. Widening the list for a REGEX
 * matcher would have meant searching bundler config, server routes and constants for
 * quoted strings — "a much larger blast radius for a wrong match". The new engine does
 * not search those files for markup: it parses them for exported constants and reaches
 * them only through the import graph from the page the user was on. A `.ts` file nobody
 * imports contributes nothing.
 */
const SOURCE_EXTENSIONS = [".tsx", ".jsx", ".ts", ".js"];
/** Enough for any generated project; beyond this the search is refused, not silent. */
const MAX_FILES = 200;
/** What one apply costs, per the brief. Charged once, never on failure. */
const VISUAL_EDIT_CREDIT_COST = 0.3;

/**
 * ⭐⭐ G4 — DOES THE FILE ENDPOINT STORE WHAT WE SEND IT?
 *
 * Process-wide, because the answer is a property of the backend deployment rather than
 * of any project or user, and because finding it out costs a credit (see the long note
 * at the call site). `"unknown"` until the first apply that would write.
 */
let writeFidelity: "unknown" | "faithful" | "unfaithful" = "unknown";

/**
 * ⭐⭐⭐ THE BODY THAT SURVIVES THE BACKEND'S HTML SANITIZER.
 *
 * ⚠️⚠️ SOURCE CODE MUST NEVER BE SENT AS A UTF-8 STRING, AND THIS IS THE FIX FOR THE
 * `WRITE_NOT_FAITHFUL` REFUSAL THE CANARY BELOW WAS BUILT TO CATCH.
 *
 * `totalum-backend/src/app.ts` mounts a GLOBAL `sanitizeMiddleware` — it runs
 * `sanitize-html` over every string in every request body before any route sees it. It
 * exists for user-generated HTML, but the VCaaS file-write route sits behind it too, so
 * React source posted to it is parsed as a web page and stripped to a tag allowlist:
 *
 *     PUT <div id="probe" className="flex gap-2">  →  stored <div>
 *
 * `className` is not in that allowlist (only `class` and `style` are), so it vanishes;
 * `<script>` is deleted whole. G4 measured this and — correctly — chose to refuse rather
 * than corrupt anyone's file.
 *
 * ⚠️ THE ANSWER IS NOT TO PATCH THE MIDDLEWARE. It guards every other route in a
 * multi-tenant backend the legacy platform still runs on, and carving a hole in it to
 * make one feature work is the kind of change that is discovered later by someone
 * else's incident. `PUT /files/content` ALREADY accepts `encoding: "base64"` — the
 * account-backend passes it upstream as `codeIsBase64` and the sandbox decodes it — and
 * a base64 payload has no `<`, `>` or `&` in it, so the sanitizer reads it as an
 * ordinary word and hands it through untouched. We use the door that is already there.
 *
 * ⚠️ `bytesWritten` STILL LINES UP. Account-backend measures the DECODED length
 * (`Buffer.from(content, "base64").length`), which is exactly the utf-8 byte length of
 * the source we encoded — so the free per-write check at the call site keeps working
 * unchanged.
 */
function fileWriteBody(path: string, content: string): string {
    return JSON.stringify({
        path,
        content: Buffer.from(content, "utf8").toString("base64"),
        encoding: "base64",
    });
}

/**
 * Write a throwaway file containing the constructs we depend on, read it back, and
 * require it byte-for-byte.
 *
 * ⚠️ THE CONTENT IS CHOSEN TO TRIP THE KNOWN FAILURE, NOT TO LOOK LIKE SOURCE. A plain
 * sentence survives an HTML sanitizer untouched and would report a healthy pipe; a JSX
 * attribute and an id are exactly what gets stripped. The timestamp stops a cached read
 * from answering for a write that never landed.
 *
 * ⚠️ IT GOES THROUGH `fileWriteBody` LIKE EVERY OTHER WRITE, AND MUST. The probe's job
 * is to prove THE PATH WE ACTUALLY USE is faithful; encoding it differently from the
 * real writes would make it answer a question nobody asked.
 */
async function probeWriteFidelity(base: string, ctx: Parameters<typeof vcaasRequest>[2]): Promise<boolean> {
    const path = ".totalum/visual-edit-write-check.txt";
    const content = `<div id="c" className="a b">x</div> ${Date.now()}`;

    try {
        const write = await vcaasRequest(
            `${base}/files/content`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: fileWriteBody(path, content),
            },
            ctx
        );
        if (!write.ok) return false;

        const readBack = await vcaasRequest(`${base}/files/content?path=${encodeURIComponent(path)}`, {}, ctx);
        if (!readBack.ok) return false;

        const payload = (await readBack.json().catch(() => null)) as { data?: { content?: string } } | null;
        return payload?.data?.content === content;
    } catch {
        return false;
    }
}

/**
 * ⭐⭐⭐ G6 — AN UPLOADED IMAGE IS COPIED INTO THE PROJECT, NOT LINKED FROM OUR STORAGE.
 *
 * ⚠️⚠️ THE URL THE DROPZONE PRODUCES IS A SIGNED `storage.googleapis.com` LINK, and
 * writing one into a customer's source file is wrong in two separate ways:
 *
 *   · **It breaks the page outright when the element is a `next/image`.** The template
 *     ships `images.remotePatterns: [{ hostname: "placeholders.io" }]` and nothing else,
 *     so Next throws `Invalid src prop … hostname is not configured` — a runtime error
 *     that takes the whole route down. The user replaced a picture and lost the page.
 *   · **It makes their app depend on our storage forever.** The signed url is a Totalum
 *     artefact; their repo, their GitHub export and their Cloudflare deploy would all
 *     carry it.
 *
 * So the bytes are fetched once and written to `public/uploads/`, and the source gets
 * `/uploads/<name>` — exactly what a developer would have typed. It works for `<img>`
 * and `<Image>` alike, needs no `next.config.ts` surgery, and survives export.
 *
 * ⚠️ ONLY FOR URLS **WE** MINTED (`change.uploaded`). A url the user typed or pasted is
 * their explicit decision about where their image lives; silently downloading it into
 * their repo would be a surprise, and would also quietly re-host someone else's asset.
 *
 * ⚠️ A FAILURE HERE IS NOT FATAL. If the download or the write fails the change keeps
 * its original url and is resolved exactly as before — a worse outcome than internalising
 * it, and a much better one than refusing the user's whole batch over an asset copy.
 */
const UPLOAD_DIR = "public/uploads";
/** Matches the dropzone's own ceiling; a bigger file never got a url in the first place. */
const MAX_ASSET_BYTES = 12 * 1024 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "video/webm": "webm",
};

/**
 * A stable, collision-free, URL-safe name.
 *
 * ⚠️ DERIVED FROM THE BYTES, NOT FROM A TIMESTAMP. Applying the same batch twice — a
 * retry, a double click that got through — must not leave two copies of one picture in
 * the user's repo, and a content hash makes the second write idempotent.
 */
function assetName(bytes: Buffer, contentType: string, sourceUrl: string): string {
    let hash = 0;
    for (let i = 0; i < bytes.length; i += 997) hash = (hash * 31 + bytes[i]) | 0;
    const fingerprint = (hash >>> 0).toString(36) + "-" + bytes.length.toString(36);

    const fromType = EXTENSION_BY_TYPE[contentType.split(";")[0].trim().toLowerCase()];
    const fromUrl = /\.([a-z0-9]{2,5})(?:$|\?)/i.exec(sourceUrl.split("?")[0])?.[1]?.toLowerCase();
    const extension = fromType || (fromUrl && /^[a-z0-9]+$/.test(fromUrl) ? fromUrl : "png");

    return `${fingerprint}.${extension}`;
}

interface TreeEntry {
    path: string;
    type: "file" | "folder";
    size?: number;
}

function isUnsafe(
    check: { safe: true } | { safe: false; reason: string }
): check is { safe: false; reason: string } {
    return check.safe === false;
}

function fail(code: string, status: number, message?: string) {
    return NextResponse.json({ ok: false, code, error: message ?? code }, { status });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const auth = await resolveVcaasContext();
    if (authFailed(auth)) return auth.response;

    const { projectId } = await params;
    if (!isRoutableProjectSlug(projectId)) return fail("PROJECT_NOT_FOUND", 404);

    /**
     * ⚠️⚠️ THE MANAGER-SCOPE GATE. THIS ROUTE WRITES SOURCE FILES, and it did not
     * have one — finding #7. `/api/vcaas/*` checks scope on every call, but this
     * endpoint reaches the same project through its own `vcaasRequest` calls below,
     * so it bypassed that entirely: a manager scoped to one project could rewrite
     * the code of every other project on the account. Upstream cannot catch it —
     * every member presents the OWNER's key, so as far as VCaaS is concerned this is
     * the owner. See `enforceProjectScope` in `../../../vcaas/_shared`.
     *
     * ⚠️ IT IS A WRITE, so it asks for `project.edit`, not `project.view` — hence the
     * explicit `"POST"`. And it runs BEFORE the plan read and before the file tree is
     * fetched, so a refusal costs nothing upstream.
     */
    const outOfScope = enforceProjectScope(auth.team, "POST", ["projects", projectId]);
    if (outOfScope) return outOfScope;

    let body: { changes?: VisualChange[] };
    try {
        body = (await request.json()) as { changes?: VisualChange[] };
    } catch {
        return fail("VALIDATION_ERROR", 400);
    }

    const changes = Array.isArray(body.changes) ? body.changes.slice(0, 100) : [];
    if (changes.length === 0) return fail("NO_CHANGES", 400);

    /**
     * ⚠️ THE PLATFORM CHECKS A PAID PLAN HERE AND THIS APP DOES NOT — there are no plans
     * behind a single API key. Upstream still enforces whatever the key's account is
     * entitled to, so a project that may not be edited is refused by VCaaS with its own
     * error rather than by a guess made here.
     */

    const base = `/projects/${encodeURIComponent(projectId)}`;

    // ── 1. Which files could possibly contain these elements? ──────────────
    const treeResponse = await vcaasRequest(`${base}/files/tree?limit=5000`, {}, auth.ctx);
    const treePayload = (await treeResponse.json().catch(() => null)) as
        | { data?: { entries?: TreeEntry[] } }
        | null;

    if (!treeResponse.ok || !treePayload?.data?.entries) {
        return fail("TREE_UNAVAILABLE", 502, "We couldn't read this project's files.");
    }

    const allSourcePaths = treePayload.data.entries
        .filter(entry => entry.type === "file" && SOURCE_EXTENSIONS.some(ext => entry.path.endsWith(ext)))
        .map(entry => entry.path);

    /**
     * ⭐ G3/P4 — RANK BEFORE CAPPING, AND SAY WHEN THE CAP BITES.
     *
     * G2 measured a real project with 52 source files of which **41 were
     * `src/components/ui/*`** — shadcn primitives that can never contain the user's
     * own text. Alphabetically those sort ahead of most real pages, so on a larger
     * project the cap would have thrown away exactly the files worth searching and
     * produced inexplicable `not-found`s. Pages first, then the user's components,
     * then the vendored UI kit last.
     */
    const rank = (path: string): number => {
        if (/(^|\/)app\/.*\/page\.[jt]sx$/.test(path) || /(^|\/)app\/page\.[jt]sx$/.test(path)) return 0;
        if (/(^|\/)app\//.test(path)) return 1;
        if (/(^|\/)components\/ui\//.test(path)) return 4;
        // G5 — the data and asset modules the markup renders FROM, ahead of the UI kit.
        if (/(^|\/)(data|content|constants|config|assets)\//.test(path)) return 2;
        if (/\.[jt]sx$/.test(path)) return 3;
        // Everything else `.ts`/`.js`: server routes, helpers. Read last, and only if
        // there is room — the import graph is what decides whether they matter.
        return 5;
    };
    const ranked = [...allSourcePaths].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    const sourcePaths = ranked.slice(0, MAX_FILES);
    /** Reported so a `not-found` can be explained rather than merely observed. */
    const filesTruncated = Math.max(0, allSourcePaths.length - sourcePaths.length);

    if (allSourcePaths.length === 0) {
        return fail("NO_SOURCE_FILES", 409, "This project has no editable source files.");
    }

    // ── 2. Read them ────────────────────────────────────────────────────────
    const files = new Map<string, string>();
    const readResults = await Promise.all(
        sourcePaths.map(async path => {
            const response = await vcaasRequest(
                `${base}/files/content?path=${encodeURIComponent(path)}`,
                {},
                auth.ctx
            );
            const payload = (await response.json().catch(() => null)) as
                | { data?: { content?: string; encoding?: string } }
                | null;
            if (!response.ok || payload?.data?.encoding !== "utf8") return null;
            return { path, content: payload.data.content ?? "" };
        })
    );
    for (const result of readResults) if (result) files.set(result.path, result.content);

    if (files.size === 0) {
        return fail("READ_FAILED", 502, "We couldn't read this project's source files.");
    }

    /**
     * ── 2b. G6 — bring uploaded images into the project ────────────────────
     *
     * Before anything is resolved, so every planner downstream sees a root-relative
     * path and none of them has to know an upload happened. See `UPLOAD_DIR` above.
     */
    const assetsCopied: { from: string; to: string }[] = [];
    const assetFailures: { url: string; reason: string }[] = [];
    /** One download per distinct url, however many elements point at it. */
    const internalised = new Map<string, string>();

    for (const change of changes) {
        if (change.kind !== "src" || !change.uploaded) continue;
        if (!/^https?:\/\//i.test(change.after)) continue;
        if (internalised.has(change.after)) {
            change.after = internalised.get(change.after)!;
            continue;
        }

        const original = change.after;
        try {
            /**
             * ⚠️⚠️ `uploaded` COMES FROM THE BROWSER, SO THE URL IS UNTRUSTED — and this
             * fetch runs with OUR egress, inside a network the caller cannot reach.
             * Without this check a crafted body (`uploaded: true`, `after:
             * "http://169.254.169.254/latest/meta-data/"`) would make the server read a
             * metadata endpoint and write the answer into a file the caller can then read
             * back through `files/content`. The flag is a hint about intent; it is not
             * permission to fetch anything.
             *
             * Same guard the upload route has always used — see `@/lib/safe-url`.
             */
            const rejection = urlRejectionReason(original);
            if (rejection) throw new Error(rejection);

            const download = await fetch(original, {
                signal: AbortSignal.timeout(20_000),
                // ⚠️ A redirect is the obvious way around a host check, so it is refused
                // rather than followed. Our own storage never redirects.
                redirect: "error",
            });
            if (!download.ok) throw new Error(`HTTP ${download.status}`);

            /**
             * ⚠️ AND IT HAS TO BE AN IMAGE. The point of this copy is to put a picture in
             * `public/`; anything else is either a mistake or an attempt to write
             * arbitrary content into the customer's repo through the media field.
             */
            const contentType = download.headers.get("content-type") ?? "";
            if (!/^(image|video)\//i.test(contentType)) throw new Error(`not media (${contentType || "no type"})`);

            const bytes = Buffer.from(await download.arrayBuffer());
            if (bytes.length === 0) throw new Error("empty");
            if (bytes.length > MAX_ASSET_BYTES) throw new Error("too large");

            const name = assetName(bytes, contentType, original);
            const path = `${UPLOAD_DIR}/${name}`;

            const write = await vcaasRequest(
                `${base}/files/content`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    // ⚠️ Base64 for the same reason every other write uses it — the
                    // upstream HTML sanitizer. Binary would not have survived utf-8
                    // anyway; see `fileWriteBody`.
                    body: JSON.stringify({ path, content: bytes.toString("base64"), encoding: "base64" }),
                },
                auth.ctx
            );
            if (!write.ok) throw new Error(`write HTTP ${write.status}`);

            /** `public/uploads/x.png` is served at `/uploads/x.png`. */
            const publicPath = `/${path.slice("public/".length)}`;
            internalised.set(original, publicPath);
            assetsCopied.push({ from: original, to: publicPath });
            change.after = publicPath;
        } catch (error) {
            /**
             * ⚠️ THE CHANGE KEEPS ITS ORIGINAL URL AND CARRIES ON. An `<img>` will render
             * it perfectly well; only `next/image` minds, and refusing the user's other
             * eleven edits because one asset copy failed would be a far worse trade.
             */
            assetFailures.push({ url: original, reason: error instanceof Error ? error.message : "unknown" });
            console.error(`[visual-edit] could not internalise ${original}:`, error);
        }
    }

    /**
     * ── 3. Resolve every change BEFORE writing anything ────────────────────
     *
     * ⭐⭐ G5 — `resolveChangesDeep`, NOT `resolveChanges`. The tiered engine parses the
     * project and matches structurally; the original regex matcher is still in there as
     * its last tier, so nothing it used to place has stopped being placeable.
     */
    const { edits, unmapped, satisfied, engine } = resolveChangesDeep(files, changes);

    if (edits.length === 0) {
        /**
         * Nothing to write. Say so plainly rather than starting a rebuild that
         * would change nothing and cost the user a credit.
         *
         * ⚠️ `satisfied` IS REPORTED AS APPLIED. Those are changes the source
         * ALREADY makes — the user is looking at the result on screen. Reporting
         * them as failures (which is what happened before `resolveChanges` learned
         * to check) left them stuck in the unsaved-changes bar forever, with an
         * error, describing an edit that was already true.
         */
        return NextResponse.json(
            {
                ok: true,
                data: {
                    applied: satisfied.map(changeId => ({
                        changeId,
                        filePath: null,
                        confident: true,
                        score: 0,
                        alreadySatisfied: true,
                    })),
                    unmapped,
                    filesWritten: 0,
                    rebuildStarted: false,
                    engine,
                },
            },
            { status: 200 }
        );
    }

    /**
     * ⚠️⚠️ VERIFY AGAINST WHAT WAS APPLIED, NOT AGAINST WHAT WAS ASKED FOR.
     *
     * `applyEdits` drops an edit whose text another edit has already rewritten, and
     * that used to be silent — so the verification below was handed edits that were
     * never written, correctly reported one as "not at the index we wrote it to",
     * and the route threw away the entire file. A single conflicting change cost a
     * user their whole batch:
     *
     *     { code: "UNSAFE_WRITE", unsafeWrites: [{ path: "src/app/page.tsx",
     *       reason: "edit ve-…2fpeej is not at the index we wrote it to" }] }
     *
     * `applied` is the set that is genuinely in the new contents; `skipped` is
     * reported to the user as unapplied, alongside the resolution failures.
     */
    const { files: updated, applied, skipped } = applyEdits(files, edits);

    for (const edit of skipped) {
        unmapped.push({ changeId: edit.changeId, reason: "overlapping", occurrences: 1 });
    }

    /**
     * ⭐⭐ G3 — NOTHING IS SENT THAT WE CANNOT PROVE IS ONLY OUR EDIT.
     *
     * See `verifyEdits`. During G3's live run a real project's `page.tsx` came back
     * with every attribute stripped and the rebuilt app was published unstyled.
     * `applyEdits` is provably surgical (unit-tested: identical length and identical
     * `className` count for a one-token change), so the platform is almost certainly
     * not the cause — but "almost certainly" is the wrong standard when the failure
     * mode is destroying source code. A file that does not verify is dropped from the
     * batch and reported, never written.
     */
    const unsafeWrites: { path: string; reason: string }[] = [];
    for (const [path, content] of [...updated]) {
        const original = files.get(path);
        const check = original === undefined
            ? { safe: false as const, reason: "the original was not read" }
            : verifyEdits(original, content, applied.filter(edit => edit.filePath === path));
        // ⚠️ A user-defined narrowing helper, because this repo compiles with
        // `strictNullChecks: false`, under which TS does not narrow a union on a
        // boolean-literal discriminant (the same reason `bridgeFailed` exists).
        if (isUnsafe(check)) {
            unsafeWrites.push({ path, reason: check.reason });
            updated.delete(path);
            console.error(`[visual-edit] refusing to write ${path}: ${check.reason}`);
        }
    }

    if (updated.size === 0) {
        return NextResponse.json(
            {
                ok: false,
                code: "UNSAFE_WRITE",
                error: "We could not safely apply these changes, so nothing was written.",
                data: { unmapped, unsafeWrites },
            },
            { status: 409 }
        );
    }

    /**
     * ⭐⭐⭐ G4 — THE CANARY. WE VERIFY THE PIPE BEFORE WE PUT ANYTHING REAL IN IT.
     *
     * G3 recorded an unattributed incident: a real project's `page.tsx` came back with
     * every `className` and `id` stripped and the rebuilt app was published unstyled.
     * G4 reproduced it on a brand-new project and traced it, and it is not the matcher
     * and not `applyEdits` — it is the write endpoint itself. Measured, one round-trip:
     *
     *     PUT 179 chars  →  reported bytesWritten 103  →  stored 87 chars
     *     <div id="probe" className="flex gap-2">  →  <div>
     *
     * The cause is upstream, in `totalum-backend/src/app.ts`: a global
     * `sanitizeMiddleware` runs `sanitize-html` over EVERY string in EVERY request body
     * before any route sees it. It is meant for user-generated HTML, and the VCaaS
     * file-write route sits behind it, so React source posted to it is parsed as a web
     * page and stripped to a tag allowlist. The tell is exact: `class="a b"` survives
     * (that repo allowlists `class` and `style`) while `className="a b"` does not, and
     * `<script>…</script>` is deleted whole, contents and all.
     *
     * ⚠️ WE CANNOT REPAIR THE DAMAGE AFTER THE FACT, WHICH IS WHY THIS RUNS FIRST.
     * Restoring a mangled file would mean PUTting the original back through the same
     * middleware, which strips it again. There is no second chance, so the only safe
     * move is to prove the endpoint is faithful on a throwaway path and refuse the
     * whole batch if it is not. Nothing is written and nothing is charged.
     *
     * This is a probe, not a feature flag: it repairs itself the moment the upstream
     * middleware stops touching this route, with no change here.
     *
     * ⚠️ AND IT IS RUN AT MOST ONCE PER PROCESS, BECAUSE WRITES COST MONEY. Measured
     * against the real API: `GET files/tree` and `GET files/content` are free, and
     * `PUT files/content` costs 1 credit — so an unconditional probe would put a credit
     * on every apply, including the ones it then refuses. Write fidelity is a property
     * of the backend deployment, not of the project or the user, so one answer serves
     * every apply this process handles: an "unfaithful" verdict refuses for free
     * thereafter, and a "faithful" one never probes again.
     */
    if (writeFidelity === "unknown") {
        writeFidelity = (await probeWriteFidelity(base, auth.ctx)) ? "faithful" : "unfaithful";
    }

    if (writeFidelity === "unfaithful") {
        console.error(
            "[visual-edit] write-check failed — the file endpoint did not return what was sent. " +
                "Refusing to write. See totalum-backend/src/app.ts sanitizeMiddleware."
        );
        return NextResponse.json(
            {
                ok: false,
                code: "WRITE_NOT_FAITHFUL",
                error: "We couldn't write to your project safely, so nothing was changed.",
                data: { unmapped },
            },
            { status: 503 }
        );
    }

    // ── 4. Write the touched files ─────────────────────────────────────────
    const written: string[] = [];
    const writeFailures: { path: string; code: string }[] = [];

    for (const [path, content] of updated) {
        const response = await vcaasRequest(
            `${base}/files/content`,
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: fileWriteBody(path, content),
            },
            auth.ctx
        );

        if (response.ok) {
            /**
             * ⭐ G4 — A SECOND, FREE CHECK ON EVERY REAL WRITE. The endpoint reports
             * `bytesWritten`, so comparing it to what we sent catches an altered
             * payload without a single extra round trip — no read-back, no credit.
             *
             * ⚠️ IT CANNOT PREVENT THE FIRST DAMAGE, only stop the batch and every
             * later apply in this process. The canary above is what prevents; this is
             * what catches a regression that appears mid-process, or a mangling the
             * canary's own content happened not to trigger.
             */
            const payload = (await response.json().catch(() => null)) as
                | { data?: { bytesWritten?: number } }
                | null;
            const sent = Buffer.byteLength(content, "utf8");
            const stored = payload?.data?.bytesWritten;

            if (typeof stored === "number" && stored !== sent) {
                writeFidelity = "unfaithful";
                console.error(
                    `[visual-edit] ${path}: sent ${sent} bytes, endpoint stored ${stored}. ` +
                        "The write path is altering content — see totalum-backend/src/app.ts sanitizeMiddleware."
                );
                writeFailures.push({ path, code: "WRITE_NOT_FAITHFUL" });
            } else {
                written.push(path);
            }
        } else {
            const payload = (await response.json().catch(() => null)) as
                | { errors?: { errorCode?: string }; code?: string }
                | null;
            writeFailures.push({
                path,
                code: payload?.errors?.errorCode || payload?.code || `HTTP_${response.status}`,
            });
        }
    }

    if (written.length === 0) {
        return NextResponse.json(
            {
                ok: false,
                code: writeFailures[0]?.code || "WRITE_FAILED",
                error: "We couldn't write the changes to your project.",
                data: { unmapped, writeFailures },
            },
            { status: 502 }
        );
    }

    /**
     * ── 4b. G5 — TEACH THIS PROJECT TO ANSWER EXACTLY, ONCE ────────────────
     *
     * ⭐⭐ THE EDITOR JUST HAD TO INFER, AND IT DID NOT ALWAYS SUCCEED. Every project
     * generated from the current template stamps its elements with
     * `data-tlm-loc="file:line:col"`, which removes inference from the problem entirely.
     * Projects created before that carry their own `next.config.ts` and never will —
     * unless it is installed, which is two files and a rebuild.
     *
     * ⚠️ THE TRIGGER IS A FAILURE, NOT A VISIT. It runs only when this apply could not
     * place something on a project that has no tags: that is precisely the moment the
     * inference tier has been shown to be insufficient HERE, and it keeps the two extra
     * writes off every project the matcher already handles perfectly.
     *
     * ⚠️ IT COSTS THE USER NOTHING EXTRA IN TIME. The rebuild below was already going to
     * run for the edits themselves, and it is what picks the loader up.
     *
     * ⚠️ IT CANNOT FAIL THE APPLY. Every path returns a status; a config we do not
     * recognise is skipped and the editor carries on inferring exactly as it does today.
     */
    let sourceTagInstall: { status: string; configPath?: string } | null = null;
    if (!engine.sourceTagged && unmapped.length > 0) {
        try {
            sourceTagInstall = await installSourceTags({
                read: async path => {
                    const response = await vcaasRequest(
                        `${base}/files/content?path=${encodeURIComponent(path)}`,
                        {},
                        auth.ctx
                    );
                    if (!response.ok) return null;
                    const payload = (await response.json().catch(() => null)) as
                        | { data?: { content?: string; encoding?: string } }
                        | null;
                    if (payload?.data?.encoding !== "utf8") return null;
                    return payload.data.content ?? "";
                },
                write: async (path, content) => {
                    const response = await vcaasRequest(
                        `${base}/files/content`,
                        {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: fileWriteBody(path, content),
                        },
                        auth.ctx
                    );
                    if (!response.ok) return false;
                    // The same free fidelity check every other write gets.
                    const payload = (await response.json().catch(() => null)) as
                        | { data?: { bytesWritten?: number } }
                        | null;
                    const stored = payload?.data?.bytesWritten;
                    return typeof stored !== "number" || stored === Buffer.byteLength(content, "utf8");
                },
            });
            console.info(`[visual-edit] source-tag install for ${projectId}: ${sourceTagInstall.status}`);
        } catch (error) {
            console.error("[visual-edit] source-tag install failed:", error);
        }
    }

    // ── 5. Rebuild, so the change is actually visible ──────────────────────
    let rebuildStarted = false;
    let rebuildCode: string | null = null;

    const rebuildResponse = await vcaasRequest(`${base}/rebuild`, { method: "POST" }, auth.ctx);
    if (rebuildResponse.ok) {
        rebuildStarted = true;
    } else {
        const payload = (await rebuildResponse.json().catch(() => null)) as
            | { errors?: { errorCode?: string }; code?: string }
            | null;
        rebuildCode = payload?.errors?.errorCode || payload?.code || `HTTP_${rebuildResponse.status}`;
    }

    /**
     * ⭐ G3 — THE 0.3-CREDIT CHARGE, NOW ACTUALLY WIRED.
     *
     * F12 could only report `charged: false, reason: "endpoint-missing"` because
     * metering an arbitrary amount needed a Platform-Bridge endpoint it was not
     * allowed to write. `POST /platform/credits/:id/spend` is that endpoint.
     *
     * Three rules, all of them the brief's:
     *
     *   · **At most once per apply.** The `reference` is the idempotency key and it
     *     names THIS batch (project + the change ids), so a retried request charges
     *     nothing the second time.
     *   · **Never on failure.** It runs only after at least one file was written —
     *     everything above this point returns early.
     *   · **Never blocking.** An empty balance answers `charged: false, insufficient`
     *     with a 200 and the edit stands. A bridge outage is caught and reported the
     *     same way. There is no branch here that can fail the request.
     */
    /**
     * ⚠️ NO METERING HERE. totalum-platform charges 0.3 credits per apply through its
     * Platform Bridge; this app has no per-user balance to charge — the operator's own
     * key pays for whatever upstream meters. `billing` is still reported so the response
     * shape stays identical to the platform's and the client can be a straight copy.
     */
    const billing: { charged: boolean; amount: number; reason: string } = {
        charged: false,
        amount: VISUAL_EDIT_CREDIT_COST,
        reason: "not-metered-in-this-app",
    };

    return NextResponse.json(
        {
            ok: true,
            data: {
                /**
                 * ⚠️ WHAT WAS WRITTEN, PLUS WHAT WAS ALREADY TRUE — and NOT what was
                 * merely resolved. An edit that `applyEdits` skipped, or one in a
                 * file the verification refused, must not be reported as applied:
                 * the bar would clear a change that never reached the file.
                 */
                applied: [
                    /**
                     * ⚠️ G5 — ONE EDIT CAN SATISFY SEVERAL CHANGES, AND ALL OF THEM MUST
                     * BE REPORTED. Consecutive edits to one element's class attribute are
                     * composed into a single write (recolour then resize is two changes and
                     * one attribute); reporting only the first would leave the rest sitting
                     * in the unsaved-changes bar describing an edit that is already in the
                     * file. `changeIds` is absent on legacy-tier edits, where one change is
                     * always one edit.
                     *
                     * Deduplicated because a group can produce more than one span — a class
                     * edit that rewrites a literal AND appends to a `cn()` call is two.
                     */
                    ...[
                        ...new Map(
                            applied
                                .filter(edit => written.includes(edit.filePath))
                                .flatMap(edit =>
                                    (edit.changeIds ?? [edit.changeId]).map(
                                        changeId =>
                                            [
                                                changeId,
                                                {
                                                    changeId,
                                                    filePath: edit.filePath,
                                                    confident: edit.confident,
                                                    score: edit.score,
                                                },
                                            ] as const
                                    )
                                )
                        ).values(),
                    ],
                    ...satisfied.map(changeId => ({
                        changeId,
                        filePath: null,
                        confident: true,
                        score: 0,
                        alreadySatisfied: true,
                    })),
                ],
                unmapped,
                filesWritten: written.length,
                writeFailures,
                rebuildStarted,
                rebuildCode,
                billing,
                // G3/P4 — say when the file cap bit, so a `not-found` is explicable.
                filesTruncated,
                unsafeWrites,
                /**
                 * G6 — which uploads were copied into `public/uploads/`, and which could
                 * not be. Reported because an image that kept its signed url is the one
                 * that will break a `next/image` later, and that must be visible in
                 * support rather than discovered by the customer.
                 */
                assetsCopied,
                assetFailures,
                // G5 — reported so a one-off project upgrade is visible in the logs and
                // in support, rather than being an invisible side effect of an apply.
                sourceTagInstall,
                /**
                 * ⭐ G5 — WHICH TIER PLACED WHAT. `sourceTagged: false` on a project that
                 * keeps producing unmappable changes is the signal to rebuild it with the
                 * source-tag loader, and `parsed: false` means the parser did not run at
                 * all — both are invisible without this.
                 */
                engine,
            },
        },
        { status: 200 }
    );
}
