import React from 'react';
import {
  Boxes,
  Shield,
  Layers,
  Database,
  Lock,
} from 'lucide-react';

export const McpInspectorModal: React.FC = () => {
  const servedTools = [
    {
      name: 'get_status',
      desc: 'Retrieve real-time health, code, latency, and uptime % for all or single project',
      sideEffects: false,
      requiresConfirm: false,
      schema: '{ projectId?: string }',
    },
    {
      name: 'get_logs',
      desc: 'Retrieve last N lines or keyword RAG spans from logs/<id>.log with secret masking',
      sideEffects: false,
      requiresConfirm: false,
      schema: '{ projectId: string, lines?: number, query?: string }',
    },
    {
      name: 'check_port',
      desc: 'Inspect port binding availability and owner PID',
      sideEffects: false,
      requiresConfirm: false,
      schema: '{ port: number }',
    },
    {
      name: 'restart_project',
      desc: 'Trigger graceful SIGTERM, 5s warmup delay, supervisor spawn, and triple health gate',
      sideEffects: true,
      requiresConfirm: true,
      schema: '{ projectId: string }',
    },
    {
      name: 'deploy_project',
      desc: 'Git fetch, checkout sha, npm install, build, pre-deploy verify, and health probe',
      sideEffects: true,
      requiresConfirm: true,
      schema: '{ projectId: string, sha?: string }',
    },
    {
      name: 'run_safe_command',
      desc: 'Run allowlisted tool (npm/git/df/free/ps) in project cwd jail with 30s timeout & 100KB cap',
      sideEffects: true,
      requiresConfirm: true,
      schema: '{ projectId: string, cmd: string, args?: string[] }',
    },
  ];

  const consumedMcpServers = [
    { name: 'GitHub MCP', purpose: 'Commit history, diff inspection, and deploy metadata lookup', status: 'Phase 5 Ready' },
    { name: 'Sentry MCP', purpose: 'Incident stack trace enrichment (replaces guessing from log tails)', status: 'Integrated Pattern' },
    { name: 'Context7 MCP', purpose: 'Fresh library documentation grounding for dependency error triage', status: 'Pattern Borrowed' },
    { name: 'SQLite MCP', purpose: 'High-throughput historical check query engine (>50k checks)', status: 'Planned v2' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-4 rounded-xl border border-current/15 bg-current/5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
            <Boxes className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <span>Model Context Protocol (MCP) Tools Registry</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
              GET /api/mcp/manifest
            </span>
          </h2>
        </div>
        <p className="text-xs opacity-75">
          Exposes server-dashboard as standard Model Context Protocol tools. External Claude, Codex,
          and LLM agents can query telemetry and execute audited recovery tools without raw terminal RCE risk.
        </p>
      </div>

      {/* Two columns: Served Tools vs Consumed Integrations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Served Tools (6 tools) */}
        <div className="lg:col-span-7 space-y-3 font-sans">
          <div className="flex items-center justify-between font-mono text-xs opacity-75">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Served Dashboard MCP Tools ({servedTools.length})</span>
            </span>
            <span>Auth Bearer Required</span>
          </div>

          <div className="space-y-3">
            {servedTools.map((t) => (
              <div
                key={t.name}
                className="p-3.5 rounded-xl border border-current/15 bg-current/5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-xs text-cyan-400">
                    tool: {t.name}()
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    {t.sideEffects ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Side Effects
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        Read Only
                      </span>
                    )}

                    {t.requiresConfirm && (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400">
                        Confirm Token
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs opacity-80 leading-relaxed">{t.desc}</p>
                <div className="p-1.5 rounded bg-black/40 border border-current/10 font-mono text-[11px] text-slate-300">
                  schema: {t.schema}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Consumed External Integrations */}
        <div className="lg:col-span-5 space-y-3 font-sans">
          <div className="font-mono text-xs opacity-75 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-violet-400" />
            <span className="font-bold uppercase tracking-wider">
              Consumed External MCP Clients
            </span>
          </div>

          <div className="space-y-3">
            {consumedMcpServers.map((s) => (
              <div
                key={s.name}
                className="p-4 rounded-xl border border-current/15 bg-current/5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs">{s.name}</h4>
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-300">
                    {s.status}
                  </span>
                </div>
                <p className="text-xs opacity-75 leading-relaxed">{s.purpose}</p>
              </div>
            ))}
          </div>

          {/* Letta Persistent Memory Pattern */}
          <div className="p-4 rounded-xl border border-current/15 bg-current/5 space-y-2 font-mono text-xs">
            <div className="flex items-center gap-1.5 font-bold text-amber-400">
              <Database className="w-4 h-4" />
              <span>Persistent Incident Memory (memory/*.json)</span>
            </div>
            <p className="text-xs font-sans opacity-80 leading-relaxed">
              Borrowed from Letta/MemGPT pattern: diagnoses continuously learn from past incidents.
              When an incident is resolved with notes, the fix signature is persisted to JSON and injected into future AI diagnoses.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
