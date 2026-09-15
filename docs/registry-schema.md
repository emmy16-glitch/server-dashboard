# Registry schema (projects.json)

Stable `id` (slug, never renamed). Display `name` can change. `agentId: "local"` in v1; remote agents later.

```json
{
  "version": 1,
  "agents": [{ "id": "local", "hostname": "pixel-server", "platform": "android/proot" }],
  "projects": [
    {
      "id": "echoo-backend",
      "name": "Echoo Backend",
      "enabled": true,
      "location": { "type": "local", "agentId": "local", "cwd": "/root/Software_projects/echoo/backend" },
      "runtime": {
        "command": "npm",
        "args": ["run", "start"],
        "port": 8000,
        "healthUrl": "http://localhost:8000/health",
        "autoRestart": true,
        "maxRestarts": 5,
        "restartCooldownSec": 5,
        "startOnBoot": true,
        "startupTimeoutSec": 20,
        "envFile": ".env"
      },
      "source": { "provider": "github", "repository": "owner/echoo", "branch": "main", "deployOnPush": false },
      "monitoring": {
        "intervalSeconds": 30,
        "timeoutSeconds": 10,
        "expectedStatus": [200, 301, 302],
        "expectedBody": null,
        "healthConfig": { "type": "http", "json": { "database": "connected" } }
      },
      "notifications": { "down": true, "recovered": true, "deploymentFailed": true, "crashLoop": true },
      "template": "node-api"
    },
    {
      "id": "digistream",
      "name": "DigiStream",
      "enabled": true,
      "location": { "type": "external", "agentId": "local", "provider": "vercel" },
      "runtime": { "healthUrl": "https://digistream.vercel.app", "autoRestart": false },
      "monitoring": { "intervalSeconds": 60, "timeoutSeconds": 10, "expectedStatus": [200] },
      "notifications": { "down": true, "recovered": true }
    }
  ]
}
```

## Validation rules
- `id`: `^[a-z0-9-]{2,40}$`, unique.
- local: `cwd` must exist and be inside `allowedRoots` (e.g. `/root/projects`, `/root/Software_projects`); `command` from allowlist in safe mode; `port` free or owned by same project on start.
- external: `healthUrl` must be `https?://`; no `cwd/command`.
- `expectedStatus` default `[200]`; v1 treats 404/500 as DEGRADED (kept for AI context), others non-2xx per config.
- Secrets (tokens, `.env` values) never stored here — only paths + masked names.

## Templates (Phase 3)
`template` references `templates/<name>.json`: `{ detect: ["package.json"], install, build, start, healthPath }`. Autodetect fills missing `runtime`/`monitoring` on `POST /api/projects` when `template: "auto"`.
