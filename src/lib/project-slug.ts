/**
 * PROJECT SLUG RULES — mirrored exactly from VCaaS `createProject`.
 *
 * The authority is `totalum-account-backend/src/api/v1/vcaas/vcaas.controller.ts`:
 *
 *   const regex = /^[a-z]([a-z0-9]|-(?!-))*(?<!-)$/;
 *   if (!regex.test(id))                     → 400 INVALID_PROJECT_NAME
 *   if (id.length < 4 || id.length > 35)     → 400 INVALID_PROJECT_NAME_LENGTH
 *   if (id.includes('-dev-'))                → 400 RESERVED_PROJECT_NAME
 *   if (await checkOrganizationExists(id))   → 400 PROJECT_ALREADY_EXISTS
 *
 * ⚠️ THESE RULES ARE DUPLICATED ON PURPOSE, and that is a real cost: if VCaaS
 * changes them, this file must change too. The alternative — letting the user type
 * a name, submit, and discover the rule from a 400 — is worse on the product's
 * single most important conversion surface. **The server remains the authority**:
 * we never assume a name is valid just because it passed here, and every upstream
 * error code is still mapped and shown.
 *
 * Pure module: no React, no fetch, no env. Unit-tested by
 * `src/lib/__tests__/project-slug.test.ts`.
 */

/** VCaaS's own regex, character for character. */
export const PROJECT_SLUG_REGEX = /^[a-z]([a-z0-9]|-(?!-))*(?<!-)$/;

export const PROJECT_SLUG_MIN_LENGTH = 4;
export const PROJECT_SLUG_MAX_LENGTH = 35;

/** `-dev-` is reserved: totalum-backend derives development hostnames from it. */
export const RESERVED_SLUG_FRAGMENT = "-dev-";

/** Why a slug is not acceptable. `null` means it is. */
export type SlugProblem =
    | "empty"
    | "too-short"
    | "too-long"
    | "invalid-format"
    | "reserved";

/**
 * Validate a slug against every rule VCaaS applies, in the same order, so the
 * message the user sees locally matches the one they would have got from the API.
 */
export function validateProjectSlug(slug: string): SlugProblem | null {
    if (!slug) return "empty";
    // Format first, matching the server: an id with a capital letter is
    // INVALID_PROJECT_NAME upstream even when its length is fine.
    if (!PROJECT_SLUG_REGEX.test(slug)) return "invalid-format";
    if (slug.length < PROJECT_SLUG_MIN_LENGTH) return "too-short";
    if (slug.length > PROJECT_SLUG_MAX_LENGTH) return "too-long";
    if (slug.includes(RESERVED_SLUG_FRAGMENT)) return "reserved";
    return null;
}

export function isValidProjectSlug(slug: string): boolean {
    return validateProjectSlug(slug) === null;
}

/**
 * ═══ OPENING AN EXISTING PROJECT IS NOT CREATING ONE ════════════════════════
 *
 * ⚠️⚠️ USING `isValidProjectSlug` ON A READ PATH MADE REAL PROJECTS UNREACHABLE, AND IT
 * WAS REPORTED AS A BARE 404 ON THE WORKSPACE PAGE.
 *
 * Measured against the dev accounts database — 1591 instances, two of them impossible to
 * open in the platform at all:
 *
 *     "deep-investigate-on-internet111testdev"   38 chars  → too-long   (max is 35)
 *     "francesc-test-dev-tesstttt"               contains  → reserved   ("-dev-")
 *
 * Both exist upstream and work everywhere else. They were created through a path with
 * different limits, and the platform then refused to *look at* them, because the same
 * function was doing two unrelated jobs:
 *
 *   · **CREATION rules** — length 4–35 and the `-dev-` reservation. These are VCaaS's
 *     limits for minting a NEW project, and they belong on the create form, where a 400
 *     from the API is the alternative. They say nothing about an id that already exists.
 *   · **A STRUCTURAL PATH GUARD** — the character set. This is the one the workspace page
 *     and the proxy routes actually need: the slug is interpolated into an upstream URL,
 *     so it must not be able to carry `/`, `..`, `?`, `#`, whitespace or an escape.
 *
 * This is the second job, alone. ⚠️ THE SECURITY PROPERTY IS UNCHANGED: the regex is the
 * same one, so a routable slug still cannot contain anything that could traverse or
 * terminate a path. Only the two limits that describe *minting* are dropped, plus a
 * generous ceiling so a pathological URL is still rejected.
 *
 * Use this to READ, `isValidProjectSlug` to CREATE.
 */
export const ROUTABLE_SLUG_MAX_LENGTH = 63;

export function isRoutableProjectSlug(slug: string): boolean {
    if (!slug) return false;
    if (slug.length > ROUTABLE_SLUG_MAX_LENGTH) return false;
    return PROJECT_SLUG_REGEX.test(slug);
}

/**
 * Coerce arbitrary text into a slug that satisfies the regex.
 *
 * The steps, in order, each one there for a specific rule:
 *   1. lowercase + trim                       — the regex is lowercase-only
 *   2. strip accents (café → cafe)            — ES users type accented words
 *   3. non-alphanumerics → hyphen             — spaces, punctuation, emoji
 *   4. collapse runs of hyphens               — the regex forbids `--`
 *   5. strip leading/trailing hyphens         — must start with a letter, not end with `-`
 *   6. drop any leading digits                — must START with a LETTER
 *   7. truncate to 35, then re-strip a trailing hyphen that truncation may expose
 *
 * Returns "" when nothing usable survives; callers fall back to a default name.
 */
/**
 * Steps 1–5 only: lowercase, de-accent, hyphenate, collapse, trim edges.
 *
 * Split out because `suggestProjectSlug` needs the WORDS of the full prompt, and
 * `slugify`'s 35-character truncation would hand it a mangled final word —
 * "…de reservas para mi barbería" truncated mid-word yielded the word "p", which
 * then became part of the suggested name. Word selection has to happen before any
 * truncation.
 */
function normalizeWords(text: string): string {
    return text
        .toLowerCase()
        .trim()
        // Decompose accents into base char + combining mark, then drop the marks.
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function slugify(text: string): string {
    if (!text) return "";

    let slug = normalizeWords(text);

    // The first character must be a LETTER. Strip everything before the first one,
    // rather than prefixing a filler letter — "2048-game" becomes "game", which
    // reads better than "a2048-game".
    //
    // ⚠️ `[^a-z]+`, NOT `[0-9]+-?`. At this point the string is only [a-z0-9-], and
    // an earlier version of this line stripped a single digit-run plus one hyphen,
    // so "0-0-0-0" came out as "0-0-0" — STILL starting with a digit, and therefore
    // still a 400 from `createProject`. Caught by the totality test in
    // `__tests__/project-slug.test.ts`; that test is the reason to keep this greedy.
    slug = slug.replace(/^[^a-z]+/, "");

    if (slug.length > PROJECT_SLUG_MAX_LENGTH) {
        slug = slug.slice(0, PROJECT_SLUG_MAX_LENGTH).replace(/-+$/g, "");
    }

    // A `-dev-` fragment would be rejected upstream; neutralise it here.
    while (slug.includes(RESERVED_SLUG_FRAGMENT)) {
        slug = slug.replace(RESERVED_SLUG_FRAGMENT, "-development-");
        if (slug.length > PROJECT_SLUG_MAX_LENGTH) {
            slug = slug.slice(0, PROJECT_SLUG_MAX_LENGTH).replace(/-+$/g, "");
        }
    }

    return slug;
}

/**
 * Turn a free-text prompt into a memorable project name.
 *
 * Uses the first few meaningful words rather than the whole prompt: a name derived
 * from "build me a kanban board for my team" should be `kanban-board-for`, not a
 * 35-character truncation of the sentence.
 *
 * `fallback` is used when the prompt yields nothing usable (emoji-only, digits
 * only, all stop-words). It is passed in rather than hardcoded so the caller can
 * supply a translated default.
 */
const STOP_WORDS = new Set([
    // EN
    "a", "an", "the", "for", "with", "and", "or", "of", "to", "my", "me", "i",
    "build", "create", "make", "want", "need", "please", "app", "application",
    // ES
    "un", "una", "el", "la", "los", "las", "de", "del", "para", "con", "y", "o",
    "mi", "mis", "quiero", "necesito", "crear", "hacer", "construye", "aplicacion",
]);

export function suggestProjectSlug(prompt: string, fallback = "my-app"): string {
    // ⚠️ `normalizeWords`, NOT `slugify` — slugify truncates to 35 characters, which
    // would cut the last word in half before we ever get to choose words.
    const words = normalizeWords(prompt).split("-").filter(Boolean);

    // Prefer meaningful words. Fall back to the raw words ONLY when every single
    // one was a stop word — with even one meaningful word, "crm" beats "a-crm".
    const meaningful = words.filter(word => !STOP_WORDS.has(word));
    const chosen = (meaningful.length > 0 ? meaningful : words).slice(0, 4);

    let candidate = slugify(chosen.join("-"));

    // Pad a too-short candidate rather than rejecting it — "crm" is a perfectly
    // good idea for a name, it just needs one more character to pass.
    if (candidate && candidate.length < PROJECT_SLUG_MIN_LENGTH) {
        candidate = slugify(`${candidate}-app`);
    }

    return isValidProjectSlug(candidate) ? candidate : fallback;
}

/**
 * Produce a fresh candidate after a name collision.
 *
 * Appends `-2`, `-3`, … and, when that would exceed 35 characters, trims the base
 * so the suffix always fits. `taken` lets the caller skip names it already knows
 * are unavailable, so repeated collisions converge instead of retrying the same id.
 */
export function nextAvailableSlug(base: string, taken: ReadonlySet<string> = new Set()): string {
    const root = slugify(base.replace(/-\d+$/, "")) || "my-app";

    for (let n = 2; n < 1000; n++) {
        const suffix = `-${n}`;
        const maxRoot = PROJECT_SLUG_MAX_LENGTH - suffix.length;
        const trimmed = (root.length > maxRoot ? root.slice(0, maxRoot) : root).replace(/-+$/g, "");
        const candidate = `${trimmed}${suffix}`;

        if (!taken.has(candidate) && isValidProjectSlug(candidate)) return candidate;
    }

    // Practically unreachable; keeps the return type honest.
    return slugify(`${root}-${Date.now().toString(36)}`).slice(0, PROJECT_SLUG_MAX_LENGTH);
}
