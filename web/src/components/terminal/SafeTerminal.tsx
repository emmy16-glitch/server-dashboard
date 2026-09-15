import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import {
  Terminal as TerminalIcon,
  Shield,
  ShieldAlert,
  CornerDownLeft,
  Trash2,
  Copy,
  Info,
  Check,
} from 'lucide-react';

interface SafeTerminalProps {
  initialProject?: Project;
}

export const SafeTerminal: React.FC<SafeTerminalProps> = ({ initialProject }) => {
  const { projects, executeTerminal, isReadOnlyMode, playHapticAudio } = useDashboard();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProject?.id || projects.find((p) => p.location.type === 'local')?.id || projects[0]?.id
  );
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [showAdminConfirm, setShowAdminConfirm] = useState<boolean>(false);
  const [adminConfirmText, setAdminConfirmText] = useState<string>('');

  const [history, setHistory] = useState<
    { id: string; command: string; output: string; error?: string; ts: string; isAdmin?: boolean }[]
  >([
    {
      id: 'init-1',
      command: 'pwd',
      output: '/root/Software_projects/echoo/backend',
      ts: '10:30:00',
    },
    {
      id: 'init-2',
      command: 'npm run build',
      output: '> tsc -p tsconfig.json\n✨ Compiled 42 TypeScript files in 1.48s\nBuild output verified: dist/server.js',
      ts: '10:30:14',
    },
  ]);

  const [inputVal, setInputVal] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeProj = projects.find((p) => p.id === selectedProjectId) || projects[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleRunCommand = async (cmdToRun?: string) => {
    const rawCmd = (cmdToRun || inputVal).trim();
    if (!rawCmd || isRunning) return;

    if (isReadOnlyMode) {
      setHistory((prev) => [
        ...prev,
        {
          id: `cmd-${Date.now()}`,
          command: rawCmd,
          output: '',
          error: '403 FORBIDDEN: Dashboard is running under read-only share token.',
          ts: new Date().toLocaleTimeString(),
        },
      ]);
      setInputVal('');
      return;
    }

    setIsRunning(true);
    setInputVal('');

    const res = await executeTerminal(selectedProjectId, rawCmd, isAdminMode);

    setHistory((prev) => [
      ...prev,
      {
        id: `cmd-${Date.now()}`,
        command: rawCmd,
        output: res.stdout,
        error: res.stderr || (res.exitCode !== 0 ? `Process exited with code ${res.exitCode}` : undefined),
        ts: new Date().toLocaleTimeString(),
        isAdmin: isAdminMode,
      },
    ]);

    setIsRunning(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClear = () => {
    playHapticAudio('click');
    setHistory([]);
  };

  const copyTranscript = () => {
    playHapticAudio('click');
    const text = history
      .map((h) => `$ [${h.ts}] ${h.command}\n${h.output || h.error}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const enableAdmin = () => {
    if (adminConfirmText.toLowerCase() === 'grant') {
      setIsAdminMode(true);
      setShowAdminConfirm(false);
      setAdminConfirmText('');
      playHapticAudio('alarm');
    }
  };

  const quickCommands = [
    { label: 'npm run build', cmd: 'npm run build' },
    { label: 'git status', cmd: 'git status' },
    { label: 'git log', cmd: 'git log' },
    { label: 'df -h (disk)', cmd: 'df -h' },
    { label: 'free -m (RAM)', cmd: 'free -m' },
    { label: 'ps aux | grep node', cmd: 'ps aux | grep node' },
    { label: 'pwd', cmd: 'pwd' },
  ];

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Top Banner / Scoped Jail Control */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg border border-current/10 bg-current/5 font-mono text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <TerminalIcon className="w-4 h-4 text-emerald-400" />
          <span className="font-bold">Scoped Shell</span>
          <span className="opacity-50">|</span>
          <span className="opacity-70">Target:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-black/20 dark:bg-white/10 border border-current/20 rounded px-2 py-0.5 text-xs font-mono cursor-pointer"
          >
            {projects
              .filter((p) => p.location.type === 'local')
              .map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                  {p.name} ({p.id})
                </option>
              ))}
          </select>
          <span className="opacity-60 text-[11px] truncate max-w-xs">
            jail: {activeProj?.location?.cwd || '/root/projects'}
          </span>
        </div>

        {/* Safe Mode vs Admin Mode Toggle */}
        <div className="flex items-center gap-2">
          {isAdminMode ? (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
              <span className="font-bold uppercase tracking-wider text-[10px]">ADMIN MODE (AUDITED)</span>
              <button
                onClick={() => setIsAdminMode(false)}
                className="ml-1 text-[10px] underline hover:text-white"
              >
                Exit
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAdminConfirm(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all text-[11px]"
              title="Safe Mode: Allowlisted commands only. Click to request Admin shell."
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Safe Mode (Active)</span>
            </button>
          )}

          <button
            onClick={copyTranscript}
            className="p-1 px-2 rounded border border-current/20 hover:bg-current/10 transition-colors text-[11px] flex items-center gap-1"
            title="Copy Terminal History"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={handleClear}
            className="p-1 px-2 rounded border border-current/20 hover:bg-current/10 transition-colors text-[11px] flex items-center gap-1"
            title="Clear Screen"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Quick Command Action Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono no-scrollbar">
        <span className="opacity-50 text-[11px] whitespace-nowrap">Allowlist:</span>
        {quickCommands.map((q) => (
          <button
            key={q.cmd}
            onClick={() => handleRunCommand(q.cmd)}
            disabled={isRunning || isReadOnlyMode}
            className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 whitespace-nowrap border border-current/10 transition-all text-[11px]"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Terminal Screen Window */}
      <div className="rounded-lg border border-emerald-500/30 bg-[#070A08] text-[#33FF55] font-mono shadow-2xl overflow-hidden flex flex-col h-[520px]">
        {/* CRT Window Header Bar */}
        <div className="bg-[#0D140D] border-b border-emerald-900/60 px-4 py-2 flex items-center justify-between text-xs text-emerald-400/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-bold">
              termux@{activeProj.id}:{activeProj.location.cwd || '.'}
            </span>
          </div>
          <div className="text-[11px] opacity-60">
            {isAdminMode ? 'Mode: ADMIN (free exec)' : 'Mode: SAFE (allowlist: 14 tools)'}
          </div>
        </div>

        {/* Output Stream Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-3 text-xs leading-relaxed selection:bg-emerald-500/30">
          <div className="text-emerald-500/70 text-[11px] border-b border-emerald-950 pb-2 space-y-0.5">
            <div>server-dashboard Scoped Shell v1.0.0 [Proot Ubuntu on Termux]</div>
            <div>spawn(cmd, args, &#123; cwd: '{activeProj.location.cwd}', shell: false &#125;)</div>
            <div>Append-only audit logging enabled to audit.json. 30s execution cap.</div>
          </div>

          {history.map((h) => (
            <div key={h.id} className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <span className="text-emerald-600">[{h.ts}]</span>
                <span className="text-cyan-400">root@pixel-server:{activeProj.id}$</span>
                <span className="text-white">{h.command}</span>
                {h.isAdmin && (
                  <span className="text-[9px] px-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    ADMIN
                  </span>
                )}
              </div>

              {h.output && (
                <pre className="whitespace-pre-wrap text-emerald-300/90 pl-4 border-l border-emerald-900/50 font-mono text-xs">
                  {h.output}
                </pre>
              )}

              {h.error && (
                <pre className="whitespace-pre-wrap text-rose-400 pl-4 border-l border-rose-900/60 font-mono text-xs">
                  {h.error}
                </pre>
              )}
            </div>
          ))}

          {isRunning && (
            <div className="flex items-center gap-2 text-amber-400 pl-4">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Executing in isolated cwd jail...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input Bar */}
        <div className="bg-[#091009] border-t border-emerald-900/60 p-3 flex items-center gap-2">
          <span className="text-emerald-400 font-bold flex-shrink-0">
            root@pixel-server:{activeProj.id}$
          </span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRunCommand();
            }}
            placeholder={
              isReadOnlyMode
                ? 'Terminal locked in read-only share mode...'
                : 'Type command (e.g. npm run build, df -h, git log)...'
            }
            disabled={isReadOnlyMode || isRunning}
            className="flex-1 bg-transparent text-emerald-300 placeholder-emerald-800 focus:outline-none font-mono text-xs"
          />
          <button
            onClick={() => handleRunCommand()}
            disabled={isRunning || !inputVal.trim() || isReadOnlyMode}
            className="px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-40"
          >
            <span>Run</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Admin Mode Modal Confirmation */}
      {showAdminConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border-2 border-rose-500 text-slate-100 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 font-sans">
            <div className="flex items-center gap-3 text-rose-500">
              <ShieldAlert className="w-7 h-7 flex-shrink-0" />
              <h3 className="font-bold text-lg">Admin Shell Elevation</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Per <code className="bg-slate-800 px-1 py-0.5 rounded text-cyan-300">docs/security.md</code>,
              Admin mode bypasses safe command allowlists and permits arbitrary shell execution.
              Every keystroke and argument is cryptographically hashed and appended to{' '}
              <code className="text-amber-400">audit.json</code>.
            </p>

            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2">
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Type "GRANT" below to authorize elevated command execution for this session.</span>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="Type GRANT to confirm..."
                value={adminConfirmText}
                onChange={(e) => setAdminConfirmText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 px-3 py-2 rounded text-xs font-mono uppercase text-slate-100 focus:border-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowAdminConfirm(false);
                  setAdminConfirmText('');
                }}
                className="px-3 py-1.5 rounded border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={enableAdmin}
                disabled={adminConfirmText.toLowerCase() !== 'grant'}
                className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs disabled:opacity-40 transition-all"
              >
                Elevate to Admin
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
