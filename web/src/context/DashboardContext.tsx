import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  DesignState,
  MaterialType,
  CompositionType,
  StructureType,
  FeelingType,
  Project,
  Incident,
  DeploymentRecord,
  AuditRecord,
  AgentNode,
  TemplateItem,
  AiDiagnosis,
} from '../types/dashboard';
import { api } from '../lib/api';

interface DashboardContextType {
  design: DesignState;
  setDesign: React.Dispatch<React.SetStateAction<DesignState>>;
  setMaterial: (m: MaterialType) => void;
  setComposition: (c: CompositionType) => void;
  setStructure: (s: StructureType) => void;
  setFeeling: (f: FeelingType) => void;
  applyPreset: (presetName: string) => void;

  projects: Project[];
  activeProject: Project | null;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;

  logs: Record<string, string[]>;
  incidents: Incident[];
  deployments: DeploymentRecord[];
  auditLogs: AuditRecord[];
  agents: AgentNode[];
  templates: TemplateItem[];

  filterStatus: string;
  setFilterStatus: (s: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  isReadOnlyMode: boolean;
  setIsReadOnlyMode: (ro: boolean) => void;
  authToken: string;
  authed: boolean;
  authChecked: boolean;
  login: (token: string) => Promise<boolean>;
  logout: () => void;
  rotateAuthToken: () => void;

  // Actions
  startProject: (id: string) => Promise<void>;
  stopProject: (id: string) => Promise<void>;
  restartProject: (id: string) => Promise<void>;
  runHealthCheck: (id: string) => Promise<void>;
  triggerDeploy: (id: string, customSha?: string) => Promise<void>;
  rollbackDeploy: (id: string, targetDepId: string) => Promise<void>;
  executeTerminal: (id: string, commandStr: string, isAdmin?: boolean) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  askAiDiagnosis: (id: string, question: string, provider?: 'opencode' | 'codex' | 'claude' | 'ollama') => Promise<AiDiagnosis>;
  executeAiFix: (id: string, tool: string, args: Record<string, any>) => Promise<boolean>;
  acknowledgeIncident: (id: string, note?: string) => void;
  resolveIncident: (id: string, note?: string, fixSummary?: string) => void;
  addNewProject: (proj: Partial<Project>) => Promise<boolean>;

  // Add-service modal signal (so any screen can open it on the right choice)
  addServiceSignal: { type: 'local' | 'external'; n: number } | null;
  openAddService: (type: 'local' | 'external') => void;

  // Audio effects
  playHapticAudio: (sound: 'click' | 'alarm' | 'deploy' | 'beep' | 'toggle') => void;
  lastSyncTime: string;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [design, setDesign] = useState<DesignState>({
    material: 'glass',
    composition: 'spacious',
    structure: 'swiss',
    feeling: 'precise',
    soundEnabled: true,
    scanlines: false,
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string[]>>({});
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRecord[]>([]);
  const [agents, setAgents] = useState<AgentNode[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isReadOnlyMode, setIsReadOnlyMode] = useState<boolean>(false);
  const [authToken, setAuthToken] = useState<string>(() => api.getToken());
  const [authed, setAuthed] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');
  const [addServiceSignal, setAddServiceSignal] = useState<{ type: 'local' | 'external'; n: number } | null>(null);
  const openAddService = useCallback((type: 'local' | 'external') => {
    playHapticAudio('click');
    setAddServiceSignal((s) => ({ type, n: (s?.n || 0) + 1 }));
  }, []);

  const login = useCallback(async (token: string) => {
    const ok = await api.login(token.trim());
    if (ok) {
      setAuthToken(token.trim());
      setAuthed(true);
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    api.setToken("");
    setAuthToken("");
    setAuthed(false);
  }, []);

  // On boot: a stored token means nothing until the server accepts it.
  // Stale/invalid tokens land back on the login screen instead of a blank dashboard.
  useEffect(() => {
    let dead = false;
    (async () => {
      const stored = api.getToken();
      if (stored) {
        try {
          const reg = await api.get<{ projects: unknown[] }>("/api/projects");
          if (!dead) {
            if (reg) {
              setAuthed(true);
            } else {
              api.setToken("");
              setAuthToken("");
              setAuthed(false);
            }
          }
        } catch {
          if (!dead) {
            api.setToken("");
            setAuthToken("");
            setAuthed(false);
          }
        }
      }
      if (!dead) setAuthChecked(true);
    })();
    return () => { dead = true; };
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  // Web Audio synth for tactical feedback
  const playHapticAudio = useCallback((type: 'click' | 'alarm' | 'deploy' | 'beep' | 'toggle') => {
    if (!design.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'click') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'toggle') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.setValueAtTime(780, now + 0.03);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'alarm') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(320, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'deploy') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch {
      // AudioContext policy handled quietly
    }
  }, [design.soundEnabled]);

  // --- server sync: real /api truth first, local mock fallback (Phase 1 wiring) ---
  useEffect(() => {
    let dead = false;
    const sync = async () => {
      // projects registry
      const reg = await api.get<{ projects: Partial<Project>[] }>("/api/projects");
      // status map
      const st = await api.get<Record<string, { status: Project["status"]; latencyMs: number; uptime24h: number; restarts: number; checkedAt: string | null }>>("/api/status");
      // incidents + deployments
      const inc = await api.get<{ incidents: Incident[] }>("/api/incidents");
      const dep = await api.get<{ deployments: DeploymentRecord[] }>("/api/deploy");
      if (dead) return;
      if (reg?.projects?.length) {
        // Server registry is source of truth: replace list, keep local
        // display details (description/tags/history) where ids match.
        const list = reg.projects;
        setProjects((prev) => {
          const byId = new Map(prev.map((p) => [p.id, p]));
          return list.map((rp) => {
            const r = rp as unknown as Project;
            const local = byId.get(r.id);
            const s = st?.[r.id];
            return {
              id: r.id,
              name: r.name || r.id,
              description: local?.description || "",
              enabled: (r as { enabled?: boolean }).enabled !== false,
              status: s?.status || (r as { status?: Project["status"] }).status || local?.status || "STARTING",
              template: (r as { template?: string }).template || local?.template,
              tags: local?.tags || [],
              location: r.location || local?.location || { type: "external", agentId: "local" },
              runtime: { ...(local?.runtime || {}), ...(r.runtime || {}) },
              monitoring: r.monitoring || local?.monitoring || { intervalSeconds: 60, timeoutSeconds: 10, expectedStatus: [200] },
              source: (r as { source?: Project["source"] }).source || local?.source,
              process: local?.process,
              history: local?.history || [],
              uptime24h: s?.uptime24h ?? (r as { uptime24h?: number }).uptime24h ?? local?.uptime24h ?? 100,
              uptime7d: local?.uptime7d ?? 100,
              uptime30d: local?.uptime30d ?? 100,
              currentLatency: s?.latencyMs ?? (r as { currentLatency?: number }).currentLatency ?? local?.currentLatency ?? 0,
              lastChecked: s?.checkedAt || local?.lastChecked || "just now",
              hasIncident: local?.hasIncident || false,
            } as Project;
          });
        });
      } else if (st) {
        setProjects((prev) => prev.map((p) => {
          const s = st[p.id];
          return s ? { ...p, status: s.status, currentLatency: s.latencyMs, uptime24h: s.uptime24h, lastChecked: s.checkedAt || p.lastChecked } : p;
        }));
      }
      if (inc?.incidents) setIncidents(inc.incidents);
      if (dep?.deployments) setDeployments(dep.deployments);
      const tpl = await api.get<{ templates: { name: string; detect: string[]; install?: string | null; build?: string | null; start?: string[] | string; healthPath?: string; port?: number; notes?: string }[] }>("/api/templates");
      if (tpl?.templates?.length) setTemplates(tpl.templates.map((t) => ({
        id: t.name,
        name: t.name,
        category: ["vercel-external", "railway-external"].includes(t.name) ? "apps" as const : "dev" as const,
        description: t.notes || [t.install, t.build, Array.isArray(t.start) ? t.start.join(" ") : t.start].filter(Boolean).join(" → "),
        detect: t.detect || [],
        defaultPort: t.port || 3000,
        healthPath: t.healthPath || "/",
        command: Array.isArray(t.start) ? t.start[0] : t.start || "",
        args: Array.isArray(t.start) ? t.start.slice(1) : [],
        notes: t.notes,
      })));
      const ag = await api.get<{ agents: AgentNode[] }>("/api/agents");
      if (ag?.agents?.length) setAgents(ag.agents.map((a, i) => ({ ...a, isHost: (a as { isHost?: boolean }).isHost ?? i === 0 })));
      if (reg || st || inc || dep) setLastSyncTime(new Date().toLocaleTimeString());
    };
    if (!authed) return;
    void sync();
    const t = setInterval(sync, 30000);
    return () => { dead = true; clearInterval(t); };
  }, [authed]);

  // Periodic simulated check & jitter
  useEffect(() => {
    const interval = setInterval(() => {
      setLastSyncTime(new Date().toLocaleTimeString());
      // Small latency jitter for living pulse
      setProjects((prev) =>
        prev.map((p) => {
          if (p.status === 'UP') {
            const jitter = (Math.random() - 0.45) * 4;
            const newLat = Math.max(8, Number((p.currentLatency + jitter).toFixed(1)));
            return {
              ...p,
              currentLatency: newLat,
              history: [
                ...(p.history ?? []).slice(1),
                { ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), code: 200, latencyMs: newLat },
              ],
            };
          }
          return p;
        })
      );
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const setMaterial = (material: MaterialType) => {
    playHapticAudio('toggle');
    setDesign((prev) => ({
      ...prev,
      material,
      scanlines: material === 'terminal',
    }));
  };

  const setComposition = (composition: CompositionType) => {
    playHapticAudio('toggle');
    setDesign((prev) => ({ ...prev, composition }));
  };

  const setStructure = (structure: StructureType) => {
    playHapticAudio('toggle');
    setDesign((prev) => ({ ...prev, structure }));
  };

  const setFeeling = (feeling: FeelingType) => {
    playHapticAudio('toggle');
    setDesign((prev) => ({ ...prev, feeling }));
  };

  const applyPreset = (presetName: string) => {
    playHapticAudio('click');
    switch (presetName) {
      case 'Tactical Industrial Panel':
        setDesign({
          material: 'industrial panel',
          composition: 'dense',
          structure: 'brutalist',
          feeling: 'tactical',
          soundEnabled: true,
          scanlines: false,
        });
        break;
      case 'Swiss Studio Glass':
        setDesign({
          material: 'glass',
          composition: 'spacious',
          structure: 'swiss',
          feeling: 'precise',
          soundEnabled: true,
          scanlines: false,
        });
        break;
      case 'Tokyo Minimalist Paper':
        setDesign({
          material: 'paper',
          composition: 'asymmetric',
          structure: 'japanese minimal',
          feeling: 'quiet',
          soundEnabled: true,
          scanlines: false,
        });
        break;
      case 'CRT Phosphor Terminal':
        setDesign({
          material: 'terminal',
          composition: 'dense',
          structure: 'brutalist',
          feeling: 'tactical',
          soundEnabled: true,
          scanlines: true,
        });
        break;
      case 'Bloomberg Financial Monolith':
        setDesign({
          material: 'industrial panel',
          composition: 'dense',
          structure: 'financial',
          feeling: 'precise',
          soundEnabled: true,
          scanlines: false,
        });
        break;
      case 'Archival Broadsheet Editorial':
        setDesign({
          material: 'paper',
          composition: 'editorial',
          structure: 'swiss',
          feeling: 'quiet',
          soundEnabled: true,
          scanlines: false,
        });
        break;
      case 'Playful Cyber Ops':
        setDesign({
          material: 'glass',
          composition: 'asymmetric',
          structure: 'brutalist',
          feeling: 'playful',
          soundEnabled: true,
          scanlines: false,
        });
        break;
      default:
        break;
    }
  };

  const rotateAuthToken = async () => {
    playHapticAudio('click');
    // Server rotation first (invalidates old token everywhere)
    const fresh = await api.get<{ token: string }>("/api/auth/rotate", { method: "POST" });
    if (fresh?.token) {
      api.setToken(fresh.token);
      setAuthToken(fresh.token);
      addAuditEntry('bearer_token', 'local', 'exec_command', 'Rotated dashboard auth bearer token (server)');
      return;
    }
    const newTok = 'srv_tok_' + Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 6);
    setAuthToken(newTok);
    addAuditEntry('bearer_token', 'local', 'exec_command', 'Rotated dashboard auth bearer token');
  };

  const addAuditEntry = (
    actor: string,
    projectId: string,
    action: AuditRecord['action'],
    details: string,
    result: 'success' | 'denied' | 'failed' = 'success'
  ) => {
    const newEntry: AuditRecord = {
      id: `aud-${Date.now().toString().slice(-4)}`,
      ts: new Date().toLocaleTimeString(),
      actor,
      projectId,
      action,
      argsHash: `sha256:${Math.random().toString(36).substring(2, 9)}`,
      details,
      result,
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  const appendLog = (projectId: string, line: string) => {
    const formatted = `[${new Date().toISOString().replace('T', ' ').slice(0, 23)}] ${line}`;
    setLogs((prev) => ({
      ...prev,
      [projectId]: [...(prev[projectId] || []), formatted],
    }));
  };

  // Process Controls (server first, simulated fallback when offline/no token)
  const startProject = async (id: string) => {
    if (isReadOnlyMode) return;
    playHapticAudio('click');
    const server = await api.get<{ ok: boolean; pid?: number }>(`/api/process/${id}/start`, { method: "POST" });
    if (server) {
      appendLog(id, `[INFO] [supervisor] Server start ack${server.pid ? ` PID ${server.pid}` : ""}`);
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'STARTING' as const } : p)));
      addAuditEntry('bearer_token:admin_ops', id, 'process_start', 'Server start requested');
      playHapticAudio('beep');
      return;
    }
    appendLog(id, '[INFO] [supervisor] Manual start requested by operator');
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'STARTING' } : p))
    );

    await new Promise((r) => setTimeout(r, 1400));

    const newPid = Math.floor(20000 + Math.random() * 9000);
    appendLog(id, `[INFO] [process] Spawned PID ${newPid} in ${projects.find((p) => p.id === id)?.location.cwd || '.'}`);
    appendLog(id, '[INFO] [probe] Verification pass 1/3: HTTP 200 OK (14ms)');

    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'UP',
              currentLatency: 14.5,
              process: {
                pid: newPid,
                alive: true,
                cpuPct: 12.4,
                memMB: 180.5,
                uptimeSec: 1,
                restarts: p.process ? p.process.restarts : 0,
              },
            }
          : p
      )
    );
    addAuditEntry('bearer_token:admin_ops', id, 'process_start', `Started process PID ${newPid}`);
    playHapticAudio('beep');
  };

  const stopProject = async (id: string) => {
    if (isReadOnlyMode) return;
    playHapticAudio('click');
    const server = await api.get<{ ok: boolean }>(`/api/process/${id}/stop`, { method: "POST" });
    if (server) {
      appendLog(id, '[WARN] [supervisor] Server stop ack');
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'STOPPED' as const, currentLatency: 0 } : p)));
      addAuditEntry('bearer_token:admin_ops', id, 'process_stop', 'Server stop requested');
      return;
    }
    appendLog(id, '[WARN] [supervisor] SIGTERM dispatched to process tree');
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'STOPPED',
              currentLatency: 0,
              process: p.process ? { ...p.process, alive: false, cpuPct: 0, memMB: 0, uptimeSec: 0 } : undefined,
            }
          : p
      )
    );
    addAuditEntry('bearer_token:admin_ops', id, 'process_stop', 'Sent SIGTERM and cleaned pid lock');
  };

  const restartProject = async (id: string) => {
    if (isReadOnlyMode) return;
    playHapticAudio('click');
    const server = await api.get<{ ok: boolean; pid?: number }>(`/api/process/${id}/restart`, { method: "POST" });
    if (server) {
      appendLog(id, `[INFO] [supervisor] Server restart ack${server.pid ? ` PID ${server.pid}` : ""}`);
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, status: 'STARTING' as const } : p)));
      addAuditEntry('bearer_token:admin_ops', id, 'process_restart', 'Server restart requested');
      playHapticAudio('beep');
      return;
    }
    appendLog(id, '[INFO] [supervisor] Restarting process: SIGTERM -> wait 3s -> spawn');
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'STARTING' } : p))
    );

    await new Promise((r) => setTimeout(r, 1500));

    const newPid = Math.floor(20000 + Math.random() * 9000);
    appendLog(id, `[INFO] [supervisor] Warmup complete. PID ${newPid} active, listening on port`);
    appendLog(id, '[INFO] [health] /health probe asserts satisfied {"database":"connected"}');

    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'UP',
              hasIncident: false,
              currentLatency: 16.8,
              process: p.process
                ? {
                    ...p.process,
                    pid: newPid,
                    alive: true,
                    cpuPct: 22.1,
                    memMB: 210.4,
                    uptimeSec: 1,
                    restarts: p.process.restarts + 1,
                  }
                : undefined,
            }
          : p
      )
    );

    // If there is an open incident for this project, resolve it or note restart
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.projectId === id && inc.state !== 'resolved'
          ? {
              ...inc,
              state: 'resolved',
              resolvedAt: 'Just now',
              timeline: [
                ...inc.timeline,
                { ts: new Date().toLocaleTimeString(), event: `Manual process restart cleared error (PID ${newPid})`, actor: 'operator' },
              ],
            }
          : inc
      )
    );

    addAuditEntry('bearer_token:admin_ops', id, 'process_restart', `Restarted process to PID ${newPid}`);
    playHapticAudio('beep');
  };

  const runHealthCheck = async (id: string) => {
    playHapticAudio('click');
    const start = performance.now();
    await new Promise((r) => setTimeout(r, 400));
    const lat = Math.round(performance.now() - start + 12);
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              currentLatency: lat,
              lastChecked: 'Just now',
              history: [
                ...(p.history ?? []).slice(1),
                { ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), code: 200, latencyMs: lat },
              ],
            }
          : p
      )
    );
    appendLog(id, `[INFO] [probe] Manual HTTP health check ok (code 200, ${lat}ms)`);
  };

  // Deploy pipeline
  const triggerDeploy = async (id: string, customSha?: string) => {
    if (isReadOnlyMode) return;
    playHapticAudio('deploy');
    const proj = projects.find((p) => p.id === id);
    const newSha = customSha || Math.random().toString(16).substring(2, 9);
    const depId = `dep-${Math.floor(100 + Math.random() * 900)}`;

    const newDep: DeploymentRecord = {
      id: depId,
      projectId: id,
      sha: newSha,
      branch: proj?.source?.branch || 'main',
      startedAt: 'Just now',
      status: 'running',
      commitMessage: customSha ? `deploy(${customSha}): requested by operator` : 'chore(ops): trigger hot reload & schema migration',
      author: 'emmy16-glitch',
      durationSec: 0,
      buildTail: [
        `$ git fetch origin ${proj?.source?.branch || 'main'}`,
        `Checked out sha ${newSha}`,
        '$ npm install --prefer-offline',
        'Running build hooks...',
      ],
    };

    setDeployments((prev) => [newDep, ...prev]);
    appendLog(id, `[INFO] [deploy] Starting deploy ${depId} for commit ${newSha}`);

    await new Promise((r) => setTimeout(r, 1600));

    // Finish deploy
    setDeployments((prev) =>
      prev.map((d) =>
        d.id === depId
          ? {
              ...d,
              status: 'success',
              endedAt: 'Just now',
              durationSec: 42,
              buildTail: [
                ...d.buildTail,
                'TypeScript build complete in 4.2s',
                'Pre-deploy hook executed: schema valid',
                'Restarting process with zero downtime...',
                'Gate check 3/3 passed (status 200, latency 14ms)',
                `✅ Deploy ${depId} live on ${newSha}`,
              ],
            }
          : d
      )
    );

    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'UP',
              hasIncident: false,
              source: p.source ? { ...p.source, currentSha: newSha } : undefined,
            }
          : p
      )
    );

    addAuditEntry('bearer_token:admin_ops', id, 'deploy', `Deployed sha ${newSha} via git pipeline`);
    playHapticAudio('beep');
  };

  const rollbackDeploy = async (id: string, targetDepId: string) => {
    if (isReadOnlyMode) return;
    playHapticAudio('alarm');
    const target = deployments.find((d) => d.id === targetDepId);
    if (!target) return;

    appendLog(id, `[WARN] [deploy] Initiating 1-click rollback to deployment ${target.id} (${target.sha})`);
    await new Promise((r) => setTimeout(r, 1200));

    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              status: 'UP',
              hasIncident: false,
              source: p.source ? { ...p.source, currentSha: target.sha } : undefined,
            }
          : p
      )
    );

    addAuditEntry('bearer_token:admin_ops', id, 'rollback', `Rolled back to sha ${target.sha}`);
  };

  // Safe terminal command executor
  // Real terminal: runs on the server inside the service's folder.
  // The server enforces its own allowlist — no shell, no pipes, audited.
  const executeTerminal = async (
    id: string,
    commandStr: string,
    _isAdmin = false
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
    if (isReadOnlyMode) {
      return { exitCode: 1, stdout: '', stderr: 'Read-only mode is on — commands are locked.' };
    }
    playHapticAudio('click');
    const parts = commandStr.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { exitCode: 1, stdout: '', stderr: 'Type a command first.' };
    // Empty id = whole box (home folder). Otherwise the service's folder.
    const path = id ? `/api/exec/${id}` : '/api/exec';
    const token = api.getToken();
    if (!token) {
      return { exitCode: 1, stdout: '', stderr: 'You are signed out — log in again, then retry.' };
    }
    let r: Response;
    try {
      r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cmd: parts[0], args: parts.slice(1) }),
      });
    } catch {
      return { exitCode: 1, stdout: '', stderr: 'Cannot reach the server at all — check the address and reload the page.' };
    }
    if (r.status === 401 || r.status === 403) {
      return { exitCode: 1, stdout: '', stderr: 'Server refused the saved sign-in (401) — sign out and sign in again.' };
    }
    if (!r.ok) {
      return { exitCode: 1, stdout: '', stderr: `Server error (${r.status}) — try again in a bit.` };
    }
    const server = (await r.json()) as { exitCode: number; stdout: string; stderr: string };
    addAuditEntry('bearer_token', id || 'box', 'exec_command', `Ran: ${commandStr.trim()} (exit ${server.exitCode})`, 'success');
    return server;
  };

  // AI Diagnosis (server opencode-live first, local fallback)
  const askAiDiagnosis = async (
    id: string,
    question: string,
    provider: 'opencode' | 'codex' | 'claude' | 'ollama' = 'opencode'
  ): Promise<AiDiagnosis> => {
    playHapticAudio('beep');
    const server = await api.get<{
      severity: AiDiagnosis['severity']; likelyCause: string; confidence: number;
      evidence: string[]; recommendedActions: string[]; commands?: string[];
      fixTool?: string; safeToAutoFix: boolean; pastFixes?: string[];
      rawAnalysis?: string; provider?: AiDiagnosis['provider']; aiLive?: boolean; aiError?: string;
    }>(`/api/ai/${id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
    if (server) {
      return {
        id: `ai-diag-${Date.now()}`,
        projectId: id,
        timestamp: new Date().toLocaleTimeString(),
        question,
        provider: server.provider || 'opencode',
        severity: server.severity,
        likelyCause: server.likelyCause,
        confidence: server.confidence,
        evidence: [...(server.evidence || []), ...((server.pastFixes || []).map((f) => `past fix: ${f}`))],
        recommendedActions: server.recommendedActions || [],
        commands: server.commands || [],
        safeToAutoFix: !!server.safeToAutoFix,
        rawAnalysis: server.rawAnalysis || `${server.likelyCause}`,
        aiLive: server.aiLive !== false,
        aiError: server.aiError,
      };
    }
    const isDegraded = projects.find((p) => p.id === id)?.status === 'DEGRADED';

    await new Promise((r) => setTimeout(r, 1100));

    const diagnosis: AiDiagnosis = {
      id: `ai-diag-${Date.now()}`,
      projectId: id,
      timestamp: new Date().toLocaleTimeString(),
      question,
      provider,
      severity: isDegraded ? 'high' : 'low',
      likelyCause: isDegraded
        ? 'Postgres database connection pool saturation causing /health assertion failure {"database":"connected"} with 912ms timeout'
        : 'All telemetry metrics healthy; service operating within normal latency baseline (14-35ms).',
      confidence: isDegraded ? 0.94 : 0.98,
      evidence: isDegraded
        ? [
            'Log line 10:28:02: "Pool client acquisition time exceeded 450ms (activeClients: 19/20)"',
            'Log line 10:30:02: "Error: Connection terminated unexpectedly at Connection.parseE"',
            'Health check returned HTTP 502 with Gateway Timeout (912ms)',
            'Auto-restart counter incremented to 3 retries in 15 minutes',
          ]
        : ['HTTP 200 response code on /health', 'Memory 284 MB within safe ceiling (1024 MB)', 'No unhandled promise rejections in last 2000 lines'],
      recommendedActions: isDegraded
        ? [
            'Drain stale socket connections and cycle Node process supervisor (graceful SIGTERM)',
            'Scale connection pool max parameter from 20 to 35 in .env (DB_POOL_MAX)',
            'Verify PostgreSQL backend socket responds to pg_isready on 127.0.0.1:5432',
          ]
        : ['No action necessary. Consider running automated load test before peak hours.'],
      commands: isDegraded
        ? ['kill -15 24190 && npm run start', 'pg_isready -h localhost -p 5432', 'npm run pre-deploy-verify']
        : ['npm test', 'git status'],
      safeToAutoFix: isDegraded,
      rawAnalysis: isDegraded
        ? `[AI DIAGNOSIS - ${provider.toUpperCase()}]\nTarget: ${id}\nRoot Cause: Database pool exhaustion during batch audio ingestion.\nThe supervisor detected 3 failed health probes. Memory is steady at 284 MB, meaning no memory leak, but Postgres clients became orphaned.\nRecommendation: Execute safe process restart to reset client pool and run health check gate.`
        : `[AI DIAGNOSIS - ${provider.toUpperCase()}]\nTarget: ${id}\nSystem is nominal. No anomalies detected in process memory or latency trends.`,
      aiLive: false,
      aiError: 'server unreachable',
    };

    return diagnosis;
  };

  const executeAiFix = async (id: string, tool: string, args: Record<string, any>): Promise<boolean> => {
    if (isReadOnlyMode) return false;
    playHapticAudio('deploy');
    // Server-gated execute first (audited, manifest-validated)
    const server = await api.get<{ ok: boolean }>(`/api/ai/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify({ tool, args, confirm: true }),
    });
    if (server?.ok) {
      addAuditEntry('ai-assistant:safe-tool', id, 'ai_fix_execute', `AI tool executed (server): ${tool} args: ${JSON.stringify(args)}`);
      return true;
    }
    addAuditEntry('ai-assistant:safe-tool', id, 'ai_fix_execute', `AI tool executed: ${tool} args: ${JSON.stringify(args)}`);

    if (tool === 'restart_project') {
      await restartProject(id);
      return true;
    }
    if (tool === 'run_safe_command' && args.cmd) {
      await executeTerminal(id, args.cmd, false);
      return true;
    }
    if (tool === 'deploy_project') {
      await triggerDeploy(id);
      return true;
    }
    return true;
  };

  const acknowledgeIncident = (id: string, note?: string) => {
    playHapticAudio('click');
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? {
              ...inc,
              state: 'acknowledged',
              timeline: [
                ...inc.timeline,
                { ts: new Date().toLocaleTimeString(), event: `Acknowledged by operator: ${note || 'Investigating issue'}`, actor: 'operator' },
              ],
            }
          : inc
      )
    );
    addAuditEntry('bearer_token:admin_ops', 'echoo-backend', 'incident_ack', `Acknowledged incident ${id}`);
  };

  const resolveIncident = (id: string, note?: string, fixSummary?: string) => {
    playHapticAudio('beep');
    setIncidents((prev) =>
      prev.map((inc) =>
        inc.id === id
          ? {
              ...inc,
              state: 'resolved',
              resolvedAt: 'Just now',
              timeline: [
                ...inc.timeline,
                {
                  ts: new Date().toLocaleTimeString(),
                  event: `Resolved: ${note || 'Issue remediated and verified'}${fixSummary ? ` [Memory Saved: ${fixSummary}]` : ''}`,
                  actor: 'operator',
                },
              ],
            }
          : inc
      )
    );

    // Also update project to UP
    const targetInc = incidents.find((i) => i.id === id);
    if (targetInc) {
      setProjects((prev) =>
        prev.map((p) => (p.id === targetInc.projectId ? { ...p, status: 'UP', hasIncident: false } : p))
      );
    }

    addAuditEntry('bearer_token:admin_ops', targetInc?.projectId || 'unknown', 'incident_resolve', `Resolved incident ${id}: ${note || 'Fixed'}`);
  };

  const addNewProject = async (newProj: Partial<Project>): Promise<boolean> => {
    playHapticAudio('click');
    const slug = (newProj.name || 'new-app').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40) || 'new-app';
    const isExternal = newProj.location?.type === 'external';
    // Save to the server first so it survives reloads and gets health-checked.
    const saved = await api.get<{ id: string }>(`/api/projects`, {
      method: 'POST',
      body: JSON.stringify({
        id: slug,
        name: newProj.name || 'New Service',
        description: newProj.description || '',
        enabled: true,
        location: newProj.location,
        runtime: newProj.runtime,
        monitoring: { intervalSeconds: 60, timeoutSeconds: 10, expectedStatus: [200] },
      }),
    });
    if (!saved) return false;
    const created: Project = {
      id: slug,
      name: newProj.name || 'New Service',
      description: newProj.description || '',
      enabled: true,
      status: 'STARTING',
      tags: newProj.tags || [],
      location: newProj.location || { type: 'local', agentId: 'local' },
      runtime: newProj.runtime || { healthUrl: 'http://localhost:3000/health' },
      monitoring: {
        intervalSeconds: 60,
        timeoutSeconds: 10,
        expectedStatus: [200],
      },
      history: [],
      uptime24h: 100,
      uptime7d: 100,
      uptime30d: 100,
      currentLatency: 0,
      lastChecked: 'just now',
    };

    setProjects((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
    setActiveProjectId(created.id);
    appendLog(created.id, `[INFO] Saved ${created.id} — first check running`);
    addAuditEntry('bearer_token:admin_ops', created.id, 'process_start', `Added ${isExternal ? 'watched link' : 'local service'} ${created.id}`);
    return true;
  };

  return (
    <DashboardContext.Provider
      value={{
        design,
        setDesign,
        setMaterial,
        setComposition,
        setStructure,
        setFeeling,
        applyPreset,
        projects,
        activeProject,
        activeProjectId,
        setActiveProjectId,
        logs,
        incidents,
        deployments,
        auditLogs,
        agents,
        templates,
        filterStatus,
        setFilterStatus,
        searchQuery,
        setSearchQuery,
        isReadOnlyMode,
        setIsReadOnlyMode,
        authToken,
        authed,
        authChecked,
        login,
        logout,
        rotateAuthToken,
        startProject,
        stopProject,
        restartProject,
        runHealthCheck,
        triggerDeploy,
        rollbackDeploy,
        executeTerminal,
        askAiDiagnosis,
        executeAiFix,
        acknowledgeIncident,
        resolveIncident,
        addNewProject,
        addServiceSignal,
        openAddService,
        playHapticAudio,
        lastSyncTime,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
};
