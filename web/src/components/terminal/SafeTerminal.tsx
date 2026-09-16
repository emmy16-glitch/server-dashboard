import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import {
  Terminal as TerminalIcon,
  CornerDownLeft,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';

interface SafeTerminalProps {
  initialProject?: Project;
}

const TRY_COMMANDS = [
  'pwd',
  'ls',
  'git status',
  'node --version',
  'df -h',
  'free -m',
  'uptime',
];

export const SafeTerminal: React.FC<SafeTerminalProps> = ({ initialProject }) => {
  const { projects, executeTerminal, isReadOnlyMode, playHapticAudio } = useDashboard();

  const localProjects = projects.filter((p) => p.location.type === 'local');
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProject?.id || '');
  const BOX = '__box__';

  const [history, setHistory] = useState<
    { id: string; command: string; output: string; error?: string; ts: string }[]
  >([]);
  const [inputVal, setInputVal] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeProj = projects.find((p) => p.id === selectedProjectId);
  const isBox = !selectedProjectId || !activeProj;
  const execId = isBox ? '' : selectedProjectId;
  const windowTitle = isBox ? 'This box' : activeProj?.name || 'terminal';
  const folderLabel = isBox ? 'home folder' : activeProj?.location?.cwd || '';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const handleRunCommand = async (cmdToRun?: string) => {
    const rawCmd = (cmdToRun || inputVal).trim();
    if (!rawCmd || isRunning) return;

    if (isReadOnlyMode) {
      setHistory((prev) => [
        ...prev,
        { id: `cmd-${Date.now()}`, command: rawCmd, output: '', error: 'Read-only mode is on.', ts: new Date().toLocaleTimeString() },
      ]);
      setInputVal('');
      return;
    }

    setIsRunning(true);
    setInputVal('');

    const res = await executeTerminal(execId, rawCmd, false);

    setHistory((prev) => [
      ...prev,
      {
        id: `cmd-${Date.now()}`,
        command: rawCmd,
        output: res.stdout,
        error: res.stderr || (res.exitCode !== 0 ? `Exited with code ${res.exitCode}` : undefined),
        ts: new Date().toLocaleTimeString(),
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
    const text = history.map((h) => `$ ${h.command}\n${h.output || h.error}`).join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Where: this box or an app folder */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-lg border border-current/10 bg-current/5 text-xs">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <TerminalIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <select
            value={isBox ? BOX : selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value === BOX ? '' : e.target.value);
              setHistory([]);
            }}
            className="bg-black/20 dark:bg-white/10 border border-current/20 rounded px-2 py-1 cursor-pointer max-w-[50vw]"
          >
            <option value={BOX} className="bg-slate-900 text-slate-100">
              This box
            </option>
            {localProjects.map((p) => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100">
                {p.name}
              </option>
            ))}
          </select>
          <span className="opacity-60 font-mono text-[11px] truncate">
            {folderLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyTranscript}
            className="p-1 px-2 rounded border border-current/20 hover:bg-current/10 transition-colors text-[11px] flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          <button
            onClick={handleClear}
            className="p-1 px-2 rounded border border-current/20 hover:bg-current/10 transition-colors text-[11px] flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      {/* Try chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono no-scrollbar">
        <span className="opacity-50 text-[11px] whitespace-nowrap">Try:</span>
        {TRY_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            onClick={() => handleRunCommand(cmd)}
            disabled={isRunning || isReadOnlyMode}
            className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 whitespace-nowrap border border-current/10 transition-all text-[11px]"
          >
            {cmd}
          </button>
        ))}
      </div>
      <p className="text-[11px] font-mono opacity-60">
        Tip: <span className="text-cyan-400">ai ask &lt;service&gt; &lt;question&gt;</span> diagnoses a service here ·{' '}
        <span className="text-cyan-400">ai fix &lt;service&gt;</span> tries a safe fix.
      </p>

      {/* Terminal window */}
      <div className="rounded-lg border border-emerald-500/30 bg-[#070A08] text-[#33FF55] font-mono shadow-2xl overflow-hidden flex flex-col h-[520px]">
        <div className="bg-[#0D140D] border-b border-emerald-900/60 px-4 py-2 flex items-center gap-2 text-xs text-emerald-400/80">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
          <span className="ml-2 font-bold truncate">
            {windowTitle}
          </span>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-3 text-xs leading-relaxed selection:bg-emerald-500/30">
          {history.length === 0 && !isRunning && (
            <div className="opacity-50 text-[11px]">
              {isBox
                ? 'This is your machine. Pull a repo, check files, ask the AI — e.g. git clone <url>.'
                : `Connected to ${activeProj?.name}. Commands run in its folder.`}
            </div>
          )}

          {history.map((h) => (
            <div key={h.id} className="space-y-1">
              <div className="flex items-center gap-2 font-bold flex-wrap">
                <span className="text-cyan-400">$</span>
                <span className="text-white break-all">{h.command}</span>
              </div>
              {h.output && (
                <pre className="whitespace-pre-wrap text-emerald-300/90 pl-4 border-l border-emerald-900/50 text-xs">
                  {h.output}
                </pre>
              )}
              {h.error && (
                <pre className="whitespace-pre-wrap text-rose-400 pl-4 border-l border-rose-900/60 text-xs">
                  {h.error}
                </pre>
              )}
            </div>
          ))}

          {isRunning && (
            <div className="flex items-center gap-2 text-amber-400 pl-4">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Running...</span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="bg-[#091009] border-t border-emerald-900/60 p-3 flex items-center gap-2">
          <span className="text-emerald-400 font-bold flex-shrink-0">$</span>
          <input
            ref={inputRef}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRunCommand();
            }}
            placeholder={isReadOnlyMode ? 'Locked in read-only mode...' : 'Type a command...'}
            disabled={isReadOnlyMode || isRunning}
            enterKeyHint="send"
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
    </div>
  );
};
