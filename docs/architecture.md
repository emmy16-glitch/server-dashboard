# Architecture

## Goal
Single-node-first control plane that can grow into multi-server without rewrite. Stdlib-first Node, file storage in v1, clear seams for SQLite + agents later.

## Runtime layout (target)

```text
server/
  index.js               # http server :3001, routing, auth gate, SSE
  api/
    projects.js          # CRUD registry
    status.js            # latest + history
    process.js           # start/stop/restart (local only)
    deployments.js       # git pull/build/verify/rollback
    incidents.js         # open/ack/resolve/notes
    terminal.js          # POST /exec (safe mode)
    ai.js                # POST /ai-ask (tool-gated)
    settings.js          # AI CLI choice, alert channels, tokens
  core/
    project-registry.js  # load/validate projects.json, stable id
    process-manager.js   # spawn/kill, pid file, lock, restart policy, backoff
    health-monitor.js    # 30s loop, timeout 10s, classify UP/DEGRADED/DOWN
    deployment-manager.js# git ops, hooks, health gate, rollback pointer
    incident-manager.js  # dedupe, timeline, auto-resolve, maintenance
    notifier.js          # channel abstraction (telegram/discord/email/webhook/slack)
    audit.js             # append-only audit.json
    resources.js         # /proc cpu/mem/disk per pid + host
  integrations/
    ai/{opencode,codex,claude}.js   # uniform { diagnose(context) } wrapper
    github.js            # sha/branch/diff (git CLI in v1, API later)
    vercel.js            # deep links now, API trigger later
    telegram.js discord.js
  storage/
    projects.json deployments.json incidents.json status-history.json audit.json
    (.sqlite later — same access functions, swapped backend)
public/
  index.html app.js styles.css   # static, fetch + SSE, no build
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
