import type { en } from "./en";

/**
 * `en` is declared `as const` so we can derive the exhaustive list of dot-paths
 * below. `Widen` turns those string literals back into plain `string` so other
 * dictionaries (es) may hold different copy while being forced to have exactly
 * the same key structure.
 */
type Widen<T> = {
  [K in keyof T]: T[K] extends string ? string : Widen<T[K]>;
};

export type Dictionary = Widen<typeof en>;

type Paths<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
    }[keyof T & string];

/** Every valid translation key, e.g. `"nav.projects"`. Autocompletes. */
export type TranslationKey = Paths<typeof en>;

/** Values interpolated into `{placeholders}`. */
export type TranslationVars = Record<string, string | number>;

/** The translate function handed to components by `useT()` / `getT()`. */
export type Translate = (key: TranslationKey, vars?: TranslationVars) => string;
