/**
 * ═══ COPY, NOT A PORT — AND THAT IS THE POINT ═══════════════════════════════
 *
 * The workspace components in `src/components/workspace/**` are lifted from
 * totalum-platform so that a fix made there can be copied here (and back) without
 * a translation pass. Every one of them calls `useT()`, so this project needs the
 * same hook and the same key space — and it gets them by taking the platform's
 * `en.ts` verbatim.
 *
 * ⚠️ WHAT IS DELIBERATELY MISSING: the locale provider, the cookie, the Spanish
 * dictionary and the server-side negotiation. This app is English-only, so `useT`
 * is a plain function over one frozen dictionary rather than a React context — no
 * provider to mount, nothing to forget, and a component copied from the platform
 * still compiles unchanged.
 *
 * ⚠️ KEEP `en.ts` AS A STRAIGHT COPY. Adding keys here that the platform does not
 * have (or editing copy in place) is how the two drift into being two different
 * dictionaries that merely look alike. New strings belong in the platform first.
 */
import { en } from "./en";
import { translateWith } from "./resolve";
import type { Dictionary, Translate } from "./types";

export type { Dictionary, Translate, TranslationKey, TranslationVars } from "./types";

/**
 * The platform's locale union, kept so `src/lib/format.ts` (copied verbatim) and the
 * components that call `useLocale()` compile. Only `en` is ever active here.
 */
export type Locale = "en" | "es";

const dictionary = en as unknown as Dictionary;

/** The translator. Identical signature to the platform's, so callers are portable. */
export const t: Translate = translateWith(dictionary);

/** The hook every copied component uses for copy: `const t = useT()`. */
export function useT(): Translate {
  return t;
}

/** The platform's locale hook, frozen to English — this app ships one dictionary. */
export function useLocale(): { locale: Locale; t: Translate } {
  return { locale: "en", t };
}
