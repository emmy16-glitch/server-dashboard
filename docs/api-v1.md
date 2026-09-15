# API v1

Base: `http://host:3001`. Auth: `Authorization: Bearer <token>` on all `/api/*` except `/api/health`. Read-only share links use `?share=<ro-token>` and only hit `GET` status/projects.

## Projects
- `GET /api/projects` → `{ projects: [...] }` (schema: `registry-schema.md`)
- `POST /api/projects` body `{ name, location:{type,cwd|url}, runtime:{command,port,healthUrl}, source? }` → `{ id }`. Validates: cwd inside allowed root, port 1024–65535, URL http(s).
- `PATCH /api/projects/:id` — update runtime/monitoring/notifications
- `DELETE /api/projects/:id` — stops process first if local + running

## Status
- `GET /api/status` → `{ "<id>": { status, code, latencyMs, checkedAt, uptime24h, restarts } }`
- `GET /api/status/:id/history?range=24h|7d|30d` → `{ checks: [{ts,code,latencyMs,error}] }`
- `GET /api/health` (unauth, for tunnel/loadbalancer) → `{ ok:true }`

## Process (local only; external → 400)
- `POST /api/process/:id/start|stop|restart` → `{ ok, pid? }`
- `GET /api/process/:id` → `{ pid, alive, cpuPct, memMB, uptimeSec, restarts }`

## Logs
- `GET /api/logs/:id?lines=200` → `{ lines: ["..."] }` (capped, newest last; secrets redacted)
- SSE `GET /api/logs/:id/stream` — tail-follow (Phase 2)

## Deployments (local git)
- `POST /api/deploy/:id` body `{ sha?: "latest"|"<sha>", skipBuild?: bool }` → `{ deploymentId }` (async; poll below)
- `GET /api/deploy/:id` → list `{ id, sha, branch, startedAt, endedAt, status, buildTail }`
- `POST /api/deploy/:id/rollback` body `{ toDeploymentId }` → re-checkout + restart + verify

## Incidents
- `GET /api/incidents?project=:id&state=open` → `{ incidents: [...] }`
- `POST /api/incidents/:incidentId/ack` body `{ note? }`
- `POST /api/incidents/:incidentId/resolve` body `{ note? }`

## Terminal (safe mode)
- `POST /api/exec/:id` body `{ cmd: "npm", args: ["run","build"], timeoutSec?: 30 }` → `{ exitCode, stdout, stderr, truncated }`. No `shell:true`, no chaining. Denied commands → 403 + audit `denied`.

## AI
- `POST /api/ai/:id/ask` body `{ question: "why 404 on /api/login?" }` → `{ severity, likelyCause, confidence, evidence[], recommendedActions[], commands[], safeToAutoFix }` + raw text. Runs server-side CLI with timeout 60s.
- `POST /api/ai/:id/execute` body `{ tool: "restart_project"|"run_safe_command"|"deploy_project", args }` → requires confirm token for mutating tools + audit.

## Errors
`{ error: { code: "NOT_FOUND"|"VALIDATION"|"FORBIDDEN"|"CONFLICT"|..., message } }` with matching HTTP status. Mutating errors never leak stack/env.
