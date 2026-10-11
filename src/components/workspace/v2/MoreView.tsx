"use client";

import * as React from "react";
import { ChartColumnIcon, CreditCardIcon, DatabaseIcon, GaugeIcon, GlobeIcon, KeyIcon, KeySquareIcon, SettingsIcon, SmartphoneIcon, TerminalIcon, TimerIcon } from "lucide-react";
import { InlineModals } from "@/components/primitives";
import { useT } from "@/i18n";
import type { TranslationKey } from "@/i18n/types";
import { cn } from "@/lib/utils";

/** The v2 workspace "More" view: the project's sections in an aside, the chosen one in the main area. */
/** This app adds the custom domain and the logs, which the platform keeps elsewhere in its workspace. */
export type MoreSection = "database" | "analytics" | "usage" | "apiKeys" | "cron" | "secrets" | "mobile" | "payments" | "domain" | "logs" | "settings";

export const MORE_SECTIONS: { id: MoreSection; labelKey: TranslationKey; icon: typeof DatabaseIcon }[] = [
    { id: "database", labelKey: "workspace.tabs.database", icon: DatabaseIcon },
    { id: "analytics", labelKey: "engineV2.analytics.open", icon: ChartColumnIcon },
    { id: "usage", labelKey: "engineV2.usage.title", icon: GaugeIcon },
    { id: "apiKeys", labelKey: "engineV2.apiKeys.title", icon: KeySquareIcon },
    { id: "cron", labelKey: "engineV2.cron.title", icon: TimerIcon },
    { id: "secrets", labelKey: "workspace.actions.secrets", icon: KeyIcon },
    { id: "mobile", labelKey: "engineV2.mobile.title", icon: SmartphoneIcon },
    { id: "payments", labelKey: "engineV2.payments.title", icon: CreditCardIcon },
    { id: "domain", labelKey: "workspace.domain.title", icon: GlobeIcon },
    { id: "logs", labelKey: "workspace.logs.title", icon: TerminalIcon },
    { id: "settings", labelKey: "workspace.projectSettings.open", icon: SettingsIcon },
];

/**
 * `children` is the chosen section, rendered by the shell with the SAME component it opens as a modal: inside
 * `<InlineModals>` that modal lays itself out in place. The database is the panel itself and owns its full height.
 */
export function MoreView({ section, onSection, children }: { section: MoreSection; onSection: (section: MoreSection) => void; children: React.ReactNode }) {
    const t = useT();
    const nav = React.useRef<HTMLElement>(null);
    // On a phone the aside is a scrolling row: keep the chosen section in view (e.g. opened from the header's Payments).
    React.useEffect(() => {
        nav.current?.querySelector("[aria-current=page]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [section]);
    return (
        <div className="flex h-full min-h-0 flex-col md:flex-row" data-testid="more-view">
            <nav
                ref={nav}
                aria-label={t("workspace.tabs.moreSections")}
                className="border-border/60 tp-scroll flex shrink-0 gap-1 overflow-x-auto border-b p-2 md:w-52 md:flex-col md:overflow-x-visible md:overflow-y-auto md:border-r md:border-b-0 md:p-3"
            >
                {MORE_SECTIONS.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        data-testid={`more-${item.id}`}
                        aria-current={section === item.id ? "page" : undefined}
                        onClick={() => onSection(item.id)}
                        className={cn(
                            "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors",
                            "focus-visible:ring-ring/60 focus-visible:ring-2 focus-visible:outline-none",
                            section === item.id ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                    >
                        <item.icon className="size-4 shrink-0" aria-hidden />
                        {t(item.labelKey)}
                    </button>
                ))}
            </nav>
            <div className={cn("min-h-0 min-w-0 flex-1", section === "database" ? "flex flex-col" : "tp-scroll overflow-y-auto px-4 pt-6 sm:px-8")}>
                <InlineModals>{children}</InlineModals>
            </div>
        </div>
    );
}
