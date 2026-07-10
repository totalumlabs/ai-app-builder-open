export interface VcaasProject {
  projectId: string;
  description: string;
  plan: string;
  agentProcessStatus?: "init" | "done" | "idle";
  agentServerStatus?: "Active" | "Creating" | "Starting" | "Archived" | "Unarchiving" | "Archiving";
  createdAt: string;
  deployment?: {
    status: "deploying" | "success" | "error";
    createdAt: string;
    versionId?: string;
  } | null;
  secrets: VcaasSecret[];
  customDomain?: VcaasDomain | null;
  temporalDevelopmentProjectUrl?: string | null;
  cachedDevelopmentUrl?: string | null;
  developmentUrlFieldToUse?: string | null;
  productionProjectUrl?: string;
  totalCreditsSpent?: number;
}

// Shape returned by the "List Projects" endpoint (GET /vcaas/projects). The
// platform is fully open — this lists every project in the account; there is no
// per-user account or database association involved.
export interface VcaasProjectSummary {
  projectId: string;
  description: string;
  plan: string;
  createdAt: string;
}

export interface VcaasSecret {
  _id: string;
  secretName: string;
  environment: string;
}

export interface VcaasDomain {
  hostname: string;
  status: string;
  sslStatus: string;
  dnsRecordsToAdd?: DnsRecord[];
}

export interface DnsRecord {
  type: string;
  name: string;
  value: string;
}

export interface AgentInputFile {
  name: string;
  url: string;
  imageDescription: string;
}

export interface ConversationMessage {
  author: "user" | "agent";
  message: string;
  messageType: "regular" | "starting" | "building" | "finished" | "error" | "limit-reached";
  createdAt: string;
  versionId?: string;
  secretKeysNeeded?: Record<string, { isProvided: boolean; description: string }>;
  gitDiffUrl?: string;
  // Files the user attached to this message. Client-side only (the VCaaS
  // conversation API does not echo attachments back), used to render the
  // attachment chips/thumbnails on the user's chat bubble.
  inputFiles?: AgentInputFile[];
}

export interface AgentStatus {
  projectId: string;
  status: "init" | "done" | "idle";
  startedAt: string | null;
  realtimeConversation: ConversationMessage[];
  creditsSpent?: number;
}

export interface ProjectVersion {
  _id: string;
  name: string;
  commitMessage?: string;
  prompt?: string;
  createdAt: string;
}

export interface DbTable {
  _id: string;
  type: string;
  label: string;
  description: string;
  icon: string;
  properties: Record<string, DbProperty>;
}

export interface DbProperty {
  id: string;
  name: string;
  propertyType: string;
  label: string;
  description?: string;
  objectReference?: { tableTo?: string; type?: string };
  typeExtras?: Record<string, unknown>;
}

// ─── GitHub integration ───
export interface GithubStatus {
  connected: boolean;
  tokenValid: boolean;
  tokenExpired: boolean;
  repositoryFullName?: string;
  developBranch?: string;
  productionBranch?: string;
}

export type GithubSyncDirection = "totalum_to_github" | "github_to_totalum";

export interface GithubConnectResult {
  connected: boolean;
  repositoryFullName: string;
  syncAction: "push_new" | "push" | "pull" | "merge_and_push" | "already_synced";
  repoHasContent: boolean;
  requiresRebuild: boolean;
}

export interface GithubPullResult {
  status: "pulling" | "no_changes";
  message: string;
  filesUpdated: number;
}

export interface GithubPullStatus {
  status: "pulling" | "success" | "error" | null;
  createdAt?: string;
}

export interface GithubEnv {
  envDev: string;
  envProd: string;
}
