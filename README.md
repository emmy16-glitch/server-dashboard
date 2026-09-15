# server-dashboard — personal self-hosting control plane

> **One secure control plane for monitoring, deploying, debugging, and recovering all your applications — regardless of where they run.**

Monitor local processes on this server + Vercel / Railway / Render URLs from one page. Start/stop/restart, deploy via git, tail logs, open a scoped terminal, and ask AI why something is down — without SSH-ing around.

Inspired by UptimeRobot (monitoring) + PM2 (processes) + Vercel (deploys) + Portainer (ops UI) + Grafana/Loki (history/logs) + GitHub Actions (deploy pipeline) + a safe AI assistant.

## Why this exists

- Projects run manually (`npm start`, `node server.js`, `python app.py`) with no supervisor. A crash or 404/500 goes unnoticed.
- Projects live in different places: this box (`/root/projects`, `/root/Software_projects/echoo`), Vercel, other hosts. No single list of "what should be up".
- Debugging means: find the folder, remember the port, re-run, scroll logs, guess. We want: open dashboard → red card → logs → terminal → AI diagnosis → restart/deploy → green.

## What v1 does (MVP scope)

1. **Registry** — one `projects.json`: local (we run it) or external (we only ping it).
2. **Health monitoring** — HTTP checks every 30s → `UP / DEGRADED / DOWN / STARTING / STOPPED` + latency + uptime %.
3. **Process control** — Start / Stop / Restart local Node/Python apps (tiny PM2 replacement, no Docker).
4. **Log viewer** — tail `logs/<id>.log`, rotation + cap.
5. **Auth from day one** — token login; control APIs never public. Monitoring cards can be shared read-only.
6. **Deploy button (local git)** — `git pull → npm install → build → restart → health-verify → rollback on fail`, with deployment record.
7. **Scoped terminal (safe mode)** — run approved commands in the project's `cwd` with timeout, output cap, audit log. No full PTY in v1.
8. **AI helper (Explain → Propose → Execute)** — structured diagnosis from status+logs, suggests commands, executes only approved safe tools with audit.

Post-v1: incidents, Telegram/Discord alerts, SSL/disk/memory checks, multi-server agents, templates.

See `docs/` for details: `architecture.md`, `api-v1.md`, `registry-schema.md`, `security.md`, `threat-model.md`, `integrations-plan.md` (which of 50 trending open-source repos we borrow from, host as templates, or skip — with reasons).

## Quick mental model

```
+------------------+      poll 30s      +-------------------+
|  Dashboard UI    | <----------------> | server.js (:3001) |
|  cards, logs,    |  REST + SSE        |  api/ + core/     |
|  terminal, AI    |                    +--------+----------+
+------------------+                             |
        | read-only share link (optional)        | spawn / fetch / git / AI CLI
        v                                        v
  public status page                  +---------+----------+
                                      | projects | logs | status |
                                      | deploys  | incidents | audit |
                                      +---------+----------+
                                      file JSON in v1 → SQLite when history grows
```

- **Registry, not autodiscovery.** If it's not in `projects.json`, it's not monitored.
- **Local vs external:**
  - `local`: we `spawn` it, we ping `http://localhost:PORT/health`, we own logs + restarts + deploys.
  - `external` (vercel/railway/render/other): we only ping the URL + track uptime. Control happens in that provider (link out + optional API token later).
- **Monitor → incident → notify → recover.** Failed checks create an incident, trigger auto-restart policy (e.g. 3 retries), then alert (Telegram first).
- **AI never gets raw shell.** It gets tools: `get_status, get_logs, check_port, restart_project, deploy_project, run_safe_command`. Free-form shell only in explicit Admin mode with audit + confirm.

## Project lifecycle (per app)

Each project shows: status, uptime (process), CPU/mem (via `/proc`), restart count, last deploy (commit/branch/time), current git sha, port + public URL, environment (`local | vercel | railway | render | other`), health history.

Auto-recovery policy (local):

```text
on crash/exit or 3 failed checks in a row:
  wait 5s → restart (attempt 1/3)
  verify /health within 20s
  if still failing after 3 attempts → mark DOWN + open incident + alert
  respect restart policy: maxRestarts, cooldown, startOnBoot
```

Graceful shutdown (`SIGTERM` → wait → `SIGKILL`), startup probe, dependency check (port free? `.env` present?), lock file so two dashboard instances don't fight over one project.

## Deployments (local git)

```text
Deploy #18 (echoo-backend @ a83f91d, main)
  git fetch + checkout → npm install → build → pre-deploy cmd
  → restart → wait healthy (3 OK checks) → post-deploy cmd
  on health fail → rollback to previous sha + mark deployment failed
```

Actions: deploy latest, deploy chosen sha, restart w/o pull, rollback, view diff/files, full build log. Pre/post hooks per project (e.g. `npm run migrate`). Vercel projects: deep-link to Vercel deployment + (later) trigger via Vercel API, never fake local control.

## Monitoring (v1 + next)

v1: HTTP status + latency + process-alive. Stores `{ ts, code, latencyMs, error }` → 24h/7d/30d uptime, p50/p95/p99 later.

Next checks (pluggable): expected body/JSON (`{"database":"connected"}`), TCP port, PID alive, SSL expiry, disk/memory pressure, DB reachability, custom `healthConfig` per project. Example in `docs/api-v1.md`.

## Incidents & notifications

A red card is not enough — v1 records an incident `{ id, projectId, startedAt, cause, timeline[], recoveryAttempts, resolvedAt }` with ack + notes + maintenance window ("don't alert 02:00–03:00"). Alert order: Telegram → Discord webhook → Email → generic webhook → Slack. Rules, not hardcodes: "Telegram me if DOWN > 60s; Discord if >5 restarts/10min". Dedupe + auto-resolve on recovery.

## Terminal & AI safety (read this)

Terminal is RCE if done wrong. v1 rules:

- Auth + short-lived session token, per-project permission, `cwd` jail, timeout (30s), output cap (100KB), env-secret masking, every command in `audit.json`, destructive commands need confirm, optional read-only mode.
- `spawn(cmd, args, { cwd, shell: false })` — no `bash -c "user;injection"`. Two modes: **Safe** (allowlisted tools) and **Admin** (free shell, explicit grant + audit).
- AI levels: **Explain** (read-only analysis) → **Propose** (plan for approval) → **Execute** (only tool calls, logged, reversible where possible). No autonomous arbitrary exec.

Full rules: `docs/security.md` + `docs/threat-model.md`.

## Multi-server (later, designed now)

One central dashboard + tiny agents that dial out (no inbound ports):

```text
Central ──HTTPS/WS── Agent A (this Termux box) ── Agent B (VPS) ── Agent C (Pi)
```

Agent advertises `{ hostname, platform, mem, projects, version }`; central aggregates status/logs/deploys. v1 is single-server but IDs (`agentId`, stable `id` not display name) already assume this. See `docs/architecture.md`.

## Templates & autodetect (later, hooks in v1)

`Node API / Express / Next.js / Flask / FastAPI / static / Vercel` templates define `{ detect, install, build, start, healthPath }`. v1 already stores `runtime` + `source` fields so templates slot in; autodetect (`package.json` → start/port/health) lands in Phase 3.

## This server's constraints

Proot-Ubuntu on Termux, Node v20, **no** Docker/PM2/Nginx/systemd. So: stdlib-first Node (`http` + one `ws` dep max), file JSON storage in v1 (migrate to SQLite when checks/deploys/incidents need querying), `nohup node server.js &` + tunnel (ngrok/Cloudflare) for access, keep-alive script later. No native modules (`better-sqlite3`, `node-pty`) in v1 — they break in Proot.

## Roadmap

- **Phase 1 — Secure monitoring MVP:** registry, HTTP checks, status cards, latency, log viewer, auth, rotation + AI provider switcher (`opencode|codex|claude|ollama` stub) + keyword log-retrieval. Terminal/AI *read-only only*.
- **Phase 2 — Process control:** start/stop/restart, PID tracking, crash detect, auto-restart, cpu/mem, boot recovery, streaming logs.
- **Phase 3 — Deploy engine + templates:** git pull/build/verify/rollback, history, pre/post hooks, Vercel link + API trigger, 17 app/dev templates + autodetect.
- **Phase 4 — Incidents & alerts:** incident records, maintenance, Telegram/Discord, `body-json/tcp/ssl/disk/mem` checks (`browser` interface only), alert rules.
- **Phase 5 — AI ops:** structured diagnosis JSON, incident memory (`memory/*.json`), MCP tools manifest, grounded docs lookup, proposed fixes, approved execution, fix history, incident reports.
- **Phase 6 — Multi-server:** agents, remote control, server overview, team RBAC (agents also serve MCP tools).

Full borrow/host/skip triage: `docs/integrations-plan.md`.

## Repo layout (target)

```text
README.md
docs/architecture.md
docs/security.md
docs/api-v1.md
docs/registry-schema.md
docs/threat-model.md
docs/integrations-plan.md
docs/mcp-tools.md (phase 5)
templates/ (phase 3)
memory/ (phase 5, runtime, gitignored)
server/  (phase 2+)
public/  (phase 2+)
```

## Status

Planning — this README + `docs/` is the contract. No runtime code yet. Next: implement Phase 1 MVP.
