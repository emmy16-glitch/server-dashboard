import React from 'react';
import { Project } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import { getThemeClasses } from '../../utils/themeStyles';
import { ProjectCard } from './ProjectCard';
import {
  Search,
  Filter,
  AlertTriangle,
  Heart,
} from 'lucide-react';

interface ProjectsGridProps {
  onOpenDetails: (project: Project, tab?: string) => void;
  onOpenAi: (project: Project) => void;
  onOpenTerminal: (project: Project) => void;
  onOpenDeploy: (project: Project) => void;
}

export const ProjectsGrid: React.FC<ProjectsGridProps> = ({
  onOpenDetails,
  onOpenAi,
  onOpenTerminal,
  onOpenDeploy,
}) => {
  const {
    design,
    projects,
    filterStatus,
    setFilterStatus,
    searchQuery,
    setSearchQuery,
    incidents,
  } = useDashboard();

  const theme = getThemeClasses(design);

  // Filter projects by search and status
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    if (!matchesSearch) return false;

    if (filterStatus === 'all') return true;
    if (filterStatus === 'up') return p.status === 'UP';
    if (filterStatus === 'degraded') return p.status === 'DEGRADED';
    if (filterStatus === 'down') return p.status === 'DOWN';
    if (filterStatus === 'stopped') return p.status === 'STOPPED';
    if (filterStatus === 'local') return p.location.type === 'local';
    if (filterStatus === 'external') return p.location.type === 'external';
    return true;
  });

  const activeIncident = incidents.find((i) => i.state !== 'resolved');

  // Filter options
  const filterPills = [
    { id: 'all', label: 'All Services', count: projects.length },
    { id: 'degraded', label: 'Degraded', count: projects.filter((p) => p.status === 'DEGRADED').length, alert: true },
    { id: 'up', label: 'Healthy', count: projects.filter((p) => p.status === 'UP').length },
    { id: 'stopped', label: 'Stopped', count: projects.filter((p) => p.status === 'STOPPED').length },
    { id: 'local', label: 'Local (Termux)', count: projects.filter((p) => p.location.type === 'local').length },
    { id: 'external', label: 'External (Vercel/Cloud)', count: projects.filter((p) => p.location.type === 'external').length },
  ];

  // Editorial layout helper: pick lead project
  const leadProject =
    filteredProjects.find((p) => p.status === 'DEGRADED') ||
    filteredProjects.find((p) => p.id === 'echoo-backend') ||
    filteredProjects[0];

  const secondaryProjects = filteredProjects.filter((p) => p.id !== leadProject?.id);

  return (
    <div className="space-y-6">
      {/* Active Incident Alert Banner (if any) */}
      {activeIncident && (
        <div
          className={`p-4 border-2 border-amber-500/80 bg-amber-500/10 rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg ${
            design.feeling === 'tactical' ? 'ring-2 ring-amber-500/30' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-amber-500 text-slate-950 font-bold animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 font-bold">
                  Active Incident #{activeIncident.id}
                </span>
                <span className="text-xs font-mono opacity-70">Started {activeIncident.startedAt}</span>
              </div>
              <p className="text-sm font-semibold mt-0.5">{activeIncident.cause}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs self-end md:self-auto">
            <button
              onClick={() => {
                const targetProj = projects.find((p) => p.id === activeIncident.projectId);
                if (targetProj) onOpenAi(targetProj);
              }}
              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all"
            >
              Ask AI Doctor
            </button>
            <button
              onClick={() => {
                const targetProj = projects.find((p) => p.id === activeIncident.projectId);
                if (targetProj) onOpenDetails(targetProj, 'incidents');
              }}
              className="px-3 py-1.5 rounded border border-amber-500/40 hover:bg-amber-500/20 text-amber-500 transition-all"
            >
              View Timeline
            </button>
          </div>
        </div>
      )}

      {/* Playful Feeling Companion: Server Tamagotchi */}
      {design.feeling === 'playful' && (
        <div className="p-3 rounded-xl border border-pink-500/30 bg-pink-500/10 flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="text-2xl animate-bounce">🤖</div>
            <div>
              <div className="flex items-center gap-1.5 font-bold text-sm text-pink-400">
                <span>PixelBot (Control Plane Daemon)</span>
                <Heart className="w-4 h-4 fill-pink-500 text-pink-500 inline" />
              </div>
              <p className="text-xs text-pink-300/80">
                {activeIncident
                  ? 'Oh no! Echoo Backend is stumbling with a 502 error! Click "AI" on the card to nurse it back to health!'
                  : 'Termux Android proot is purring smoothly at 34% CPU! All green across the board!'}
              </p>
            </div>
          </div>
          <div className="font-mono text-xs px-2 py-1 rounded bg-pink-500/20 text-pink-300">
            Mood: {activeIncident ? 'Worried (94% fixable)' : 'Joyful (100% up)'}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            type="text"
            placeholder="Filter by name, ID, port, or tag (e.g. echoo, vercel, 8000)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-9 pr-3 py-1.5 text-xs ${theme.input}`}
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          <Filter className="w-3.5 h-3.5 opacity-50 hidden sm:inline" />
          {filterPills.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-all ${
                filterStatus === f.id
                  ? 'bg-current/20 font-bold border border-current/30 shadow-sm'
                  : 'hover:bg-current/10 opacity-70'
              }`}
            >
              <span>{f.label}</span>
              <span className="ml-1 opacity-60 font-mono text-[10px]">({f.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* COMPOSITION LAYOUT 1: EDITORIAL */}
      {design.composition === 'editorial' && (
        <div className="space-y-6">
          {leadProject && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Feature Headline Card */}
              <div className="lg:col-span-7">
                <div className="mb-2 text-[11px] font-mono uppercase tracking-widest opacity-60 flex items-center gap-1">
                  <span>Lead Operational Dispatch</span>
                  <span className="w-8 h-[1px] bg-current opacity-40 inline-block" />
                </div>
                <ProjectCard
                  project={leadProject}
                  onOpenDetails={onOpenDetails}
                  onOpenAi={onOpenAi}
                  onOpenTerminal={onOpenTerminal}
                  onOpenDeploy={onOpenDeploy}
                />
              </div>

              {/* Right Column: Editorial Analysis & Incident Context */}
              <div className="lg:col-span-5 space-y-4">
                <div className={`p-4 rounded border ${theme.border} bg-current/5 space-y-3`}>
                  <div className="flex items-center justify-between border-b border-current/10 pb-2">
                    <span className="font-mono text-xs uppercase tracking-wider font-bold">
                      Control Room Briefing
                    </span>
                    <span className="text-[10px] font-mono opacity-60">Termux Box Hel-1</span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-85">
                    <strong>Auto-Recovery Supervisor active:</strong> Single-process supervisor monitors
                    PID sockets without requiring Docker or PM2. When consecutive failed health checks
                    exceed 3, graceful SIGTERM cycles the process with exponential backoff.
                  </p>
                  <div className="pt-2 border-t border-current/10 grid grid-cols-2 gap-2 text-xs font-mono">
                    <div>
                      <span className="opacity-50 text-[10px] block">TOTAL RESTARTS TODAY</span>
                      <span className="font-bold text-amber-500">4 events</span>
                    </div>
                    <div>
                      <span className="opacity-50 text-[10px] block">RECOVERY RATE</span>
                      <span className="font-bold text-emerald-500">100% verified</span>
                    </div>
                  </div>
                </div>

                {secondaryProjects.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-[11px] font-mono uppercase tracking-widest opacity-60">
                      Associated Services ({secondaryProjects.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                      {secondaryProjects.slice(0, 2).map((p) => (
                        <ProjectCard
                          key={p.id}
                          project={p}
                          onOpenDetails={onOpenDetails}
                          onOpenAi={onOpenAi}
                          onOpenTerminal={onOpenTerminal}
                          onOpenDeploy={onOpenDeploy}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rest of the projects */}
          {secondaryProjects.length > 2 && (
            <div className="pt-4 border-t border-current/10">
              <div className="mb-3 text-[11px] font-mono uppercase tracking-widest opacity-60">
                Secondary Service Roster
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {secondaryProjects.slice(2).map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpenDetails={onOpenDetails}
                    onOpenAi={onOpenAi}
                    onOpenTerminal={onOpenTerminal}
                    onOpenDeploy={onOpenDeploy}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* COMPOSITION LAYOUT 2: ASYMMETRIC */}
      {design.composition === 'asymmetric' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {filteredProjects.map((project, idx) => {
            // First item gets 7 cols, second gets 5 cols, then 4/4/4 etc.
            const colSpan =
              idx === 0 ? 'md:col-span-7' : idx === 1 ? 'md:col-span-5' : idx % 3 === 2 ? 'md:col-span-4' : 'md:col-span-4';
            return (
              <div key={project.id} className={colSpan}>
                <ProjectCard
                  project={project}
                  onOpenDetails={onOpenDetails}
                  onOpenAi={onOpenAi}
                  onOpenTerminal={onOpenTerminal}
                  onOpenDeploy={onOpenDeploy}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* COMPOSITION LAYOUT 3: DENSE (Bloomberg / Matrix) */}
      {design.composition === 'dense' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpenDetails={onOpenDetails}
              onOpenAi={onOpenAi}
              onOpenTerminal={onOpenTerminal}
              onOpenDeploy={onOpenDeploy}
            />
          ))}
        </div>
      )}

      {/* COMPOSITION LAYOUT 4: SPACIOUS (Zen air) */}
      {design.composition === 'spacious' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto py-2">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onOpenDetails={onOpenDetails}
              onOpenAi={onOpenAi}
              onOpenTerminal={onOpenTerminal}
              onOpenDeploy={onOpenDeploy}
            />
          ))}
        </div>
      )}

      {filteredProjects.length === 0 && (
        <div className="p-12 text-center border border-dashed rounded-lg opacity-60">
          <p className="text-sm font-mono">No monitored services match your current query.</p>
        </div>
      )}
    </div>
  );
};
