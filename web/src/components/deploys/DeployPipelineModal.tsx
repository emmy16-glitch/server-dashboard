import React, { useState } from 'react';
import { Project } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import {
  GitCommit,
  RotateCcw,
  Play,
  Clock,
  Terminal,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface DeployPipelineProps {
  initialProject?: Project;
}

export const DeployPipelineModal: React.FC<DeployPipelineProps> = ({ initialProject }) => {
  const {
    projects,
    deployments,
    triggerDeploy,
    rollbackDeploy,
    isReadOnlyMode,
    playHapticAudio,
  } = useDashboard();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProject?.id || projects.find((p) => p.location.type === 'local' && p.source)?.id || 'echoo-backend'
  );
  const [customSha, setCustomSha] = useState<string>('');
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [expandedDepId, setExpandedDepId] = useState<string | null>(deployments[0]?.id || null);

  const activeProj = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const projectDeployments = deployments.filter((d) => d.projectId === selectedProjectId);

  const handleDeploy = async () => {
    if (isReadOnlyMode || isDeploying) return;
    setIsDeploying(true);
    playHapticAudio('deploy');
    await triggerDeploy(selectedProjectId, customSha || undefined);
    setCustomSha('');
    setIsDeploying(false);
  };

  const handleRollback = async (depId: string) => {
    if (isReadOnlyMode) return;
    playHapticAudio('alarm');
    await rollbackDeploy(selectedProjectId, depId);
  };

  const pipelineStages = [
    { name: '1. Git Fetch & Checkout', desc: 'Verify remote tree and branch sync' },
    { name: '2. Dependency Cache Install', desc: 'npm ci --prefer-offline in cwd' },
    { name: '3. Compilation & Build', desc: 'tsc -p tsconfig.json' },
    { name: '4. Pre-deploy Hook & Port Verification', desc: 'Verify port free & .env present' },
    { name: '5. Zero-Downtime Hot Restart', desc: 'Graceful child spawn + PID swap' },
    { name: '6. Triple Health Gate Probe', desc: '3 HTTP checks within 20s or auto-rollback' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Controller Header */}
      <div className="p-4 rounded-xl border border-current/15 bg-current/5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <GitCommit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Local Git Deploy Pipeline</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Zero-Downtime & Auto-Rollback Gate
                </span>
              </h2>
              <p className="text-xs opacity-75">
                Automated pull, compile, verification gate, and single-click safety rollback.
              </p>
            </div>
          </div>

          {/* Project selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono opacity-70">App:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-black/20 dark:bg-white/10 border border-current/20 rounded px-3 py-1.5 text-xs font-mono cursor-pointer"
            >
              {projects
                .filter((p) => p.location.type === 'local')
                .map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                    {p.name} ({p.source?.currentSha || 'no git'})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Source metadata & Trigger bar */}
        {activeProj?.source ? (
          <div className="pt-2 border-t border-current/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
              <span className="opacity-60">Repo:</span>
              <a
                href={`https://github.com/${activeProj.source.repository}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-cyan-400 flex items-center gap-1"
              >
                <span>{activeProj.source.repository}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="opacity-40">|</span>
              <span className="opacity-60">Branch:</span>
              <span className="font-bold text-cyan-400">{activeProj.source.branch}</span>
              <span className="opacity-40">|</span>
              <span className="opacity-60">Live SHA:</span>
              <span className="font-bold underline">{activeProj.source.currentSha}</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Custom SHA / tag (optional)..."
                value={customSha}
                onChange={(e) => setCustomSha(e.target.value)}
                disabled={isReadOnlyMode || isDeploying}
                className="px-3 py-1.5 text-xs font-mono rounded bg-black/20 dark:bg-white/10 border border-current/20 focus:outline-none focus:border-cyan-400 w-44"
              />
              <button
                onClick={handleDeploy}
                disabled={isReadOnlyMode || isDeploying}
                className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isDeploying ? 'Deploying Pipeline...' : 'Deploy Latest'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs font-mono opacity-70 p-2">
            This service has no git source configured in projects.json.
          </div>
        )}
      </div>

      {/* Visual Pipeline Progression Stages */}
      <div className="p-4 rounded-xl border border-current/10 bg-current/5 space-y-3 font-mono text-xs">
        <div className="text-[11px] uppercase tracking-wider font-bold opacity-60">
          Automated Verification Pipeline Sequence
        </div>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {pipelineStages.map((st, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded border transition-all ${
                isDeploying && idx === 2
                  ? 'border-amber-500 bg-amber-500/15 animate-pulse'
                  : 'border-current/10 bg-black/10 dark:bg-white/5'
              }`}
            >
              <div className="font-bold text-[11px] truncate">{st.name}</div>
              <div className="text-[9px] opacity-65 mt-1 line-clamp-2">{st.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Deployments History Table / Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="font-bold uppercase tracking-wider opacity-60">
            Deployment History ({projectDeployments.length})
          </span>
          <span className="opacity-50">Auto-rollback triggers if 3 checks fail</span>
        </div>

        <div className="space-y-3">
          {projectDeployments.map((dep) => {
            const isExpanded = expandedDepId === dep.id;
            return (
              <div
                key={dep.id}
                className="border border-current/15 rounded-lg bg-current/5 overflow-hidden transition-all font-sans"
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedDepId(isExpanded ? null : dep.id)}
                  className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-current/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                        dep.status === 'success'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : dep.status === 'rolled_back'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : dep.status === 'running'
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {dep.status}
                    </span>

                    <span className="font-mono font-bold text-xs underline text-cyan-400">
                      {dep.sha}
                    </span>

                    <span className="text-xs font-medium truncate max-w-md">
                      {dep.commitMessage}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono opacity-75">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{dep.startedAt}</span>
                    </span>

                    {dep.durationSec !== undefined && <span>({dep.durationSec}s)</span>}

                    {dep.status === 'success' && activeProj.source?.currentSha !== dep.sha && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRollback(dep.id);
                        }}
                        disabled={isReadOnlyMode}
                        className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-[11px] font-mono flex items-center gap-1"
                        title="Rollback live project to this deployment"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Rollback to this</span>
                      </button>
                    )}

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 opacity-60" />
                    ) : (
                      <ChevronDown className="w-4 h-4 opacity-60" />
                    )}
                  </div>
                </div>

                {/* Expanded Build Logs */}
                {isExpanded && (
                  <div className="border-t border-current/10 p-4 bg-black/40 font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-cyan-400/80">
                      <div className="flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5" />
                        <span>Build & Deployment Output Stream</span>
                      </div>
                      <span>Author: {dep.author}</span>
                    </div>

                    <pre className="p-3 rounded bg-black/60 border border-slate-800 text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-52">
                      {dep.buildTail.join('\n')}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
