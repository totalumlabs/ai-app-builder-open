/**
 * ═══ WHAT PEOPLE ACTUALLY PASTE INTO "REPOSITORY" ═══════════════════════════
 *
 * The field wants `owner/name`, which is what the VCaaS API stores and what the
 * modal's placeholder asks for. Nobody has `owner/name` on their clipboard: they
 * have whatever GitHub's green **Code** button or their address bar gave them.
 *
 * So this accepts every one of those and normalises it. The forms handled, all
 * verified against GitHub's own UI rather than guessed:
 *
 *   owner/name                                  ← the documented form
 *   https://github.com/owner/name
 *   https://github.com/owner/name.git           ← "Clone → HTTPS"
 *   https://github.com/owner/name/tree/main/x   ← copied from a browsed file
 *   https://github.com/owner/name/pull/12       ← any deep link
 *   git@github.com:owner/name.git               ← "Clone → SSH"
 *   ssh://git@github.com/owner/name.git
 *   git://github.com/owner/name.git
 *   github.com/owner/name                       ← pasted without the scheme
 *   www.github.com/owner/name
 *
 * ⚠️ IT REFUSES ANOTHER HOST RATHER THAN GUESSING. `https://gitlab.com/a/b` has a
 * perfectly good `owner/name` in it, and taking it would send a GitHub token to a
 * repository that does not exist and fail with something unhelpful upstream.
 * GitHub Enterprise hosts are refused for the same reason: the API this connects to
 * only talks to github.com.
 *
 * ⚠️ IT DOES NOT VALIDATE THAT THE REPO EXISTS. That is the connect call's job,
 * which does it properly with the token. This only decides what to send.
 *
 * Pure module: no React, no fetch. Unit-tested by
 * `src/lib/__tests__/github-repo.test.ts`.
 */

/**
 * GitHub's own rules, as enforced by the signup form:
 *   · owner — alphanumerics and single hyphens, no leading/trailing hyphen;
 *   · name  — alphanumerics, `.`, `_`, `-`; not `.` or `..`.
 *
 * Kept deliberately permissive on the owner (we do not re-implement the
 * hyphen-placement rule) — being stricter than GitHub would reject a real repo,
 * which is the worse failure of the two.
 */
const SEGMENT = /^[A-Za-z0-9._-]+$/;

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

function cleanName(name: string): string {
    // `.git` is a clone-URL suffix, never part of the repository's name.
    return name.replace(/\.git$/i, "");
}

function build(owner: string, name: string): string | null {
    const cleanedOwner = owner.trim();
    const cleanedName = cleanName(name.trim());

    if (!cleanedOwner || !cleanedName) return null;
    if (!SEGMENT.test(cleanedOwner) || !SEGMENT.test(cleanedName)) return null;
    // `.` and `..` are directory names, not repositories.
    if (cleanedName === "." || cleanedName === "..") return null;

    return `${cleanedOwner}/${cleanedName}`;
}

/**
 * ⭐ `owner/name`, or `null` if this cannot be one.
 *
 * `null` is the signal the UI shows its "that doesn't look like a GitHub
 * repository" message on. It never throws.
 */
export function parseGithubRepo(input: string): string | null {
    const raw = (input || "").trim();
    if (!raw) return null;

    // ── SSH clone form: git@github.com:owner/name.git ────────────────────────
    // ⚠️ HANDLED FIRST, BEFORE `new URL`. `scp`-style SSH is not a URL — parsing
    // it yields the scheme `git@github.com:` and a nonsense pathname.
    const scp = raw.match(/^[A-Za-z0-9._-]+@([^:/]+):(.+)$/);
    if (scp) {
        if (!GITHUB_HOSTS.has(scp[1].toLowerCase())) return null;
        const parts = scp[2].split("/").filter(Boolean);
        return parts.length >= 2 ? build(parts[0], parts[1]) : null;
    }

    // ── Anything with a host ─────────────────────────────────────────────────
    const looksLikeUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) || /^(www\.)?github\.com\//i.test(raw);

    if (looksLikeUrl) {
        // A bare `github.com/owner/name` has no scheme; `new URL` needs one.
        const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

        let url: URL;
        try {
            url = new URL(candidate);
        } catch {
            return null;
        }

        if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null;

        // ⚠️ Only the FIRST TWO segments. Everything after them is a branch, a file
        // path, a pull request — noise from having copied a deep link.
        const parts = url.pathname.split("/").filter(Boolean);
        return parts.length >= 2 ? build(parts[0], parts[1]) : null;
    }

    // ── The plain form ───────────────────────────────────────────────────────
    const parts = raw.split("/").filter(Boolean);
    if (parts.length !== 2) return null;
    return build(parts[0], parts[1]);
}

/** Did the user paste something we had to rewrite? Drives the "we read this as…" hint. */
export function wasNormalized(input: string, parsed: string | null): boolean {
    if (!parsed) return false;
    return (input || "").trim() !== parsed;
}
