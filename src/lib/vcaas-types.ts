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

export interface ConversationMessage {
  author: "user" | "agent";
  message: string;
  messageType: "regular" | "starting" | "building" | "finished" | "error" | "limit-reached";
  createdAt: string;
  versionId?: string;
  secretKeysNeeded?: Record<string, { isProvided: boolean; description: string }>;
  gitDiffUrl?: string;
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
