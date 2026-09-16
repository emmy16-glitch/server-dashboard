import React, { useState } from 'react';
import { Project, AiDiagnosis } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCw,
  Terminal,
  Brain,
  Send,
  Loader2,
} from 'lucide-react';

interface AiAssistantProps {
  initialProject?: Project;
}

export const AiAssistantModal: React.FC<AiAssistantProps> = ({ initialProject }) => {
  const {
    projects,
    askAiDiagnosis,
    executeAiFix,
    isReadOnlyMode,
    playHapticAudio,
  } = useDashboard();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProject?.id || projects.find((p) => p.status === 'DOWN' || p.status === 'DEGRADED')?.id || projects[0]?.id
  );

  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [diagnosis, setDiagnosis] = useState<AiDiagnosis | null>(null);
  const [executedTools, setExecutedTools] = useState<string[]>([]);
  const [isExecutingTool, setIsExecutingTool] = useState<boolean>(false);

  const activeProj = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const lockedProject = !!initialProject;

  const handleRunDiagnosis = async (questionText?: string) => {
    const q = questionText || customQuestion || `Why is ${activeProj.name} failing?`;
    setIsLoading(true);
    setDiagnosis(null);
    playHapticAudio('beep');

    const res = await askAiDiagnosis(selectedProjectId, q, 'opencode');
    setDiagnosis(res);
    setIsLoading(false);
  };

  const handleExecuteTool = async (tool: string, args: Record<string, any>) => {
    if (isReadOnlyMode) return;
    setIsExecutingTool(true);
    playHapticAudio('deploy');

    await executeAiFix(selectedProjectId, tool, args);
    setExecutedTools((prev) => [...prev, tool]);
    setIsExecutingTool(false);
  };

  // Preset diagnostic queries
  const presetQueries = [
    { label: 'Why is it failing?', text: `Why is ${activeProj.name} failing its health checks?` },
    { label: 'Safe to deploy?', text: `Is ${activeProj.name} safe to deploy right now?` },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Configuration Bar */}
      <div className="p-4 rounded-xl border border-current/15 bg-current/5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-tr from-amber-500 to-cyan-500 text-slate-950 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2 flex-wrap">
                <span>AI Doctor</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-normal">
                  live · {diagnosis?.provider === 'groq' ? 'Qwen' : 'OpenCode'}
                </span>
              </h2>
              <p className="text-xs opacity-75">
                Checks {activeProj.name}'s health and recent logs, then suggests a fix.
              </p>
            </div>
          </div>

          {/* Target Project Selector (only when opened standalone) */}
          {!lockedProject && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono opacity-70">Service:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setDiagnosis(null);
                }}
                className="bg-black/20 dark:bg-white/10 border border-current/20 rounded px-3 py-1.5 text-xs font-mono cursor-pointer"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                    {p.name} ({p.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Quick Query Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono no-scrollbar">
          {presetQueries.map((pq, idx) => (
            <button
              key={idx}
              onClick={() => {
                setCustomQuestion(pq.text);
                handleRunDiagnosis(pq.text);
              }}
              disabled={isLoading}
              className="px-2.5 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 whitespace-nowrap border border-current/10 transition-all text-[11px]"
            >
              {pq.label}
            </button>
          ))}
        </div>

        {/* Custom Prompt Input Bar */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={`Ask about ${activeProj.name}...`}
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRunDiagnosis();
            }}
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-xs rounded-lg bg-black/20 dark:bg-white/5 border border-current/20 focus:outline-none focus:border-cyan-400 font-mono"
          />
          <button
            onClick={() => handleRunDiagnosis()}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50 transition-all"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Ask</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Initial State / Empty Prompt */}
      {!diagnosis && !isLoading && (
        <div className="p-10 border border-dashed rounded-xl text-center space-y-3 opacity-80">
          <Brain className="w-10 h-10 mx-auto text-amber-500 animate-pulse" />
          <h3 className="font-bold text-sm">Not checked yet</h3>
          <p className="text-xs max-w-md mx-auto opacity-70">
            Takes about a minute — the AI reads {activeProj.name}'s live health and logs before answering.
          </p>
          <button
            onClick={() => handleRunDiagnosis()}
            className="px-4 py-2 rounded bg-amber-500 text-slate-950 font-bold text-xs"
          >
            Check {activeProj.name}
          </button>
        </div>
      )}

      {/* Structured Diagnosis Output Card */}
      {diagnosis && (
        <div className="rounded-xl border border-current/15 bg-current/5 p-5 space-y-6 animate-fadeIn font-sans">
          {/* Header Status & Confidence */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-current/10 pb-4">
            <div className="flex items-center gap-3">
              <span
                className={`px-2.5 py-1 rounded font-mono font-bold text-xs uppercase tracking-wider ${
                  diagnosis.severity === 'high'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {diagnosis.severity === 'high' ? 'Urgent' : diagnosis.severity === 'medium' ? 'Watch' : 'Fine'}
              </span>

              <span className="font-mono text-xs opacity-70">
                {(diagnosis.confidence * 100).toFixed(0)}% sure
              </span>

              {diagnosis.aiLive === false ? (
                <span
                  className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  title={diagnosis.aiError || 'AI unavailable'}
                >
                  offline summary{diagnosis.aiError ? ` (${diagnosis.aiError})` : ''}
                </span>
              ) : (
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  live answer
                </span>
              )}
            </div>

            <div className="text-xs font-mono opacity-60">{diagnosis.timestamp}</div>
          </div>

          {/* Likely Cause Callout */}
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider font-mono">
              <AlertTriangle className="w-4 h-4" />
              <span>Likely cause</span>
            </div>
            <p className="text-sm font-semibold leading-relaxed">{diagnosis.likelyCause}</p>
          </div>

          {/* Two-Column Grid: Evidence vs Recommended Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Gathered Evidence (Log RAG & Telemetry) */}
            <div className="space-y-3">
              <h4 className="font-mono text-xs uppercase tracking-wider font-bold opacity-75">
                What I saw
              </h4>
              <ul className="space-y-2">
                {diagnosis.evidence.map((ev, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded bg-black/20 dark:bg-white/5 border border-current/10 text-xs font-mono leading-relaxed"
                  >
                    {ev}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Remediation Proposals */}
            <div className="space-y-3">
              <h4 className="font-mono text-xs uppercase tracking-wider font-bold opacity-75">
                What to do
              </h4>
              <ul className="space-y-2">
                {diagnosis.recommendedActions.map((rec, idx) => (
                  <li
                    key={idx}
                    className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-xs leading-relaxed"
                  >
                    <span className="font-bold text-emerald-500 mr-2">{idx + 1}.</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tool Execution Section (Safe Tools) */}
          <div className="pt-4 border-t border-current/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="font-mono text-xs uppercase tracking-wider font-bold">
                  Fix it
                </h4>
                <p className="text-xs opacity-70">
                  Every fix is logged. Nothing runs without your tap.
                </p>
              </div>

              {isReadOnlyMode && (
                <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                  Read-only active
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {/* Tool 1: restart_project */}
              <button
                disabled={isReadOnlyMode || isExecutingTool || executedTools.includes('restart_project')}
                onClick={() => handleExecuteTool('restart_project', { id: selectedProjectId })}
                className={`px-3 py-2 rounded font-mono text-xs flex items-center gap-2 font-bold shadow-sm transition-all ${
                  executedTools.includes('restart_project')
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                }`}
              >
                {executedTools.includes('restart_project') ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Restarted</span>
                  </>
                ) : (
                  <>
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Restart service</span>
                  </>
                )}
              </button>

              {/* Tool 2: run_safe_command pre-deploy */}
              <button
                disabled={isReadOnlyMode || isExecutingTool || executedTools.includes('run_safe_command')}
                onClick={() => handleExecuteTool('run_safe_command', { cmd: 'npm run build' })}
                className={`px-3 py-2 rounded font-mono text-xs flex items-center gap-2 font-medium border border-current/20 hover:bg-current/10 transition-all ${
                  executedTools.includes('run_safe_command') ? 'opacity-50' : ''
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Run build check</span>
              </button>

              {/* Tool 3: deploy_project */}
              <button
                disabled={isReadOnlyMode || isExecutingTool || executedTools.includes('deploy_project')}
                onClick={() => handleExecuteTool('deploy_project', { id: selectedProjectId })}
                className={`px-3 py-2 rounded font-mono text-xs flex items-center gap-2 font-medium border border-current/20 hover:bg-current/10 transition-all ${
                  executedTools.includes('deploy_project') ? 'opacity-50' : ''
                }`}
              >
                <Play className="w-3.5 h-3.5 text-amber-400" />
                <span>Deploy latest</span>
              </button>
            </div>
          </div>

          {/* Raw LLM Diagnostics Output Inspector */}
          <div className="space-y-1 pt-2">
            <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">
              Full answer
            </span>
            <pre className="p-3 rounded bg-black/40 text-slate-300 font-mono text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
              {diagnosis.rawAnalysis}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
