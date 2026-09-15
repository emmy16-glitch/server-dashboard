import React, { useState } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import {
  ShieldCheck,
  Download,
  Filter,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export const AuditLogModal: React.FC = () => {
  const { auditLogs, playHapticAudio } = useDashboard();
  const [filterAction, setFilterAction] = useState<string>('all');

  const filteredLogs = auditLogs.filter((log) => {
    if (filterAction === 'all') return true;
    return log.action.includes(filterAction);
  });

  const exportAuditJson = () => {
    playHapticAudio('click');
    const blob = new Blob([JSON.stringify(auditLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-4 rounded-xl border border-current/15 bg-current/5 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>Tamper-Evident Security Audit Log (audit.json)</span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Append-Only & Secret Redacted
                </span>
              </h2>
              <p className="text-xs opacity-75">
                Every process lifecycle command, deployment, AI remediation execution, and terminal invocation is recorded with cryptographic argument hashes.
              </p>
            </div>
          </div>

          <button
            onClick={exportAuditJson}
            className="px-3 py-1.5 rounded bg-current/10 hover:bg-current/20 font-mono text-xs flex items-center gap-1.5 self-start sm:self-auto transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export audit.json</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="pt-3 border-t border-current/10 flex items-center gap-2 flex-wrap text-xs font-mono">
          <Filter className="w-3.5 h-3.5 opacity-60" />
          <span className="opacity-60">Action:</span>
          {['all', 'process', 'deploy', 'exec', 'ai', 'incident'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterAction(f)}
              className={`px-2.5 py-1 rounded transition-all capitalize ${
                filterAction === f
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-current/10 hover:bg-current/15'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="border border-current/15 rounded-xl bg-current/5 overflow-hidden font-mono text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-current/10 bg-black/20 dark:bg-white/5 opacity-70 text-[11px] uppercase tracking-wider">
                <th className="p-3">Time</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Project</th>
                <th className="p-3">Action</th>
                <th className="p-3">Arg Hash</th>
                <th className="p-3">Details</th>
                <th className="p-3 text-right">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-current/10">
              {filteredLogs.map((entry) => (
                <tr key={entry.id} className="hover:bg-current/5 transition-colors">
                  <td className="p-3 opacity-70 whitespace-nowrap">{entry.ts}</td>
                  <td className="p-3 font-semibold text-cyan-400 whitespace-nowrap">
                    {entry.actor}
                  </td>
                  <td className="p-3 whitespace-nowrap">{entry.projectId}</td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="px-1.5 py-0.5 rounded bg-current/10 font-bold text-[10px]">
                      {entry.action}
                    </span>
                  </td>
                  <td className="p-3 opacity-60 text-[10px] whitespace-nowrap">{entry.argsHash}</td>
                  <td className="p-3 opacity-90 max-w-md truncate font-sans text-xs">
                    {entry.details}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {entry.result === 'success' ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>OK</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                        <XCircle className="w-3.5 h-3.5" />
                        <span className="uppercase">{entry.result}</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
