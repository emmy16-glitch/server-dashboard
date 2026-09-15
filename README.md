# server-dashboard

One place to monitor all hosted projects (server + Vercel/other).

- Status monitor: UP / DEGRADED (404/500) / DOWN + latency
- Local runner: start/stop/restart Node/Python projects (tiny PM2 replacement)
- External projects: just paste a Vercel URL, it gets monitored too
- Web terminal (scoped to project dirs)
- AI helper: shells out to `opencode` / `codex` / `claude` with logs + status context to explain errors

Stack: Node + plain HTML (lightweight, works in Proot/Termux).

Status: planning / v1 spec next.
