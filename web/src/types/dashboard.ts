export type MaterialType = 'glass' | 'paper' | 'terminal' | 'industrial panel';
export type CompositionType = 'editorial' | 'asymmetric' | 'dense' | 'spacious';
export type StructureType = 'swiss' | 'brutalist' | 'financial' | 'japanese minimal';
export type FeelingType = 'tactical' | 'quiet' | 'precise' | 'playful';

export interface DesignState {
  material: MaterialType;
  composition: CompositionType;
  structure: StructureType;
  feeling: FeelingType;
  soundEnabled: boolean;
  scanlines: boolean;
}

export type ProjectStatus = 'UP' | 'DEGRADED' | 'DOWN' | 'STARTING' | 'STOPPED';

export interface ProjectLocation {
  type: 'local' | 'external';
  agentId: string;
  cwd?: string;
  provider?: 'vercel' | 'railway' | 'render' | 'custom';
}

export interface ProjectRuntime {
  command?: string;
  args?: string[];
  port?: number;
  healthUrl: string;
  autoRestart?: boolean;
  maxRestarts?: number;
  restartCooldownSec?: number;
  startOnBoot?: boolean;
  startupTimeoutSec?: number;
  envFile?: string;
}

export interface ProjectMonitoring {
  intervalSeconds: number;
  timeoutSeconds: number;
  expectedStatus: number[];
  expectedBody?: string | null;
  healthConfig?: {
    type: 'http' | 'tcp' | 'ssl' | 'disk' | 'mem' | 'body-json';
    json?: Record<string, string>;
  };
}

export interface ProjectSource {
  provider: 'github' | 'gitlab' | 'gitea';
  repository: string;
  branch: string;
  deployOnPush: boolean;
  currentSha: string;
  lastCommitMessage?: string;
}

export interface HealthCheckHistory {
  ts: string;
  code: number;
  latencyMs: number;
  error?: string | null;
}

export interface ProjectProcess {
  pid?: number;
  alive: boolean;
  cpuPct: number;
  memMB: number;
  uptimeSec: number;
  restarts: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  status: ProjectStatus;
  template?: string;
  location: ProjectLocation;
  runtime: ProjectRuntime;
  monitoring: ProjectMonitoring;
  source?: ProjectSource;
  process?: ProjectProcess;
  history: HealthCheckHistory[];
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
  currentLatency: number;
  lastChecked: string;
  hasIncident?: boolean;
  tags?: string[];
}

export interface LogLine {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

export interface Incident {
  id: string;
  projectId: string;
  projectName: string;
  startedAt: string;
  cause: string;
  state: 'open' | 'acknowledged' | 'resolved';
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
  nextRetryInSec?: number;
  resolvedAt?: string;
  notes?: string[];
  timeline: {
    ts: string;
    event: string;
    actor?: string;
  }[];
  alertChannels: {
    channel: 'telegram' | 'discord' | 'email' | 'webhook';
    sent: boolean;
    ts: string;
  }[];
}

export interface DeploymentRecord {
  id: string;
  projectId: string;
  sha: string;
  branch: string;
  startedAt: string;
  endedAt?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
  commitMessage: string;
  author: string;
  buildTail: string[];
  durationSec?: number;
}

export interface AiDiagnosis {
  id: string;
  projectId: string;
  timestamp: string;
  question: string;
  severity: 'high' | 'medium' | 'low';
  likelyCause: string;
  confidence: number;
  evidence: string[];
  recommendedActions: string[];
  commands: string[];
  safeToAutoFix: boolean;
  rawAnalysis: string;
  provider: 'opencode' | 'codex' | 'claude' | 'ollama';
}

export interface AuditRecord {
  id: string;
  ts: string;
  actor: string;
  projectId: string;
  action: 'process_restart' | 'process_start' | 'process_stop' | 'deploy' | 'rollback' | 'exec_command' | 'ai_fix_execute' | 'incident_ack' | 'incident_resolve';
  argsHash: string;
  details: string;
  result: 'success' | 'denied' | 'failed';
}

export interface AgentNode {
  id: string;
  hostname: string;
  platform: string;
  ip: string;
  status: 'connected' | 'offline';
  cpuPct: number;
  memUsedMB: number;
  memTotalMB: number;
  diskUsedGB: number;
  diskTotalGB: number;
  projectCount: number;
  version: string;
  isHost: boolean;
}

export interface TemplateItem {
  id: string;
  name: string;
  category: 'dev' | 'apps';
  description: string;
  detect: string[];
  defaultPort: number;
  healthPath: string;
  command: string;
  args: string[];
  notes?: string;
}
