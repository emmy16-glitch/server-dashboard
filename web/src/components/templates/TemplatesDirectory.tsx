import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { TemplateItem } from '../../types/dashboard';
import {
  FolderGit2,
  ArrowRight,
  Search,
  Check,
} from 'lucide-react';

export const TemplatesDirectory: React.FC = () => {
  const { templates, addNewProject, playHapticAudio, isReadOnlyMode } = useDashboard();
  const [filterCategory, setFilterCategory] = useState<'all' | 'dev' | 'apps'>('all');
  const [search, setSearch] = useState<string>('');
  const [launchedId, setLaunchedId] = useState<string | null>(null);

  const filtered = templates.filter((t) => {
    const matchCat = filterCategory === 'all' || t.category === filterCategory;
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleLaunch = (tpl: TemplateItem) => {
    if (isReadOnlyMode) return;
    playHapticAudio('deploy');
    addNewProject({
      name: tpl.name,
      description: tpl.description,
      template: tpl.id,
      runtime: {
        command: tpl.command,
        args: tpl.args,
        port: tpl.defaultPort,
        healthUrl: `http://localhost:${tpl.defaultPort}${tpl.healthPath}`,
        autoRestart: true,
      },
    });

    setLaunchedId(tpl.id);
    setTimeout(() => setLaunchedId(null), 2500);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-4 rounded-xl border border-current/15 bg-current/5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <span>Templates & Autodetect Registry (17 Curated Profiles)</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Phase 3 Catalog
            </span>
          </h2>
        </div>
        <p className="text-xs opacity-75">
          Standardized blueprints for self-hosted apps and developer frameworks. Each blueprint defines
          detection files, port bindings, health endpoints, and zero-Docker supervisor scripts.
        </p>

        {/* Filters */}
        <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-current/10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                filterCategory === 'all'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-current/10 hover:bg-current/15'
              }`}
            >
              All Templates ({templates.length})
            </button>
            <button
              onClick={() => setFilterCategory('dev')}
              className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                filterCategory === 'dev'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-current/10 hover:bg-current/15'
              }`}
            >
              Dev Frameworks (8)
            </button>
            <button
              onClick={() => setFilterCategory('apps')}
              className={`px-3 py-1 rounded text-xs font-mono transition-all ${
                filterCategory === 'apps'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-current/10 hover:bg-current/15'
              }`}
            >
              Self-Hosted Apps (9)
            </button>
          </div>

          <div className="relative max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1 text-xs rounded bg-black/20 dark:bg-white/5 border border-current/20 focus:outline-none w-full font-mono"
            />
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((tpl) => (
          <div
            key={tpl.id}
            className="p-4 rounded-xl border border-current/15 bg-current/5 flex flex-col justify-between space-y-4 hover:border-current/30 transition-all font-sans group"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider bg-current/10 opacity-70">
                  {tpl.category}
                </span>
                <span className="font-mono text-xs opacity-60">port :{tpl.defaultPort}</span>
              </div>

              <h3 className="font-bold text-sm tracking-tight">{tpl.name}</h3>
              <p className="text-xs opacity-75 leading-relaxed">{tpl.description}</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-current/10 text-xs font-mono">
              <div className="flex items-center justify-between text-[11px] opacity-70">
                <span>Health check:</span>
                <span className="text-cyan-400 font-bold">{tpl.healthPath}</span>
              </div>

              {tpl.command && (
                <div className="p-1.5 rounded bg-black/30 dark:bg-white/5 border border-current/10 text-[10px] truncate text-slate-300">
                  $ {tpl.command} {tpl.args.join(' ')}
                </div>
              )}

              {tpl.notes && (
                <div className="text-[10px] text-amber-500/80 italic font-sans">{tpl.notes}</div>
              )}

              <button
                onClick={() => handleLaunch(tpl)}
                disabled={isReadOnlyMode}
                className="w-full mt-2 py-1.5 px-3 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-40"
              >
                {launchedId === tpl.id ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Added to Control Plane!</span>
                  </>
                ) : (
                  <>
                    <span>Register to Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
