# server-dashboard

One page to see if all your projects are alive — whether they run on this server or on Vercel / any other host — and fix them from the same place with a terminal + AI helper.

## The problem

Projects are started manually (`npm start`, `node server.js`, `python app.py`) with no process manager. When one crashes, hangs, or starts returning 404/500, nobody notices until someone opens the URL. There is no central list of what's supposed to be up, where it runs, or what its logs said.

## What we want

A lightweight dashboard, itself hosted on this server, that:

1. **Monitors everything** — local ports + external URLs — and shows GREEN / RED at a glance with latency and last-check time.
2. **Hosts easily** — add a folder + start command + port from the UI and it runs on the server. Or paste a Vercel URL and just monitor it, no local process.
3. **Controls processes** — Start / Stop / Restart from the browser (a tiny PM2 replacement, no Docker needed).
4. **Shows logs** — tail of stdout/stderr per project so a 404/500 can be inspected immediately.
5. **Has a terminal in the browser** — run commands scoped to that project's folder (`npm install`, `ls`, `cat`, `git pull`).
6. **Has an AI helper** — click "Ask AI why down" and it sends status + recent logs + `package.json` snippet to whatever AI CLI you have installed (`opencode`, `codex`, `claude`) and streams the diagnosis back. You can install/swap any AI, the dashboard just shells out to it.

## How it works (architecture)

```
Browser (public/index.html)
   |  fetch / ws (poll every ~15s)
   v
server.js (Node, plain http, :3001)
   |-- projects.json  (registry: source of truth)
   |-- monitor.js     (loop: fetch each url, write status.json)
   |-- runner.js      (spawn/kill node/python, pipe to logs/*.log, track pids)
   |-- logs/          (per-project stdout/stderr)
   |-- /api/exec      (scoped command execution for web terminal)
   `-- /api/ai-ask    (builds prompt from status+logs, shells to AI CLI)
```

- **Registry, not autodiscovery.** `projects.json` lists what *should* be up. Each entry is either `local` (we manage the process) or `external` (we only ping the URL).
- **Monitor loop.** Every 30s: `fetch(url, timeout 10s)` → classify → append to history. No agents to install on projects.
- **Runner.** `child_process.spawn` with `cwd` set to the project dir. PID stored in `.pids.json`. Output appended to `logs/<name>.log` (capped, e.g. last 2000 lines). Restart = kill + spawn.
- **UI.** Static HTML, no build step. Cards poll `/api/status`. Works on phones.
- **Dashboard hosting.** Runs as `node server.js` on `:3001`. Exposed via tunnel (ngrok / Cloudflare) since this host has no public IP / reverse proxy.

## Project types

| Type | Example | Dashboard does |
|------|---------|----------------|
| `local` | `/root/Software_projects/echoo/backend` on `:8000` | spawn process, ping `http://localhost:8000/health`, keep logs, start/stop |
| `external` | `https://myapp.vercel.app` | only ping URL + show status, link out, no process control |

## Status model

- `UP` — 200–399
- `DEGRADED` — reachable but 404 / 500 / wrong body (saves response snippet for AI)
- `DOWN` — timeout, ECONNREFUSED, or local PID dead
- Each check stores `{ timestamp, code, latencyMs, error }` → uptime % + latency sparkline in UI.

## Planned registry format

```json
{
  "projects": [
    {
      "name": "echoo-backend",
      "type": "local",
      "cwd": "/root/Software_projects/echoo/backend",
      "startCmd": "npm run start",
      "port": 8000,
      "url": "http://localhost:8000/health"
    },
    {
      "name": "digistream",
      "type": "external",
      "host": "vercel",
      "url": "https://digistream.vercel.app"
    }
  ]
}
```

## Planned API (v1)

- `GET /api/projects` — list registry
- `POST /api/projects` — add local or external project
- `GET /api/status` — latest check per project + history
- `POST /api/:name/start|stop|restart` — process control (local only)
- `GET /api/:name/logs?lines=200` — log tail
- `POST /api/:name/exec` — `{ cmd }`, run in `cwd`, return output (terminal backend)
- `POST /api/:name/ai-ask` — `{ question }`, builds context (status + logs + package.json), shells to configured AI CLI, streams answer

## Web terminal (v1 scope)

Not a full PTY (`node-pty` doesn't work reliably in Proot). v1 = command box + output pane: send a command, run it in the project's `cwd` with timeout + allowlist, stream back stdout/stderr. Scoped so one project can't `rm -rf /root/other`. Full xterm PTY is a later upgrade.

## AI helper (v1 scope)

The dashboard does **not** embed an LLM key. It builds a prompt like:

> Project X is DOWN. Last check: ECONNREFUSED after 10s. Last 100 log lines: [...] package.json start script: [...] What likely failed and what command should I run?

...then executes the AI CLI you chose in settings (`opencode run "..."`, `codex exec "..."`, etc.) inside the project dir and returns the output. Swap/install any AI without changing the dashboard.

## Constraints (this server)

- Proot-Ubuntu on Termux (Android), Node v20, no Docker / PM2 / Nginx / systemd.
- So: file-based storage (`projects.json`, `status.json`, `logs/`), zero Docker dependency, `npm install` with minimal deps (prefer stdlib `http` + tiny `ws` only).
- Dashboard itself must survive restarts: documented as `nohup node server.js &` + tunnel command, later a simple keep-alive script.

## Roadmap

- [x] Repo + vision (this README)
- [ ] v1 spec: exact API shapes + UI wireframe
- [ ] v1 build: registry + monitor + runner + log viewer + status UI
- [ ] v1 build: exec endpoint + terminal pane
- [ ] v1 build: ai-ask endpoint + settings for AI CLI
- [ ] v1 hardening: auth token, allowlist, log rotation, keep-alive
- [ ] Later: uptime alerts (Telegram/email), latency charts, full PTY, Docker support if host changes

## Status

Planning. No implementation yet — README is the contract. Next commit will be the v1 API spec.
