import type { Dictionary, Translate, TranslationKey, TranslationVars } from "./types";

/**
 * Dictionary-agnostic lookup helpers.
 *
 * This module intentionally imports NO dictionary, so the client provider can
 * translate using only the dictionary the server handed it — the other
 * language never reaches the browser bundle.
 */

export function resolveKey(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const segment of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === "string" ? node : undefined;
}

export function interpolate(template: string, vars?: TranslationVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match,
  );
}

/**
 * Build a translator over one dictionary, with an optional fallback dictionary.
 * A missing key degrades to the fallback and then to the key itself — a screen
 * never blanks out because of a translation. (Type-checking makes it very hard
 * for a key to be missing in the first place.)
 */
export function translateWith(dict: Dictionary, fallback?: Dictionary): Translate {
  return (key: TranslationKey, vars?: TranslationVars) => {
    const value = resolveKey(dict, key) ?? (fallback ? resolveKey(fallback, key) : undefined);
    if (value === undefined) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[i18n] missing translation key: ${key}`);
      }
      return key;
    }
    return interpolate(value, vars);
  };
}
