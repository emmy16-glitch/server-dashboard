# MCP tools

Two directions: **we serve** dashboard tools so any MCP-capable agent (Claude Code, Codex, Ollama RAG) can operate projects; **we consume** a small set of external MCP servers where they beat hand-rolled fetch.

Manifest endpoint (planned): `GET /api/mcp/manifest` → JSON Schema for every tool below.

## Served tools (dashboard as MCP server)

| Tool | Args | Side effects | Confirm? |
|---|---|---|---|
| `get_status` | `{ projectId }` | none (read) | no |
| `get_logs` | `{ projectId, lines?: 200, query?: string }` | none; uses log-retrieval spans | no |
| `inspect_package` | `{ projectId }` | none; package.json + manager + scripts + port | no |
| `check_port` | `{ port, host?: "localhost" }` | none; TCP connect, 5s timeout | no |
| `get_incident` | `{ incidentId }` \| `{ projectId, state?: "open" }` | none | no |
| `get_memory` | `{ projectId }` | none; past fixes + runbook | no |
| `search_docs` | `{ query, sources?: ["github","docs"] }` | outbound fetch (allowlist) | no; off by default per project |
| `restart_project` | `{ projectId }` | restarts local process | **yes** (confirm token) |
| `run_safe_command` | `{ projectId, cmd, args[] }` | exec in cwd jail, allowlisted | **yes** |
| `deploy_project` | `{ projectId, sha?: "latest" }` | git pull/build/restart, rollback on fail | **yes** |
| `ack_incident` / `resolve_incident` | `{ incidentId, note? }` | updates incident + memory | yes (resolve writes memory) |

Rules: read tools need read scope; mutating tools need write scope + confirm token + audit entry. Model output never executes directly — only these tools execute, with `shell:false`, cwd jail, timeouts, output caps (see `security.md`).

## Consumed external MCP servers (lazy, Phase 5)

| Server | Used for | Why not hand-rolled |
|---|---|---|
| GitHub | issues/PRs/diffs for diagnosis, deploy metadata | auth + pagination + search already solved |
| Sentry | real stack traces → incident enrichment | no equivalent in logs alone |
| Context7 | fresh dep docs on version errors | version-aware docs fetch |
| Fetch / Brave Search | `search_docs` backends | hardened fetch + search primitives |
| SQLite | history queries post-migration | query > file scan at scale |
| Memory-graph (pattern) | validates `memory/*.json` shape | no graph DB in v1 |

Skipped: maps, drive/obsidian, media (blender/figma), research (zotero/notebooklm/phoenix), finance/stripe — off-mission. Playwright/Chrome DevTools reserved for Phase 4+ browser checks on a bigger host.

## Reliability note
Pin server versions; several reference `modelcontextprotocol/*` servers are archived. Prefer the **pattern** (interface + scopes) first, run the process second, and keep every external behind `server/integrations/mcp-clients/*` with timeouts + redaction.
