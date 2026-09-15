import React from 'react';
import { useDashboard } from '../../context/DashboardContext';
import {
  Radio,
  Server,
  Cpu,
  HardDrive,
  Copy,
} from 'lucide-react';

export const AgentsMatrix: React.FC = () => {
  const { agents, playHapticAudio } = useDashboard();
  const [copiedCmd, setCopiedCmd] = React.useState(false);

  const agentInstallCommand = 'curl -sSL https://ops.domain/install-agent.sh | AGENT_TOKEN=srv_agnt_99x bash';

  const copyCommand = () => {
    playHapticAudio('click');
    navigator.clipboard.writeText(agentInstallCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="p-4 rounded-xl border border-current/15 bg-current/5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Radio className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <span>Multi-Server Distributed Agent Mesh</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Outbound WS Dialing (NAT-Friendly)
            </span>
          </h2>
        </div>
        <p className="text-xs opacity-75 leading-relaxed">
          Central never opens incoming ports on satellite nodes. Agents dial out via secure WebSocket heartbeats,
          reporting CPU/memory load and receiving signed job payloads (start/stop/deploy/exec).
        </p>

        {/* Dial-out Install Snippet */}
        <div className="pt-3 border-t border-current/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="font-mono text-xs opacity-75">Connect remote agent (VPS, Pi, NAS):</div>
          <div className="flex items-center gap-2">
            <code className="px-3 py-1.5 rounded bg-black/40 border border-current/15 text-[11px] font-mono text-emerald-400 select-all">
              {agentInstallCommand}
            </code>
            <button
              onClick={copyCommand}
              className="px-3 py-1.5 rounded bg-current/10 hover:bg-current/20 font-mono text-xs flex items-center gap-1 transition-all"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Agents Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`p-5 rounded-xl border flex flex-col justify-between space-y-5 transition-all font-sans ${
              agent.isHost
                ? 'border-emerald-500/40 bg-emerald-500/5 shadow-lg'
                : 'border-current/15 bg-current/5'
            }`}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-lg ${
                      agent.isHost
                        ? 'bg-emerald-500 text-slate-950 font-bold'
                        : 'bg-current/10 text-current'
                    }`}
                  >
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                      <span>{agent.hostname}</span>
                      {agent.isHost && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          HOST
                        </span>
                      )}
                    </h3>
                    <div className="text-[11px] font-mono opacity-60">{agent.ip}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>ONLINE</span>
                </div>
              </div>

              {/* OS / Platform Tag */}
              <div className="p-2 rounded bg-black/20 dark:bg-white/5 border border-current/10 font-mono text-[11px] opacity-80">
                {agent.platform}
              </div>

              {/* Hardware Telemetry Gauges */}
              <div className="space-y-2 pt-1 font-mono text-xs">
                {/* CPU Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="opacity-60 flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-cyan-400" /> CPU Load
                    </span>
                    <span className="font-bold">{agent.cpuPct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-black/30 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${agent.cpuPct}%` }}
                      className="h-full bg-cyan-400 rounded-full"
                    />
                  </div>
                </div>

                {/* RAM Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="opacity-60 flex items-center gap-1">
                      <HardDrive className="w-3 h-3 text-amber-400" /> Memory (RAM)
                    </span>
                    <span className="font-bold">
                      {(agent.memUsedMB / 1024).toFixed(1)}G / {(agent.memTotalMB / 1024).toFixed(1)}G
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-black/30 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${(agent.memUsedMB / agent.memTotalMB) * 100}%` }}
                      className="h-full bg-amber-400 rounded-full"
                    />
                  </div>
                </div>

                {/* Disk Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="opacity-60 flex items-center gap-1">
                      <Server className="w-3 h-3 text-emerald-400" /> Storage (/dev/root)
                    </span>
                    <span className="font-bold">
                      {agent.diskUsedGB.toFixed(0)}G / {agent.diskTotalGB.toFixed(0)}G
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-black/30 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${(agent.diskUsedGB / agent.diskTotalGB) * 100}%` }}
                      className="h-full bg-emerald-400 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom info */}
            <div className="pt-3 border-t border-current/10 flex items-center justify-between text-[11px] font-mono opacity-70">
              <span>{agent.projectCount} Monitored Services</span>
              <span>Daemon: {agent.version}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
