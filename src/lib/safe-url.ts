/**
 * ═══ IS THIS URL SAFE FOR THE SERVER TO FETCH? ══════════════════════════════
 *
 * ⚠️⚠️ ANY ROUTE THAT FETCHES A URL A CLIENT SUPPLIED IS AN SSRF PRIMITIVE UNTIL IT
 * ASKS THIS. Our server sits inside a network the browser cannot reach; a request it
 * makes on the caller's behalf runs with our egress, not theirs. `http://localhost:8125/`
 * and `http://169.254.169.254/` are the two that turn a file fetcher into a
 * credential-reading tool.
 *
 * ⚠️ AN ALLOW-SHAPE, NOT A BLOCK-LIST. Only `http`/`https` get through, and any host
 * that is obviously internal BY NAME is refused. This is not a complete defence — a
 * public hostname can still resolve to a private address, and only a resolve-then-pin
 * fetch closes that — but it stops every direct case.
 *
 * ⭐ EXTRACTED IN G6 because the visual editor's apply route began fetching uploaded
 * images server-side to copy them into the project, and shipped without this. The
 * upload route had carried its own private copy since F-something; one definition now
 * serves both, so a hardening applied here reaches every caller.
 */

/** Why this URL may not be fetched, or `null` when it may. */
export function urlRejectionReason(value: string): string | null {
    if (!value) return "No URL was provided";

    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        return "That is not a valid URL";
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "Only http and https URLs can be attached";
    }

    const host = parsed.hostname.toLowerCase();
    const isPrivate =
        host === "localhost" ||
        host === "0.0.0.0" ||
        host.endsWith(".localhost") ||
        host.endsWith(".internal") ||
        /^127\./.test(host) ||
        /^10\./.test(host) ||
        /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
        host === "::1" ||
        host === "[::1]";

    if (isPrivate) return "That host cannot be reached from here";

    return null;
}
