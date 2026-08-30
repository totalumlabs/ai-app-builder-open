"use client";

import * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import {
  ActivityBar,
  WorkspaceTopBar,
  DockTabs,
  type WorkspaceRail,
  type DockTab,
} from "./chrome";

function handleClass(vertical?: boolean) {
  return `relative ${vertical ? "h-1" : "w-1"} bg-panel-border/50 hover:bg-primary/60 transition-colors`;
}

export function WorkspaceLayout({
  projectName,
  leftRail,
  centerContent,
  agentContent,
  dockContent,
  previewContent,
  railNode,
}: {
  projectName: string;
  leftRail: React.ReactNode;
  centerContent: React.ReactNode;
  agentContent: React.ReactNode;
  dockContent: React.ReactNode;
  previewContent: React.ReactNode;
  railNode?: (rail: WorkspaceRail) => React.ReactNode;
}) {
  const [rail, setRail] = React.useState<WorkspaceRail>("files");
  const [dockTab, setDockTab] = React.useState<DockTab>("terminal");

  return (
    <div className="flex h-screen flex-col bg-background">
      <WorkspaceTopBar projectName={projectName} saveState="idle" />
      <div className="flex min-h-0 flex-1">
        <ActivityBar rail={rail} onRail={setRail} />
        <Group orientation="horizontal" className="flex-1">
          <Panel defaultSize={16} minSize={10} maxSize={30}>
            <div className="h-full bg-panel/50 text-sm">
              {railNode ? railNode(rail) : leftRail}
            </div>
          </Panel>
          <Separator className={handleClass()} />

          <Panel defaultSize={64} minSize={30}>
            <Group orientation="vertical">
              <Panel defaultSize={70} minSize={30}>
                <Group orientation="horizontal">
                  <Panel defaultSize={62} minSize={25}>
                    {centerContent}
                  </Panel>
                  <Separator className={handleClass()} />
                  <Panel defaultSize={38} minSize={20}>
                    {agentContent}
                  </Panel>
                  <Separator className={handleClass()} />
                  <Panel defaultSize={22} minSize={14} maxSize={55} collapsible>
                    <div className="h-full border-l border-panel-border bg-panel/30">{previewContent}</div>
                  </Panel>
                </Group>
              </Panel>
              <Separator className={handleClass(true)} />
              <Panel defaultSize={30} minSize={12} maxSize={60}>
                <DockTabs tab={dockTab} onTab={setDockTab}>
                  {dockContent}
                </DockTabs>
              </Panel>
            </Group>
          </Panel>
        </Group>
      </div>
    </div>
  );
}
