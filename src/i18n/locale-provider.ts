/**
 * Minimal English dictionary for the shared primitives.
 * The old Totalum-keyed i18n surface is gone; primitives resolve only the
 * `common.*` keys below, interpolated with {name} placeholders.
 */

const DICTIONARY: Record<string, string> = {
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.close": "Close",
  "common.retry": "Try again",
  "common.copyFailed": "Could not copy to clipboard",
  "common.copyToClipboard": "Copy to clipboard",
  "common.copied": "Copied",
  "common.typeToConfirm": 'Type "{value}" to confirm',
  "common.loadFailed": "This section did not load",
  "common.loadFailedDescription": "Something went wrong while loading this content.",
};

export function t(
  key: string,
  vars?: Record<string, string | number>
): string {
  let value = DICTIONARY[key] ?? key;
  for (const [name, v] of Object.entries(vars ?? {})) {
    value = value.replaceAll(`{${name}}`, String(v));
  }
  return value;
}

/**
 * Hook-compatible access for components — primitives call useT(), not the
 * module directly, so the signature stays a hook boundary.
 */
export function useT() {
  return t;
}
