# Architecture

## Goal
Single-node-first control plane that can grow into multi-server without rewrite. Stdlib-first Node, file storage in v1, clear seams for SQLite + agents later.

## Runtime layout (target)

```text
server/
  index.js               # http server :3001, routing, auth gate, SSE
  package.json
  core/
    store.js             # JSON read/write + timestamped backups (keep 20)
    auth.js              # Bearer (hashed, rotatable) + sessions + share token
    monitor.js           # per-project interval checks, UP/DEGRADED/DOWN, history
    incidents.js         # auto-open on 3 fails, auto-resolve, dedupe, timeline
    notifier.js          # telegram -> discord -> email -> webhook -> slack
    process.js           # spawn/kill cwd-jailed, locks, pid probe, /proc stats
    logs.js              # tail/cap/rotation/redaction
    retrieval.js         # keyword log spans for AI grounding
    memory.js            # memory/<project>.json runbook + past fixes
    audit.js             # append-only audit log
  templates/             # 11 templates (dev + external) + autodetect endpoint
  storage/
    projects.json        # THE registry (tracked). Rest is runtime (gitignored):
                         # settings/sessions/history/incidents/deployments/audit
  memory/                # runtime incident memory (gitignored)
  logs/ locks/ backups/  # runtime (gitignored)
  public/                # web/ build output (gitignored, served statically)
web/                     # premium UI (Vite 7 + React 19 + Tailwind, singlefile)
  src/context/DashboardContext.tsx  # store + 30s server sync, mock fallback
  src/lib/api.ts                    # token client
logs/<projectId>.log
```

## Key flows

**Check:** `health-monitor` fetch(url, 10s) → `{ ts, code, latencyMs, error, bodySnippet }` → update memory + append history → if 3 fails → `incident-manager.open` → `process-manager.maybeRestart(local)` → `notifier.evaluate(rules)`.

**Start (local):** validate cwd inside allowed root → check lock → `spawn(cmd, args, { cwd, shell:false, env: filtered })` → pipe to log (cap 2000 lines, rotate 5MB) → write pid → startup probe (3× /health in 20s) → `STARTING→UP` or `DOWN` + incident.

**Deploy (local):** snapshot current sha → `git fetch && checkout <sha>` → install → build → pre-hook → restart → health gate → post-hook → record deployment; on gate fail → checkout previous sha → restart → mark failed.

**Exec:** auth + per-project perm → validate against allowlist (safe mode) → `spawn` with cwd jail, 30s timeout, 100KB cap → audit entry → return output.

**AI ask:** gather `get_status + get_logs(100) + package.json + last incident` → template prompt → run configured CLI in cwd with timeout → parse structured JSON if present → return `{ summary, likelyCause, evidence[], commands[], safeToAutoFix }`. Execute path only via tool calls, never raw shell from model.

## Storage evolution
v1: JSON files (zero deps, survives Proot). Migrate to SQLite when storing > ~50k checks or needing queries (uptime %, p95, incidents by project). Access goes through `storage/*.js` so swap is local. Never store secrets in logs; env masked.

## Multi-server seam
`project.location = { type: local|external, agentId }`. v1: `agentId: "local"`. Later: agents WS-dial central, send heartbeat + status batch, receive `{ start, stop, deploy, exec }` jobs. Central never dials in (NAT-friendly). IDs already stable (`id`, not display name).

## Non-goals for v1
Full PTY, native modules, Docker/K8s control, team RBAC, metrics DB. Those are Phase 5–6.
