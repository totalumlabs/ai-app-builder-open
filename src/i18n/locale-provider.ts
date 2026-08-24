/**
 * ⚠️ A SHIM SO PLATFORM COMPONENTS COMPILE UNCHANGED. totalum-platform imports
 * `useT` from `@/i18n/locale-provider` in some files and from `@/i18n` in others;
 * this app is English-only (see `./index.ts`), so both paths lead to the same
 * frozen dictionary. Keeping the module path alive is what lets a file be copied
 * across without touching its imports.
 */
export { useT, t } from "./index";
