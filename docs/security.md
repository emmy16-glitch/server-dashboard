# Security

> Monitoring can be public. Process control, terminal, deploys, and AI execution must never be public.

## Auth (v1, mandatory before exec/AI land)
- Bearer token in `Authorization` header (32+ random bytes, stored hashed server-side, rotatable in settings). All `/api/*` except `/api/health` require it.
- Short-lived browser session cookie (`HttpOnly, SameSite=Lax`, 12h) issued after token login; CSRF token on mutating POSTs.
- Optional read-only share token: only `GET /api/projects`, `/api/status`, `/api/logs` with no mutating scope.
- Rate limit: 60 req/min/IP on auth + exec endpoints; lockout after 10 bad tokens/5min.

## Transport
- Localhost by default. Any tunnel (ngrok/Cloudflare) must use HTTPS. Document the exact tunnel command; never print token in URL. HSTS when behind TLS terminator.

## Terminal hardening
- Per-project allowlist + `cwd` jail (reject `..` escapes, symlinks outside root).
- `spawn(cmd, args, { cwd, shell: false })` only. No `bash -c`, no `&&`, `;`, `|`, `$()` passthrough. Block env exfil (`env`, `printenv` need Admin).
- Timeout 30s default, kill tree on timeout; 100KB output cap; secrets redaction (`KEY|TOKEN|SECRET|PASSWORD=***`).
- Two modes: `safe` (default, allowlisted) / `admin` (free shell, explicit per-session grant + typed confirm for destructive cmds + full audit). v1 ships `safe` only; `admin` behind second flag.
- Read-only role: status + logs only.

## Process/deploy safety
- Validate `cwd`, port ownership, lock file per project (`locks/<id>.lock`) to prevent double-start.
- Deploy: verify git remote + sha exists, run hooks with same jail/timeout, health-gate before marking live, auto-rollback, keep last 2 good shas.
- No secrets in logs/deploy output; mask `.env` values; store notification tokens in `settings.json` mode 600, never in registry.

## Data safety
- Log rotation: 5MB/file, keep 3, cap tail API at 500 lines.
- Registry backup: timestamped copy before every write + `backups/` keep 20.
- Safe shutdown: `SIGTERM` → forward to children → 10s grace → `SIGKILL`; pidfile cleanup.
- Audit: append-only `audit.json` `{ ts, actor, projectId, action, argsHash, result }` for exec/deploy/AI-execute/auth events. Never log raw command output with secrets.

## Dependencies
- Prefer stdlib; allow `ws` only in v1. No native modules. `npm audit` before each release; pin versions.
