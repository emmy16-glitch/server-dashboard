import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { getThemeClasses } from '../../utils/themeStyles';
import {
  Server,
  Activity,
  AlertTriangle,
  Terminal,
  Sparkles,
  GitCommit,
  FolderGit2,
  ShieldCheck,
  RefreshCw,
  Plus,
  Radio,
  Cpu,
  HardDrive,
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  onOpenAddModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  onOpenAddModal,
}) => {
  const {
    design,
    projects,
    incidents,
    agents,
    lastSyncTime,
    playHapticAudio,
    isReadOnlyMode,
  } = useDashboard();

  const theme = getThemeClasses(design);
  const hostAgent = agents.find((a) => a.isHost) || agents[0];
  const activeIncidentsCount = incidents.filter((i) => i.state !== 'resolved').length;

  const totalCount = projects.length;
  const upCount = projects.filter((p) => p.status === 'UP').length;
  const degradedCount = projects.filter((p) => p.status === 'DEGRADED').length;
  const downCount = projects.filter((p) => p.status === 'DOWN').length;

  const tabs = [
    { id: 'projects', label: 'Control Matrix', icon: Server, count: totalCount },
    { id: 'incidents', label: 'Incidents & Recovery', icon: AlertTriangle, badge: activeIncidentsCount > 0 ? activeIncidentsCount : undefined },
    { id: 'deploys', label: 'Deploy Engine', icon: GitCommit },
    { id: 'terminal', label: 'Safe Terminal', icon: Terminal },
    { id: 'ai-ops', label: 'AI Diagnosis', icon: Sparkles },
    { id: 'templates', label: '17 Templates', icon: FolderGit2 },
    { id: 'agents', label: 'Multi-Server Agents', icon: Radio },
    { id: 'audit', label: 'Audit Trail', icon: ShieldCheck },
  ];

  return (
    <header className={`w-full ${theme.headerBar} transition-colors`}>
      {/* Top Banner with Server Specs & Telemetry */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Host Branding */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="font-semibold">HOST: {hostAgent.hostname}</span>
              </div>
              <span className="text-xs font-mono opacity-60">[{hostAgent.platform}]</span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 opacity-70">
                Node v20.18 · No Docker / PM2 Required
              </span>
              {isReadOnlyMode && (
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  READ-ONLY TOKEN
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <span className={theme.accentText}>server-dashboard</span>
                <span className="text-xs font-mono font-normal opacity-50">v1.0 (Phase 1-5 MVP)</span>
              </h1>
            </div>
            <p className={`text-xs ${theme.subtext} max-w-2xl`}>
              One secure control plane for monitoring, deploying, debugging, and recovering all applications
              — Termux local processes + Vercel / Railway / Render URLs.
            </p>
          </div>

          {/* Real-time Telemetry Cluster */}
          <div className="flex items-center gap-3 flex-wrap lg:justify-end">
            {/* CPU & Memory Gauges */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-current/10 bg-current/5 font-mono text-xs">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <div>
                <span className="opacity-60 text-[10px] block">CPU</span>
                <span className="font-semibold">{hostAgent.cpuPct.toFixed(1)}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded border border-current/10 bg-current/5 font-mono text-xs">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <div>
                <span className="opacity-60 text-[10px] block">RAM</span>
                <span className="font-semibold">
                  {(hostAgent.memUsedMB / 1024).toFixed(1)}G / {(hostAgent.memTotalMB / 1024).toFixed(1)}G
                </span>
              </div>
            </div>

            {/* Quick Status Pill Bar */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-current/10 bg-current/5 font-mono text-xs">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-emerald-500 font-bold">{upCount} UP</span>
                {degradedCount > 0 && <span className="text-amber-500 font-bold animate-pulse">{degradedCount} DEG</span>}
                {downCount > 0 && <span className="text-rose-500 font-bold">{downCount} DOWN</span>}
              </div>
            </div>

            {/* New Project Button */}
            {!isReadOnlyMode && (
              <button
                onClick={() => {
                  playHapticAudio('click');
                  onOpenAddModal();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded shadow-md transition-all ${theme.buttonPrimary}`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Register App</span>
              </button>
            )}
          </div>
        </div>

        {/* Tactical Navigation Tabs */}
        <div className="mt-4 pt-2 border-t border-current/10 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <nav className="flex items-center gap-1 flex-nowrap min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    playHapticAudio('toggle');
                    setCurrentTab(tab.id);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-t transition-all ${
                    isActive
                      ? `border-b-2 font-bold ${
                          design.material === 'terminal'
                            ? 'border-[#33ff55] bg-[#33ff55]/10 text-[#33ff55]'
                            : design.material === 'paper'
                            ? 'border-[#C93B2B] bg-[#EFECE1] text-[#1D1D1B]'
                            : 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
                        }`
                      : 'opacity-65 hover:opacity-100 hover:bg-current/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500 text-white font-bold animate-pulse">
                      {tab.badge}
                    </span>
                  )}
                  {tab.count !== undefined && !tab.badge && (
                    <span className="text-[10px] opacity-60 font-mono">({tab.count})</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Heartbeat Sync Indicator */}
          <div className="hidden md:flex items-center gap-2 font-mono text-[11px] opacity-65">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Loop: 30s</span>
            <span className="opacity-40">|</span>
            <span className="flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5" />
              {lastSyncTime}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
