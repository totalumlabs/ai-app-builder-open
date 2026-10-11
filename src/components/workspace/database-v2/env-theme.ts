import type { DbEnv } from "@/lib/vcaas-types";

/**
 * Dev is ORANGE, Live is GREEN (Francesc, 2026-09-30): the switch, the explorer's frame, the banner and the primary
 * write buttons all carry the colour of the database being touched, so a write on Live never looks like one on Dev.
 * E3 (2026-10-08): subtle tints and thin borders, never a solid block of colour — the hue alone still tells them apart.
 */
export const ENV_THEME: Record<DbEnv, { selected: string; frame: string; banner: string; dot: string; accent: string; soft: string; button: string }> = {
    dev: {
        selected: "bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-300 hover:bg-orange-100 hover:text-orange-800 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-500/40",
        frame: "border-orange-200 dark:border-orange-500/30",
        banner: "bg-orange-50/70 text-orange-900 border-orange-100 dark:bg-orange-500/5 dark:text-orange-100 dark:border-orange-500/20",
        dot: "bg-orange-400",
        accent: "text-orange-700 dark:text-orange-300 border-orange-400",
        soft: "bg-orange-50 dark:bg-orange-500/10",
        button: "border border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-500/40 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/20",
    },
    live: {
        selected: "bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-500/40",
        frame: "border-emerald-200 dark:border-emerald-500/30",
        banner: "bg-emerald-50/70 text-emerald-900 border-emerald-100 dark:bg-emerald-500/5 dark:text-emerald-100 dark:border-emerald-500/20",
        dot: "bg-emerald-500",
        accent: "text-emerald-700 dark:text-emerald-300 border-emerald-500",
        soft: "bg-emerald-50 dark:bg-emerald-500/10",
        button: "border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20",
    },
};

export const envLabel = (env: DbEnv) => (env === "dev" ? "Dev" : "Live");
