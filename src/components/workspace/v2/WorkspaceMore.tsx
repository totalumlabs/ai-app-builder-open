"use client";

import * as React from "react";
import { LayoutGridIcon } from "lucide-react";
import { EmptyState, Modal } from "@/components/primitives";
import { useT } from "@/i18n";
import { isPublished, isV2Project } from "@/lib/project-status";
import type { VcaasProject } from "@/lib/vcaas-types";
import { SqlDatabasePanel } from "../database-v2/SqlDatabasePanel";
import { LogsPanel } from "../LogsPanel";
import { SecretsModal } from "../SecretsModal";
import { CronJobsModal } from "./CronJobsModal";
import { MobilePanel } from "./MobilePanel";
import { MoreView, type MoreSection } from "./MoreView";
import { PaymentsModal } from "./PaymentsModal";
import { ProjectApiKeysModal } from "./ProjectApiKeysModal";
import { ProjectDomainPanel } from "./ProjectDomainPanel";
import { SiteAnalyticsModal } from "./SiteAnalyticsModal";
import { UsageLimitsModal } from "./UsageLimitsModal";
import { V2ProjectSettings } from "./V2ProjectSettings";

const noop = () => {};

/**
 * The workspace's "More" tab: every project control of a new-engine project, as the platform's More view shows them
 * — an aside of sections, the chosen one in the main area. Each section is the platform's own dialog laid out in
 * place (`<InlineModals>` inside `MoreView`), talking to the public VCaaS API through this app's proxy.
 *
 * New-engine projects only. A legacy project gets a notice: its database endpoints are a different set, and the
 * rest of these sections do not exist for it (the API answers `ENGINE_NOT_SUPPORTED`).
 */
export function WorkspaceMore({
    project,
    onProjectChanged,
    onPublish,
}: {
    project: VcaasProject;
    onProjectChanged: () => void;
    /** Payments asks for a publish once it is set up; the page owns the publish (and its banner). */
    onPublish: () => void;
}) {
    const t = useT();
    const [section, setSection] = React.useState<MoreSection>("database");
    const projectId = project.projectId;
    const published = isPublished(project);

    if (!isV2Project(project)) {
        return <EmptyState variant="panel" icon={<LayoutGridIcon />} title={t("more.legacyTitle")} description={t("more.legacyBody")} />;
    }

    return (
        <MoreView section={section} onSection={setSection}>
            {section === "database" ? (
                <SqlDatabasePanel project={project} />
            ) : section === "analytics" ? (
                <SiteAnalyticsModal open onOpenChange={noop} projectId={projectId} published={published} />
            ) : section === "usage" ? (
                <UsageLimitsModal open onOpenChange={noop} projectId={projectId} />
            ) : section === "apiKeys" ? (
                <ProjectApiKeysModal open onOpenChange={noop} projectId={projectId} previewUrl={project.temporalDevelopmentProjectUrl} onPreviewRotated={onProjectChanged} />
            ) : section === "cron" ? (
                <CronJobsModal open onOpenChange={noop} projectId={projectId} published={published} liveHost={project.productionProjectUrl} />
            ) : section === "secrets" ? (
                <SecretsModal open onOpenChange={noop} projectId={projectId} secrets={project.secrets ?? []} onChanged={onProjectChanged} />
            ) : section === "mobile" ? (
                <Modal open onOpenChange={noop} size="lg" title={t("engineV2.mobile.title")} description={t("engineV2.mobile.description")}>
                    <MobilePanel projectId={projectId} />
                </Modal>
            ) : section === "payments" ? (
                <PaymentsModal open onOpenChange={noop} projectId={projectId} published={published} onPublish={onPublish} />
            ) : section === "domain" ? (
                <ProjectDomainPanel project={project} onChanged={onProjectChanged} />
            ) : section === "logs" ? (
                <Modal open onOpenChange={noop} size="xl" title={t("workspace.logs.title")} description={t("workspace.logs.modalDescription")} flush>
                    <div className="h-[70vh]">
                        <LogsPanel projectId={projectId} hasBeenDeployed={published || Boolean(project.productionProjectUrl)} engineV2 />
                    </div>
                </Modal>
            ) : (
                <Modal open onOpenChange={noop} size="lg" title={t("workspace.projectSettings.title")} description={t("more.settingsDescription")}>
                    <div className="space-y-5">
                        <V2ProjectSettings project={project} onChanged={onProjectChanged} />
                    </div>
                </Modal>
            )}
        </MoreView>
    );
}
