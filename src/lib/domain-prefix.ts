/**
 * A domain bought on Totalum answers on `<prefix>.<domain>` — `www`, `app` or any valid DNS label the owner types — and
 * the bare domain redirects (301) there; `apex` serves the bare domain itself. The API checks the same rule
 * (`canonicalHost`); this is what the picker allows before the click. Pure: no React, no fetch.
 */

/** The picker's chips; anything else goes in "Other". `apex` = the bare domain. */
export const PREFIX_PRESETS: readonly string[] = ["www", "app", "apex"];
export const DEFAULT_PREFIX = "www";

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** What the user typed → a bare lowercase label (`" App. "` → `"app"`). */
export const normalisePrefix = (raw: string) => raw.trim().toLowerCase().replace(/\.+$/, "");

/** One DNS label: letters, digits and inner hyphens, at most 63 characters. */
export const isValidPrefix = (prefix: string) => LABEL.test(prefix);

/** The address the site answers on for that prefix (`apex` = the bare domain). */
export const siteHostname = (domain: string, prefix: string) => (prefix === "apex" ? domain : `${prefix}.${domain}`);
