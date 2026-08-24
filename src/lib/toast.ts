"use client";

import { toast as sonnerToast, type ExternalToast } from "sonner";

/**
 * Toast helpers.
 *
 * Every phase uses these instead of calling sonner directly, so tone, duration
 * and iconography stay consistent. Copy is ALWAYS passed in already translated
 * (call `useT()` at the call site) — these helpers never own strings.
 */

const DURATION = {
  short: 3000,
  base: 4500,
  long: 7000,
} as const;

export interface ToastOptions extends ExternalToast {
  description?: string;
}

export const toast = {
  success(message: string, options?: ToastOptions) {
    return sonnerToast.success(message, { duration: DURATION.base, ...options });
  },

  error(message: string, options?: ToastOptions) {
    // Errors stay on screen longer: the user usually needs to read and act.
    return sonnerToast.error(message, { duration: DURATION.long, ...options });
  },

  warning(message: string, options?: ToastOptions) {
    return sonnerToast.warning(message, { duration: DURATION.long, ...options });
  },

  info(message: string, options?: ToastOptions) {
    return sonnerToast(message, { duration: DURATION.base, ...options });
  },

  /** Returns the toast id so the caller can `toast.dismiss(id)` when done. */
  loading(message: string, options?: ToastOptions) {
    return sonnerToast.loading(message, { duration: Infinity, ...options });
  },

  /**
   * Wrap an async action. All three states must be provided already
   * translated, e.g.
   *   toast.promise(save(), { loading: t("common.saving"), success: t("common.saved"), error: t("common.unexpectedError") })
   */
  promise<T>(
    promise: Promise<T>,
    messages: { loading: string; success: string | ((value: T) => string); error: string },
  ) {
    return sonnerToast.promise(promise, messages);
  },

  dismiss(id?: string | number) {
    return sonnerToast.dismiss(id);
  },
};

export { DURATION as TOAST_DURATION };
