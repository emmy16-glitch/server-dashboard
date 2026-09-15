import React, { useState } from 'react';
import { Incident } from '../../types/dashboard';
import { useDashboard } from '../../context/DashboardContext';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Bell,
  Check,
} from 'lucide-react';

export const IncidentsCenter: React.FC = () => {
  const {
    incidents,
    acknowledgeIncident,
    resolveIncident,
    isReadOnlyMode,
    playHapticAudio,
  } = useDashboard();

  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(incidents[0]?.id || '');
  const [ackNote, setAckNote] = useState<string>('');
  const [resolveNote, setResolveNote] = useState<string>('');
  const [maintenanceWindow, setMaintenanceWindow] = useState<boolean>(false);

  const openIncidents = incidents.filter((i) => i.state !== 'resolved');
  const resolvedIncidents = incidents.filter((i) => i.state === 'resolved');
  const displayList = activeTab === 'open' ? openIncidents : resolvedIncidents;

  const currentIncident: Incident | undefined =
    incidents.find((i) => i.id === selectedIncidentId) || displayList[0];

  const handleAcknowledge = (id: string) => {
    if (isReadOnlyMode) return;
    acknowledgeIncident(id, ackNote || 'Investigating root cause');
    setAckNote('');
  };

  const handleResolve = (id: string) => {
    if (isReadOnlyMode) return;
    resolveIncident(id, resolveNote || 'Service verified stable', 'Connection pool scaled & process cycled');
    setResolveNote('');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner & Maintenance Window */}
      <div className="p-4 rounded-xl border border-current/15 bg-current/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500 font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>Incident Center & Auto-Recovery</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                Rule-Based Escalation
              </span>
            </h2>
          </div>
          <p className="text-xs opacity-75">
            Deduplicated incident tracking, auto-restart retry loops, and Telegram/Discord webhook dispatches.
          </p>
        </div>

        {/* Maintenance Window Toggle */}
        <div className="flex items-center gap-3 p-2 rounded-lg border border-current/10 bg-black/10 dark:bg-white/5 font-mono text-xs">
          <Bell className="w-4 h-4 text-cyan-400" />
          <div>
            <span className="font-bold block text-[11px]">Maintenance Window</span>
            <span className="text-[10px] opacity-60">Suppress alert notifications</span>
          </div>
          <button
            onClick={() => {
              playHapticAudio('toggle');
              setMaintenanceWindow(!maintenanceWindow);
            }}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              maintenanceWindow
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-current/10 hover:bg-current/20'
            }`}
          >
            {maintenanceWindow ? 'MUTED' : 'LIVE'}
          </button>
        </div>
      </div>

      {/* Main Two-Column Incident Desk */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Incidents List */}
        <div className="lg:col-span-5 space-y-3">
          {/* Tabs: Open vs Resolved */}
          <div className="flex items-center gap-2 border-b border-current/10 pb-2">
            <button
              onClick={() => setActiveTab('open')}
              className={`px-3 py-1 text-xs font-mono font-bold rounded transition-all ${
                activeTab === 'open'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              Open ({openIncidents.length})
            </button>
            <button
              onClick={() => setActiveTab('resolved')}
              className={`px-3 py-1 text-xs font-mono font-bold rounded transition-all ${
                activeTab === 'resolved'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'opacity-60 hover:opacity-100'
              }`}
            >
              Resolved ({resolvedIncidents.length})
            </button>
          </div>

          {displayList.length === 0 ? (
            <div className="p-8 border border-dashed rounded-lg text-center font-mono text-xs opacity-60">
              No {activeTab} incidents found.
            </div>
          ) : (
            displayList.map((inc) => {
              const isSelected = (currentIncident?.id || '') === inc.id;
              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-500/10 shadow-md'
                      : 'border-current/10 bg-current/5 hover:border-current/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs">#{inc.id}</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold ${
                        inc.state === 'open'
                          ? 'bg-rose-500/20 text-rose-400'
                          : inc.state === 'acknowledged'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {inc.state}
                    </span>
                  </div>

                  <h4 className="font-bold text-xs mt-1 truncate">{inc.projectName}</h4>
                  <p className="text-xs opacity-75 line-clamp-2 mt-1 leading-relaxed">
                    {inc.cause}
                  </p>

                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-current/10 text-[10px] font-mono opacity-60">
                    <span>Started: {inc.startedAt}</span>
                    <span>Retries: {inc.recoveryAttempts}/{inc.maxRecoveryAttempts}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Detailed Incident Dossier & Recovery Policy */}
        <div className="lg:col-span-7">
          {currentIncident ? (
            <div className="p-5 rounded-xl border border-current/15 bg-current/5 space-y-5">
              {/* Incident Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-current/10 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-amber-500">
                      Incident #{currentIncident.id}
                    </span>
                    <span className="text-xs opacity-60">({currentIncident.projectName})</span>
                  </div>
                  <div className="text-xs font-mono opacity-70 mt-0.5">
                    Trigger: 3 failed checks threshold exceeded
                  </div>
                </div>

                {/* State Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold uppercase ${
                      currentIncident.state === 'open'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                        : currentIncident.state === 'acknowledged'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    }`}
                  >
                    ● {currentIncident.state}
                  </span>
                </div>
              </div>

              {/* Cause Statement */}
              <div className="p-3 rounded-lg bg-black/20 dark:bg-white/5 border border-current/10 space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-60 block">
                  Root Cause Diagnosis
                </span>
                <p className="text-xs font-semibold leading-relaxed">{currentIncident.cause}</p>
              </div>

              {/* Alert Channels Dispatched */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-60 block">
                  Alert Channels Dispatch (Nango Integration Runtime Pattern)
                </span>
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  {currentIncident.alertChannels.map((ac) => (
                    <div
                      key={ac.channel}
                      className="p-2 rounded border border-current/10 bg-current/5 flex items-center justify-between"
                    >
                      <span className="capitalize">{ac.channel}</span>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                        <Check className="w-3 h-3" /> Sent
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recovery Timeline */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-60 block">
                  Supervisor Event Timeline
                </span>
                <div className="p-3 rounded-lg bg-black/30 dark:bg-white/5 border border-current/10 space-y-2.5 max-h-48 overflow-y-auto font-mono text-xs">
                  {currentIncident.timeline.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-[11px] leading-relaxed">
                      <Clock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="text-cyan-400 font-bold mr-1.5">[{item.ts}]</span>
                        <span className="opacity-90">{item.event}</span>
                        {item.actor && (
                          <span className="opacity-50 ml-1.5">({item.actor})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons: Acknowledge & Resolve */}
              {currentIncident.state !== 'resolved' && (
                <div className="pt-3 border-t border-current/10 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Ack Box */}
                    {currentIncident.state === 'open' && (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          placeholder="Acknowledge note (e.g. checking logs)..."
                          value={ackNote}
                          onChange={(e) => setAckNote(e.target.value)}
                          disabled={isReadOnlyMode}
                          className="w-full px-2.5 py-1.5 text-xs rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none"
                        />
                        <button
                          onClick={() => handleAcknowledge(currentIncident.id)}
                          disabled={isReadOnlyMode}
                          className="w-full py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-xs font-mono font-bold flex items-center justify-center gap-1.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Acknowledge Incident</span>
                        </button>
                      </div>
                    )}

                    {/* Resolve Box */}
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Resolution summary (saved to memory/)..."
                        value={resolveNote}
                        onChange={(e) => setResolveNote(e.target.value)}
                        disabled={isReadOnlyMode}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-current/20 bg-black/20 dark:bg-white/5 focus:outline-none"
                      />
                      <button
                        onClick={() => handleResolve(currentIncident.id)}
                        disabled={isReadOnlyMode}
                        className="w-full py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-mono font-bold flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve & Commit to Memory</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 border border-dashed rounded-xl text-center opacity-60 font-mono text-xs">
              Select an incident on the left to inspect timeline and recovery policy.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
