import React from 'react';
import { Project } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import { getThemeClasses } from '../../utils/themeStyles';
import { timeAgo } from '../../utils/time';
import {
  Play,
  Square,
  RotateCw,
  Terminal,
  FileText,
  Sparkles,
  GitCommit,
  ExternalLink,
  Cpu,
  HardDrive,
  Clock,
  Activity,
  AlertOctagon,
  Globe,
  Radio,
} from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onOpenDetails: (project: Project, tab?: string) => void;
  onOpenAi: (project: Project) => void;
  onOpenTerminal: (project: Project) => void;
  onOpenDeploy: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpenDetails,
  onOpenAi,
  onOpenTerminal,
  onOpenDeploy,
}) => {
  const {
    design,
    startProject,
    stopProject,
    restartProject,
    runHealthCheck,
    isReadOnlyMode,
  } = useDashboard();

  const theme = getThemeClasses(design);
  const isLocal = project.location.type === 'local';
  const isStarting = project.status === 'STARTING';
  const statusLabel =
    project.status === 'UP' ? 'Up'
    : project.status === 'DEGRADED' ? 'Needs attention'
    : project.status === 'DOWN' ? 'Down'
    : project.status === 'STOPPED' ? 'Stopped' : 'Starting';
  const providerLabel =
    project.location.provider === 'vercel' ? 'Vercel'
    : project.location.provider === 'railway' ? 'Railway'
    : project.location.provider === 'render' ? 'Render'
    : project.location.provider === 'custom' ? 'Cloud'
    : project.location.provider || 'Cloud';

  // Status color helpers
  const getBadgeClass = () => {
    switch (project.status) {
      case 'UP':
        return theme.badgeUp;
      case 'DEGRADED':
        return theme.badgeDegraded;
      case 'DOWN':
        return theme.badgeDown;
      case 'STOPPED':
        return theme.badgeStopped;
      case 'STARTING':
        return 'bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse font-mono';
    }
  };

  // Kanji stamps for Japanese Minimal structure
  const getJapaneseStamp = () => {
    if (design.structure !== 'japanese minimal') return null;
    let kanji = '正常';
    let color = 'border-emerald-600/40 text-emerald-600 dark:text-emerald-400';
    if (project.status === 'DEGRADED') {
      kanji = '警告';
      color = 'border-amber-600/50 text-amber-600 dark:text-amber-400';
    } else if (project.status === 'DOWN') {
      kanji = '障害';
      color = 'border-rose-600/50 text-rose-600 dark:text-rose-400';
    } else if (project.status === 'STOPPED') {
      kanji = '休止';
      color = 'border-stone-500/40 text-stone-500';
    }
    return (
      <span className={`text-[10px] px-1 py-0.2 border ${color} font-mono tracking-widest`}>
        {kanji}
      </span>
    );
  };

  return (
    <div
      className={`${theme.card} relative flex flex-col justify-between overflow-hidden group`}
    >
      {/* Industrial knurled bolts / Swiss accent bar */}
      {design.material === 'industrial panel' && (
        <div className="absolute top-1 left-2 flex gap-1.5 opacity-40">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 border border-black" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 border border-black" />
        </div>
      )}

      {/* Top Header Section */}
      <div className={`p-4 ${theme.cardHeader}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${getBadgeClass()}`}>
                ● {statusLabel}
              </span>

              {getJapaneseStamp()}

              {/* Location Tag */}
              <span className="flex items-center gap-1 font-mono text-[11px] opacity-70">
                {isLocal ? (
                  <>
                    <Radio className="w-3 h-3 text-cyan-400" />
                    <span>Local · :{project.runtime.port}</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-3 h-3 text-violet-400" />
                    <span>{providerLabel}</span>
                  </>
                )}
              </span>
            </div>

            <h3
              onClick={() => onOpenDetails(project)}
              className="text-base font-bold tracking-tight truncate cursor-pointer hover:underline flex items-center gap-1.5"
            >
              <span>{project.name}</span>
              {project.hasIncident && (
                <span className="text-amber-500 animate-bounce" title="Active Incident Open">
                  <AlertOctagon className="w-4 h-4" />
                </span>
              )}
            </h3>

            {project.description && (
              <p className={`text-xs ${theme.subtext} line-clamp-1`}>{project.description}</p>
            )}
          </div>

          {/* Latency & Uptime summary pill */}
          <div className="text-right flex flex-col items-end">
            <div
              className={`font-mono font-bold text-sm ${
                project.currentLatency > 500
                  ? 'text-rose-500'
                  : project.currentLatency > 200
                  ? 'text-amber-500'
                  : 'text-emerald-500'
              }`}
            >
              {project.status === 'STOPPED' ? '---' : `${project.currentLatency}ms`}
            </div>
            <div className="text-[10px] font-mono opacity-60">
              24h: {project.uptime24h}%
            </div>
          </div>
        </div>

        {/* Path / Target URL line */}
        <div className="mt-2 text-[11px] font-mono opacity-65 truncate flex items-center gap-1">
          {isLocal ? (
            <span className="truncate">cwd: {project.location.cwd}</span>
          ) : (
            <a
              href={project.runtime.healthUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate hover:underline text-cyan-400 flex items-center gap-1"
            >
              <span>{project.runtime.healthUrl}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          )}
        </div>
      </div>

      {/* Middle Telemetry & Sparkline Section */}
      <div className="p-4 space-y-3 flex-grow">
        {/* Local Process Stats (if local) */}
        {isLocal && project.process && (
          <div className="grid grid-cols-3 gap-2 font-mono text-xs p-2 rounded bg-current/5 border border-current/10">
            <div>
              <span className="text-[10px] opacity-60 block flex items-center gap-1">
                <Cpu className="w-3 h-3 text-cyan-400" /> CPU
              </span>
              <span className="font-semibold">{(project.process?.cpuPct ?? 0).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-[10px] opacity-60 block flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-amber-400" /> RAM
              </span>
              <span className="font-semibold">{(project.process?.memMB ?? 0).toFixed(0)} MB</span>
            </div>
            <div>
              <span className="text-[10px] opacity-60 block flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" /> Restarts
              </span>
              <span
                className={`font-semibold ${
                  (project.process?.restarts ?? 0) > 0 ? 'text-amber-500 font-bold' : ''
                }`}
              >
                {project.process?.restarts ?? 0} / {project.runtime?.maxRestarts || 5}
              </span>
            </div>
          </div>
        )}

        {/* Git SHA & Commit */}
        {project.source && (
          <div className="flex items-center justify-between text-xs font-mono p-1.5 rounded bg-current/5 border border-current/10">
            <div className="flex items-center gap-1.5 truncate">
              <GitCommit className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <span className="font-bold underline text-cyan-400 cursor-pointer" onClick={() => onOpenDeploy(project)}>
                {project.source.currentSha}
              </span>
              <span className="opacity-60 truncate max-w-[160px]">
                {project.source.lastCommitMessage}
              </span>
            </div>
          </div>
        )}

        {/* Mini Health Check Sparkline / Latency Ticker */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono opacity-60">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" /> Health checks
            </span>
            <span>Checked {timeAgo(project.lastChecked)}</span>
          </div>
          <div className="flex items-end gap-1 h-6 pt-1">
            {(project.history ?? []).slice(-12).map((h, idx) => {
              const height = Math.min(100, Math.max(15, (h.latencyMs / 400) * 100));
              let barColor = 'bg-emerald-500';
              if (h.code >= 500 || h.error) barColor = 'bg-rose-500 animate-pulse';
              else if (h.latencyMs > 250) barColor = 'bg-amber-500';

              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col justify-end group/bar relative"
                  title={`${h.ts}: ${h.code} (${h.latencyMs}ms)${h.error ? ` - ${h.error}` : ''}`}
                >
                  <div
                    style={{ height: `${height}%` }}
                    className={`w-full rounded-t-xs transition-all ${barColor} opacity-85 hover:opacity-100`}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Action Command Bar */}
      <div className={`p-3 border-t ${theme.border} bg-current/5 flex items-center justify-between gap-1 flex-wrap`}>
        {/* Process Controls (Start/Stop/Restart) */}
        {isLocal ? (
          <div className="flex items-center gap-1">
            {project.status === 'STOPPED' ? (
              <button
                disabled={isReadOnlyMode || isStarting}
                onClick={() => startProject(project.id)}
                className={`p-1.5 px-2 text-xs flex items-center gap-1 ${theme.buttonPrimary}`}
                title="Start process (spawns with supervisor)"
              >
                <Play className="w-3 h-3" />
                <span className="text-[11px]">Start</span>
              </button>
            ) : (
              <>
                <button
                  disabled={isReadOnlyMode || isStarting}
                  onClick={() => restartProject(project.id)}
                  className={`p-1.5 px-2 text-xs flex items-center gap-1 ${theme.buttonSecondary}`}
                  title="Graceful SIGTERM -> 3s warmup -> spawn -> health gate"
                >
                  <RotateCw className={`w-3 h-3 ${isStarting ? 'animate-spin' : ''}`} />
                  <span className="text-[11px]">Restart</span>
                </button>
                <button
                  disabled={isReadOnlyMode || isStarting}
                  onClick={() => stopProject(project.id)}
                  className={`p-1.5 text-xs ${theme.buttonDanger}`}
                  title="Stop process (SIGTERM)"
                >
                  <Square className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              onClick={() => runHealthCheck(project.id)}
              className={`p-1.5 px-2 text-xs flex items-center gap-1 ${theme.buttonSecondary}`}
              title="Check the site right now"
            >
              <RotateCw className="w-3 h-3" />
              <span className="text-[11px]">Check</span>
            </button>
          </div>
        )}

        {/* Secondary Operational Tools */}
        <div className="flex items-center gap-1">
          {/* Logs */}
          <button
            onClick={() => onOpenDetails(project, 'logs')}
            className={`p-1.5 px-2 text-xs flex items-center gap-1 ${theme.buttonSecondary}`}
            title="Tail logs (with secret redaction & RAG)"
          >
            <FileText className="w-3 h-3" />
            <span className="hidden sm:inline text-[11px]">Logs</span>
          </button>

          {/* Terminal (local only) */}
          {isLocal && (
            <button
              onClick={() => onOpenTerminal(project)}
              className={`p-1.5 px-2 text-xs flex items-center gap-1 ${theme.buttonSecondary}`}
              title="Open safe scoped terminal in cwd jail"
            >
              <Terminal className="w-3 h-3" />
              <span className="hidden sm:inline text-[11px]">Term</span>
            </button>
          )}

          {/* Git Deploy */}
          {isLocal && project.source && (
            <button
              onClick={() => onOpenDeploy(project)}
              className={`p-1.5 px-2 text-xs flex items-center gap-1 ${theme.buttonSecondary}`}
              title="Git pipeline deploy / rollback"
            >
              <GitCommit className="w-3 h-3 text-cyan-400" />
              <span className="hidden sm:inline text-[11px]">Deploy</span>
            </button>
          )}

          {/* AI Ops Doctor */}
          <button
            onClick={() => onOpenAi(project)}
            className={`p-1.5 px-2 text-xs flex items-center gap-1 font-semibold rounded ${
              project.status === 'DEGRADED'
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 animate-pulse'
                : theme.buttonSecondary
            }`}
            title="Ask AI Diagnosis (Explain -> Propose -> Execute)"
          >
            <Sparkles className="w-3 h-3 text-amber-500 dark:text-amber-300" />
            <span className="text-[11px]">AI</span>
          </button>
        </div>
      </div>
    </div>
  );
};
