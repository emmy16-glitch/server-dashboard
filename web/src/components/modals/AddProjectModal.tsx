import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { getThemeClasses } from '../../utils/themeStyles';
import {
  X,
  Globe,
  Radio,
  Plus,
  CheckCircle2,
} from 'lucide-react';

interface AddProjectModalProps {
  onClose: () => void;
}

export const AddProjectModal: React.FC<AddProjectModalProps> = ({ onClose }) => {
  const { design, addNewProject, templates, playHapticAudio } = useDashboard();
  const theme = getThemeClasses(design);

  const [type, setType] = useState<'local' | 'external'>('local');
  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [port, setPort] = useState<number>(3000);
  const [healthUrl, setHealthUrl] = useState<string>('http://localhost:3000/health');
  const [cwd, setCwd] = useState<string>('/root/Software_projects/');
  const [command, setCommand] = useState<string>('npm');
  const [argsStr, setArgsStr] = useState<string>('run start');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('node-api');

  const handleTemplateSelect = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    setSelectedTemplate(tplId);
    if (tpl.id === 'vercel-external') {
      setType('external');
      setHealthUrl('https://my-app.vercel.app');
    } else {
      setType('local');
      setPort(tpl.defaultPort);
      setHealthUrl(`http://localhost:${tpl.defaultPort}${tpl.healthPath}`);
      setCommand(tpl.command);
      setArgsStr(tpl.args.join(' '));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    playHapticAudio('deploy');

    addNewProject({
      name,
      description,
      template: selectedTemplate,
      location: {
        type,
        agentId: 'local',
        cwd: type === 'local' ? cwd : undefined,
        provider: type === 'external' ? 'vercel' : undefined,
      },
      runtime: {
        command: type === 'local' ? command : undefined,
        args: type === 'local' ? argsStr.split(' ').filter(Boolean) : undefined,
        port: type === 'local' ? Number(port) : undefined,
        healthUrl,
        autoRestart: type === 'local',
      },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className={`${theme.modal} w-full max-w-lg p-6 space-y-5 border shadow-2xl font-sans`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-current/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Register Monitored Service</h3>
              <p className="text-xs opacity-65 font-mono">Appends entry to projects.json</p>
            </div>
          </div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          {/* Quick Template Picker */}
          <div className="space-y-1">
            <label className="text-[11px] opacity-70">Starter Template:</label>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full p-2 rounded bg-black/20 dark:bg-white/5 border border-current/20 focus:outline-none"
            >
              <option value="node-api">Node.js API (Express/NestJS) - Local</option>
              <option value="fastapi">FastAPI / Python Uvicorn - Local</option>
              <option value="nextjs">Next.js SSR - Local</option>
              <option value="open-webui">Open WebUI LLM Interface - Local</option>
              <option value="vercel-external">Vercel Deployment - External Ping</option>
            </select>
          </div>

          {/* Type Toggle: Local vs External */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setType('local');
                setHealthUrl(`http://localhost:${port}/health`);
              }}
              className={`p-2.5 rounded border flex items-center justify-center gap-2 font-bold transition-all ${
                type === 'local'
                  ? 'border-cyan-400 bg-cyan-500/10 text-cyan-400'
                  : 'border-current/10 opacity-60 hover:opacity-100'
              }`}
            >
              <Radio className="w-4 h-4" />
              <span>Local Process</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setType('external');
                setHealthUrl('https://app.vercel.app');
              }}
              className={`p-2.5 rounded border flex items-center justify-center gap-2 font-bold transition-all ${
                type === 'external'
                  ? 'border-violet-400 bg-violet-500/10 text-violet-400'
                  : 'border-current/10 opacity-60 hover:opacity-100'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>External URL</span>
            </button>
          </div>

          {/* Service Name */}
          <div className="space-y-1 font-sans">
            <label className="text-xs font-mono opacity-70">Service Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ingestion Pipeline Worker"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (type === 'local' && cwd === '/root/Software_projects/') {
                  setCwd(`/root/Software_projects/${e.target.value.toLowerCase().replace(/\s+/g, '-')}`);
                }
              }}
              className={`w-full p-2 text-xs rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none focus:border-cyan-400 font-sans`}
            />
          </div>

          {/* Description */}
          <div className="space-y-1 font-sans">
            <label className="text-xs font-mono opacity-70">Description</label>
            <input
              type="text"
              placeholder="e.g. Core real-time socket processing daemon"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 text-xs rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none"
            />
          </div>

          {/* Local specific fields */}
          {type === 'local' ? (
            <div className="space-y-3 pt-1 border-t border-current/10">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] opacity-70">Port (1024-65535)</label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => {
                      setPort(Number(e.target.value));
                      setHealthUrl(`http://localhost:${e.target.value}/health`);
                    }}
                    className="w-full p-2 text-xs rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] opacity-70">Command</label>
                  <input
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="w-full p-2 text-xs rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] opacity-70">Working Directory (cwd jail)</label>
                <input
                  type="text"
                  value={cwd}
                  onChange={(e) => setCwd(e.target.value)}
                  className="w-full p-2 text-xs rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] opacity-70">Health Probe Target URL</label>
                <input
                  type="text"
                  value={healthUrl}
                  onChange={(e) => setHealthUrl(e.target.value)}
                  className="w-full p-2 text-xs rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none text-cyan-400"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1 pt-1 border-t border-current/10">
              <label className="text-[11px] opacity-70">External Ping Target URL *</label>
              <input
                type="text"
                required
                value={healthUrl}
                onChange={(e) => setHealthUrl(e.target.value)}
                placeholder="https://app.vercel.app or railway"
                className="w-full p-2 text-xs rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none text-violet-400"
              />
            </div>
          )}

          {/* Action Buttons */}
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
              className="px-4 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Register Service</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
