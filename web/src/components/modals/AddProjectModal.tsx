import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { getThemeClasses } from '../../utils/themeStyles';
import {
  X,
  Globe,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../lib/api';

interface AddProjectModalProps {
  onClose: () => void;
  initialType?: 'local' | 'external';
}

function detectProvider(url: string): string | null {
  const u = url.toLowerCase();
  if (u.includes('vercel.app')) return 'Vercel';
  if (u.includes('railway.app')) return 'Railway';
  if (u.includes('onrender.com')) return 'Render';
  if (u.includes('netlify.app')) return 'Netlify';
  if (/^https?:\/\//.test(u)) return 'Website';
  return null;
}

export const AddProjectModal: React.FC<AddProjectModalProps> = ({ onClose, initialType = 'external' }) => {
  const { design, addNewProject, playHapticAudio } = useDashboard();
  const theme = getThemeClasses(design);

  const [type, setType] = useState<'local' | 'external'>(initialType);
  const [name, setName] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [port, setPort] = useState<number>(3000);
  const [command, setCommand] = useState<string>('npm run start');
  const [cwd, setCwd] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [detecting, setDetecting] = useState<boolean>(false);
  const [detected, setDetected] = useState<string>('');

  const provider = type === 'external' ? detectProvider(url) : null;

  const inspectFolder = async (folder: string) => {
    const f = folder.trim();
    if (!f) return;
    setDetecting(true);
    setDetected('');
    const res = await api.get<{
      ok: boolean; error?: string; folder?: string;
      detection?: { name: string; kind: string; description: string; command: string; args: string[]; port: number };
    }>(`/api/projects/inspect?path=${encodeURIComponent(f)}`);
    setDetecting(false);
    if (!res) {
      setDetected('Could not reach the server to look inside.');
      return;
    }
    if (!res.ok) {
      setDetected(
        res.error === 'not-found'
          ? 'No folder with that name on this machine — check the spelling.'
          : res.error === 'not-a-folder'
            ? 'That path is a file, not a folder.'
            : res.error === 'outside-roots'
              ? 'That folder is outside the areas this dashboard may use.'
              : 'Could not recognise the app type — fill the rest by hand.'
      );
      return;
    }
    const d = res.detection!;
    if (!name.trim() && d.name) setName(d.name);
    setCommand([d.command, ...d.args].join(' '));
    setPort(d.port);
    if (d.description && !note.trim()) setNote(d.description);
    setDetected(`Found: ${d.kind} · starts with "${[d.command, ...d.args].join(' ')}" · port ${d.port}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Give it a name first.');
      return;
    }
    if (type === 'external') {
      const clean = url.trim();
      if (!/^https?:\/\/.+\..+/.test(clean)) {
        setError('Paste the full link, starting with https://');
        return;
      }
      setSaving(true);
      playHapticAudio('deploy');
      const host = (() => { try { return new URL(clean).hostname; } catch { return ''; } })();
      const ok = await addNewProject({
        name: name.trim(),
        description: note.trim(),
        location: {
          type: 'external',
          agentId: 'local',
          provider: /vercel/i.test(host) ? 'vercel' : /railway/i.test(host) ? 'railway' : /onrender/i.test(host) ? 'render' : 'custom',
        },
        runtime: { healthUrl: clean },
      });
      if (!ok) {
        setSaving(false);
        setError('Could not save it — maybe that name is already added.');
        return;
      }
      onClose();
      return;
    }
    // local
    if (!cwd.trim()) {
      setError('Tell us which folder the app lives in.');
      return;
    }
    setSaving(true);
    playHapticAudio('deploy');
    const parts = command.trim().split(/\s+/).filter(Boolean);
    const ok = await addNewProject({
      name: name.trim(),
      description: note.trim(),
      location: { type: 'local', agentId: 'local', cwd: cwd.trim() },
      runtime: {
        command: parts[0] || 'npm',
        args: parts.slice(1),
        port: Number(port),
        healthUrl: `http://localhost:${Number(port)}/health`,
        autoRestart: true,
      },
    });
    if (!ok) {
      setSaving(false);
      setError('Could not save it — is the folder exact, and is the name already used?');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className={`${theme.modal} w-full max-w-lg p-6 space-y-5 border shadow-2xl font-sans max-h-[92vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-current/10 pb-3">
          <div>
            <h3 className="text-base font-bold">
              {type === 'local' ? 'Add an app on this box' : 'Watch a service'}
            </h3>
            <p className="text-xs opacity-65">
              {type === 'local'
                ? 'Runs here — health checks, restarts, and terminal open its folder.'
                : 'Already online? Paste the link — we check it every minute.'}
            </p>
          </div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Where does it run? */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('external')}
              className={`p-2.5 rounded border flex items-center justify-center gap-2 font-bold transition-all ${
                type === 'external'
                  ? 'border-violet-400 bg-violet-500/10 text-violet-400'
                  : 'border-current/10 opacity-60 hover:opacity-100'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>It's already online</span>
            </button>

            <button
              type="button"
              onClick={() => setType('local')}
              className={`p-2.5 rounded border flex items-center justify-center gap-2 font-bold transition-all ${
                type === 'local'
                  ? 'border-cyan-400 bg-cyan-500/10 text-cyan-400'
                  : 'border-current/10 opacity-60 hover:opacity-100'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Run it on this box</span>
            </button>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="opacity-70">Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. DigiNorth"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {type === 'external' ? (
            <div className="space-y-1">
              <label className="opacity-70">Website link *</label>
              <input
                type="url"
                required
                inputMode="url"
                placeholder="https://diginorth.net"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full p-2 rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none focus:border-violet-400 text-violet-300"
              />
              {provider && (
                <p className="text-[11px] opacity-60">Detected: {provider} · we only watch it, changes stay there.</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="opacity-70">App folder on this box *</label>
                <input
                  type="text"
                  placeholder="~/ai-cyber-autoposter"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  onBlur={(e) => inspectFolder(e.target.value)}
                  className="w-full p-2 rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none focus:border-cyan-400 font-mono"
                />
                {(detecting || detected) && (
                  <p className="text-[11px] opacity-70">
                    {detecting ? 'Looking inside...' : detected}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="opacity-70">Port</label>
                  <input
                    type="number"
                    min={1024}
                    max={65535}
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full p-2 rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="opacity-70">Start command</label>
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="npm run start"
                    className="w-full p-2 rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Optional note */}
          <div className="space-y-1">
            <label className="opacity-70">Note (optional)</label>
            <input
              type="text"
              placeholder="Anything to remember about it"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-2 rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-current/10">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-current/20 text-xs hover:bg-current/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : type === 'external' ? 'Start watching' : 'Save service'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
