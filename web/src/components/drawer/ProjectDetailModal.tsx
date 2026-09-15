import React, { useState } from 'react';
import { Project } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import { getThemeClasses } from '../../utils/themeStyles';
import { SafeTerminal } from '../terminal/SafeTerminal';
import { DeployPipelineModal } from '../deploys/DeployPipelineModal';
import { AiAssistantModal } from '../ai/AiAssistantModal';
import {
  X,
  Play,
  Square,
  RotateCw,
  Terminal,
  FileText,
  Sparkles,
  GitCommit,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  Shield,
  Search,
  Radio,
  Globe,
} from 'lucide-react';

interface ProjectDetailModalProps {
  project: Project;
  initialTab?: string;
  onClose: () => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  initialTab = 'logs',
  onClose,
}) => {
  const {
    design,
    logs,
    startProject,
    stopProject,
    restartProject,
    runHealthCheck,
    isReadOnlyMode,
    playHapticAudio,
  } = useDashboard();

  const theme = getThemeClasses(design);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [logSearch, setLogSearch] = useState<string>('');
  const [autoTail, setAutoTail] = useState<boolean>(true);

  const isLocal = project.location.type === 'local';
  const projectLogs = logs[project.id] || [];

  // Filter logs by search or keyword RAG
  const filteredLogs = projectLogs.filter((line) =>
    line.toLowerCase().includes(logSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div
        className={`${theme.modal} w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden border shadow-2xl`}
      >
        {/* Modal Top Bar */}
        <div className={`p-4 border-b ${theme.border} flex items-center justify-between gap-3 flex-shrink-0`}>
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase tracking-wider ${
                project.status === 'UP'
                  ? theme.badgeUp
                  : project.status === 'DEGRADED'
                  ? theme.badgeDegraded
                  : theme.badgeDown
              }`}
            >
              ● {project.status}
            </span>

            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight truncate flex items-center gap-2">
                <span>{project.name}</span>
                <span className="font-mono text-xs opacity-60 font-normal">({project.id})</span>
              </h2>
              <div className="text-xs font-mono opacity-65 flex items-center gap-2 truncate">
                {isLocal ? (
                  <>
                    <Radio className="w-3 h-3 text-cyan-400" />
                    <span>port :{project.runtime.port}</span>
                    <span>·</span>
                    <span>cwd: {project.location.cwd}</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3 text-violet-400" />
                    <span>{project.runtime.healthUrl}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Header Process Controls */}
          <div className="flex items-center gap-2">
            {isLocal ? (
              <div className="flex items-center gap-1.5">
                {project.status === 'STOPPED' ? (
                  <button
                    disabled={isReadOnlyMode}
                    onClick={() => startProject(project.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1 ${theme.buttonPrimary}`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Start</span>
                  </button>
                ) : (
                  <>
                    <button
                      disabled={isReadOnlyMode}
                      onClick={() => restartProject(project.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1 ${theme.buttonSecondary}`}
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Restart</span>
                    </button>
                    <button
                      disabled={isReadOnlyMode}
                      onClick={() => stopProject(project.id)}
                      className={`p-1.5 rounded ${theme.buttonDanger}`}
                      title="Stop process"
                    >
                      <Square className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => runHealthCheck(project.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1 ${theme.buttonSecondary}`}
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Ping Probe</span>
              </button>
            )}

            <button
              onClick={() => {
                playHapticAudio('click');
                onClose();
              }}
              className="p-1.5 rounded-lg opacity-60 hover:opacity-100 hover:bg-current/10 transition-colors ml-2"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className={`px-4 pt-2 border-b ${theme.border} flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0 text-xs font-mono`}>
          {[
            { id: 'logs', label: 'Live Logs & RAG', icon: FileText, count: projectLogs.length },
            { id: 'terminal', label: 'Safe Terminal', icon: Terminal, localOnly: true },
            { id: 'ai', label: 'AI Ops Doctor', icon: Sparkles },
            { id: 'deploys', label: 'Deploy & Rollback', icon: GitCommit, localOnly: true },
            { id: 'overview', label: 'Telemetry & Config', icon: Activity },
          ]
            .filter((t) => !t.localOnly || isLocal)
            .map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    playHapticAudio('toggle');
                    setActiveTab(tab.id);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium transition-all ${
                    isActive
                      ? 'border-cyan-400 text-cyan-400 font-bold'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && <span className="opacity-50">({tab.count})</span>}
                </button>
              );
            })}
        </div>

        {/* Modal Body / Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* TAB 1: LOGS & RAG RETRIEVAL */}
          {activeTab === 'logs' && (
            <div className="space-y-4 flex flex-col h-full font-mono text-xs">
              {/* Log Controls Header */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-black/20 dark:bg-white/5 border border-current/10">
                <div className="flex items-center gap-2 flex-1">
                  <Search className="w-4 h-4 opacity-50" />
                  <input
                    type="text"
                    placeholder="Search logs or keywords (e.g. 502, timeout, pg, EADDRINUSE)..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    className="w-full bg-transparent focus:outline-none placeholder-current/40 text-xs font-mono"
                  />
                  {logSearch && (
                    <button
                      onClick={() => setLogSearch('')}
                      className="text-[10px] opacity-60 hover:opacity-100"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoTail}
                      onChange={(e) => setAutoTail(e.target.checked)}
                      className="rounded bg-black/30 text-cyan-400 focus:ring-0"
                    />
                    <span className="opacity-75">Auto-follow</span>
                  </label>

                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Secrets Redacted
                  </span>
                </div>
              </div>

              {/* Terminal-style Log Viewer Container */}
              <div className="rounded-lg border border-current/15 bg-black/75 p-4 flex-1 min-h-[380px] max-h-[520px] overflow-y-auto space-y-1.5 leading-relaxed selection:bg-cyan-500/30">
                {filteredLogs.length === 0 ? (
                  <div className="text-center py-12 opacity-50">
                    No log lines matching "{logSearch}".
                  </div>
                ) : (
                  filteredLogs.map((line, idx) => {
                    let color = 'text-slate-300';
                    if (line.includes('[ERROR]') || line.includes('[FATAL]') || line.includes('502')) {
                      color = 'text-rose-400 font-bold bg-rose-500/10 px-1 rounded';
                    } else if (line.includes('[WARN]')) {
                      color = 'text-amber-300';
                    } else if (line.includes('[INFO]')) {
                      color = 'text-emerald-300/90';
                    } else if (line.includes('[DEBUG]')) {
                      color = 'text-cyan-300/70';
                    }

                    return (
                      <div key={idx} className={`font-mono text-xs whitespace-pre-wrap break-all ${color}`}>
                        {line}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TERMINAL */}
          {activeTab === 'terminal' && <SafeTerminal initialProject={project} />}

          {/* TAB 3: AI DIAGNOSIS */}
          {activeTab === 'ai' && <AiAssistantModal initialProject={project} />}

          {/* TAB 4: DEPLOYS */}
          {activeTab === 'deploys' && <DeployPipelineModal initialProject={project} />}

          {/* TAB 5: OVERVIEW & TELEMETRY */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-4xl mx-auto font-sans">
              {/* Telemetry Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
                <div className="p-3.5 rounded-lg border border-current/10 bg-current/5 space-y-1">
                  <span className="opacity-60 block flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" /> Current Latency
                  </span>
                  <span className="text-xl font-bold text-cyan-400">
                    {project.status === 'STOPPED' ? '---' : `${project.currentLatency}ms`}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg border border-current/10 bg-current/5 space-y-1">
                  <span className="opacity-60 block flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" /> 24h / 30d Uptime
                  </span>
                  <span className="text-xl font-bold text-emerald-400">
                    {project.uptime24h}%
                  </span>
                </div>

                <div className="p-3.5 rounded-lg border border-current/10 bg-current/5 space-y-1">
                  <span className="opacity-60 block flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-amber-400" /> CPU Allocation
                  </span>
                  <span className="text-xl font-bold">
                    {project.process ? `${project.process.cpuPct}%` : 'External'}
                  </span>
                </div>

                <div className="p-3.5 rounded-lg border border-current/10 bg-current/5 space-y-1">
                  <span className="opacity-60 block flex items-center gap-1">
                    <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Memory Resident
                  </span>
                  <span className="text-xl font-bold">
                    {project.process ? `${project.process.memMB} MB` : 'Cloud'}
                  </span>
                </div>
              </div>

              {/* Runtime & Health Configuration JSON */}
              <div className="p-4 rounded-xl border border-current/15 bg-current/5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-current/10 pb-2">
                  <span className="font-bold uppercase tracking-wider text-xs flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-cyan-400" />
                    <span>Registry Configuration (projects.json)</span>
                  </span>
                  <span className="text-[11px] opacity-60">Schema v1.0</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <div className="text-[11px] opacity-60">Health Monitor Target:</div>
                    <div className="p-2 rounded bg-black/30 dark:bg-white/5 border border-current/10 break-all text-cyan-400">
                      {project.runtime.healthUrl}
                    </div>

                    <div className="text-[11px] opacity-60 pt-1">Expected Status Codes:</div>
                    <div className="p-2 rounded bg-black/30 dark:bg-white/5 border border-current/10">
                      [{project.monitoring.expectedStatus.join(', ')}]
                    </div>

                    {project.monitoring.healthConfig && (
                      <>
                        <div className="text-[11px] opacity-60 pt-1">Expected JSON Body Assertion:</div>
                        <pre className="p-2 rounded bg-black/30 dark:bg-white/5 border border-current/10 text-amber-400">
                          {JSON.stringify(project.monitoring.healthConfig.json, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="text-[11px] opacity-60">Process Auto-Restart Policy:</div>
                    <div className="p-2.5 rounded bg-black/30 dark:bg-white/5 border border-current/10 space-y-1 leading-relaxed">
                      <div>Auto-Restart: {project.runtime.autoRestart ? 'ENABLED' : 'DISABLED'}</div>
                      <div>Max Retries: {project.runtime.maxRestarts || 5} per 15 minutes</div>
                      <div>Cooldown: {project.runtime.restartCooldownSec || 5}s</div>
                      <div>Start on Server Boot: {project.runtime.startOnBoot ? 'YES' : 'NO'}</div>
                      <div>Supervisor: Native Node child_process (No Docker)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
