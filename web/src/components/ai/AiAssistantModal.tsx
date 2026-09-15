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
  ShieldCheck,
  Send,
  Loader2,
  Database,
  Cpu,
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
    initialProject?.id || projects.find((p) => p.status === 'DEGRADED')?.id || projects[0]?.id
  );

  const [provider, setProvider] = useState<'claude' | 'opencode' | 'codex' | 'ollama'>('claude');
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [diagnosis, setDiagnosis] = useState<AiDiagnosis | null>(null);
  const [executedTools, setExecutedTools] = useState<string[]>([]);
  const [isExecutingTool, setIsExecutingTool] = useState<boolean>(false);

  const activeProj = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const handleRunDiagnosis = async (questionText?: string) => {
    const q = questionText || customQuestion || `Why is ${activeProj.name} reporting status ${activeProj.status}?`;
    setIsLoading(true);
    setDiagnosis(null);
    playHapticAudio('beep');

    const res = await askAiDiagnosis(selectedProjectId, q, provider);
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
    { label: 'Diagnose Degradation & 502', text: `Why did ${activeProj.name} return HTTP 502 / health check fail?` },
    { label: 'Check DB Connection Pool', text: `Check database connection pool metrics and worker latencies for ${activeProj.name}` },
    { label: 'Audit Memory & CPU Baseline', text: `Analyze process memory and CPU pressure on ${activeProj.name}` },
    { label: 'Verify Pre-Deploy Safety', text: `Is ${activeProj.name} safe to deploy without downtime?` },
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
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>AI Ops Diagnostic Engine</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                  Explain → Propose → Execute
                </span>
              </h2>
              <p className="text-xs opacity-75">
                Structured root-cause diagnosis from live `/proc` metrics, process memory, and tail logs.
              </p>
            </div>
          </div>

          {/* Target Project Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono opacity-70">Target:</span>
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
        </div>

        {/* AI Provider Switcher (Tier 1 Integration) */}
        <div className="pt-2 border-t border-current/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
            <span className="opacity-60 flex items-center gap-1">
              <Brain className="w-3.5 h-3.5 text-cyan-400" />
              <span>Provider:</span>
            </span>

            <button
              onClick={() => setProvider('claude')}
              className={`px-2.5 py-1 rounded transition-all ${
                provider === 'claude'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-current/10 hover:bg-current/15'
              }`}
            >
              Claude 3.7 Sonnet
            </button>

            <button
              onClick={() => setProvider('ollama')}
              className={`px-2.5 py-1 rounded transition-all flex items-center gap-1 ${
                provider === 'ollama'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-current/10 hover:bg-current/15'
              }`}
              title="Runs completely offline on local Termux box! (llama3.1:8b)"
            >
              <Cpu className="w-3 h-3" />
              <span>Ollama (Local Offline)</span>
            </button>

            <button
              onClick={() => setProvider('opencode')}
              className={`px-2.5 py-1 rounded transition-all ${
                provider === 'opencode'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-current/10 hover:bg-current/15'
              }`}
            >
              OpenCode CLI
            </button>

            <button
              onClick={() => setProvider('codex')}
              className={`px-2.5 py-1 rounded transition-all ${
                provider === 'codex'
                  ? 'bg-violet-500 text-white font-bold'
                  : 'bg-current/10 hover:bg-current/15'
              }`}
            >
              Codex (OpenAI)
            </button>
          </div>

          <div className="text-[11px] font-mono opacity-60">
            {provider === 'ollama' ? 'Model: llama3.1:8b @ localhost:11434' : 'Cloud Endpoint via Secure Proxy'}
          </div>
        </div>

        {/* Quick Query Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono no-scrollbar">
          <span className="opacity-50 text-[11px] whitespace-nowrap">Presets:</span>
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
            placeholder={`Ask diagnosis about ${activeProj.name} (e.g. why 502 on /health, check log line 10:30)...`}
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
                <span>Diagnosing...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Diagnose</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Initial State / Empty Prompt */}
      {!diagnosis && !isLoading && (
        <div className="p-10 border border-dashed rounded-xl text-center space-y-3 opacity-80">
          <Brain className="w-10 h-10 mx-auto text-amber-500 animate-pulse" />
          <h3 className="font-bold text-sm">No Diagnosis Ran Yet</h3>
          <p className="text-xs max-w-md mx-auto opacity-70">
            Click one of the presets above or type a custom question to inspect status, parse recent logs with RAG, and produce structured remediation commands.
          </p>
          <button
            onClick={() => handleRunDiagnosis()}
            className="px-4 py-2 rounded bg-amber-500 text-slate-950 font-bold text-xs"
          >
            Run Auto-Diagnosis on {activeProj.name}
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
                Severity: {diagnosis.severity}
              </span>

              <span className="font-mono text-xs opacity-70">
                Confidence: {(diagnosis.confidence * 100).toFixed(0)}%
              </span>

              <span className="font-mono text-xs opacity-60">Provider: {diagnosis.provider}</span>
            </div>

            <div className="text-xs font-mono opacity-60">Generated: {diagnosis.timestamp}</div>
          </div>

          {/* Likely Cause Callout */}
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs uppercase tracking-wider font-mono">
              <AlertTriangle className="w-4 h-4" />
              <span>Likely Root Cause</span>
            </div>
            <p className="text-sm font-semibold leading-relaxed">{diagnosis.likelyCause}</p>
          </div>

          {/* Two-Column Grid: Evidence vs Recommended Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Gathered Evidence (Log RAG & Telemetry) */}
            <div className="space-y-3">
              <h4 className="font-mono text-xs uppercase tracking-wider font-bold opacity-75 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Grounded Evidence Spans</span>
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
              <h4 className="font-mono text-xs uppercase tracking-wider font-bold opacity-75 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Proposed Action Plan</span>
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
                <h4 className="font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Execute Approved Remediation Tools</span>
                </h4>
                <p className="text-xs opacity-70">
                  AI tools operate strictly under scoped allowlists with audit logging. No raw arbitrary shell is permitted.
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
                    <span>restart_project (Executed)</span>
                  </>
                ) : (
                  <>
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Run Tool: restart_project()</span>
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
                <span>Run Tool: run_safe_command("npm run build")</span>
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
                <span>Run Tool: deploy_project()</span>
              </button>
            </div>
          </div>

          {/* Raw LLM Diagnostics Output Inspector */}
          <div className="space-y-1 pt-2">
            <span className="text-[10px] font-mono uppercase tracking-wider opacity-60">
              Raw Provider Output Stream
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
