# Integrations plan — what we borrow from 50 open-source repos

Triage of the repo lists against one question: **does it make the control plane better at monitoring, deploying, debugging, or recovering apps on a Proot/Termux box with Node stdlib-first?**

Rule: borrow **patterns + provider interfaces**, not heavy dependencies. No torch, no Playwright, no native modules in v1.

## Tier 1 — integrate as patterns (core upgrades)

### 1. Local AI backend (Ollama + Open WebUI / LibreChat pattern)
- **Why:** free, private, offline diagnosis when Claude/Codex keys are missing. Fits self-hosting story.
- **Change:**
  - `server/integrations/ai/ollama.js` → `POST http://localhost:11434/api/chat` with `{ model, messages, stream:false }`, 60s timeout.
  - `settings.json`: `aiProvider: "opencode"|"codex"|"claude"|"ollama"`, `ollama: { baseUrl, model: "llama3.1:8b" }`.
  - Same structured output contract as other providers: `{ severity, likelyCause, confidence, evidence[], recommendedActions[], commands[], safeToAutoFix }`.
  - Ollama itself is **optional external process** (own project entry in dashboard), never bundled. Small models (3B–8B) for explain; cloud CLI for deep fixes.
- **Borrowed from:** Ollama (runtime + OpenAI-compatible API), Open WebUI/LibreChat (multi-model UI idea → our provider switcher).

### 2. Unified integrations layer (Nango pattern)
- **Why:** Telegram/Discord/Vercel/GitHub each need auth, refresh, retry, rate-limit, tenant isolation. Don't re-solve per file.
- **Change:**
  - `server/integrations/{telegram,discord,email,webhook,slack,vercel,github}.js` behind `server/core/integration-runtime.js`: `auth()`, `send()`, `callApi()`, retries with backoff, redacted logging.
  - Nango Cloud remains **optional later**; interface is compatible so we can swap without touching callers.
- **Borrowed from:** Nango (auth + functions + proxy + observability primitives).

### 3. Dashboard as MCP tools (MCP-Agent pattern)
- **Why:** lets external Claude/Codex/agents operate the dashboard safely instead of screen-scraping.
- **Change:**
  - New `docs/mcp-tools.md` manifest + `GET /api/mcp/manifest`:
    `get_status, get_logs, check_port, inspect_package, restart_project, deploy_project, run_safe_command` — each with JSON schema, side-effect flag, confirm-required flag.
  - Mutating tools require confirm token + audit (same as `/api/ai/:id/execute`).
- **Borrowed from:** lastmile-ai/mcp-agent (tool connect pattern), Pydantic AI (type-safe schemas → we validate with a tiny validator, no dep).

### 4. Persistent incident memory (Letta pattern)
- **Why:** diagnosis should improve per project instead of starting blank every time.
- **Change:**
  - `memory/<projectId>.json`: `{ incidents: [{ cause, signals, fixThatWorked, ts }], runbook: ["..."], prefs: {} }`, capped (e.g. last 50).
  - On `ai-ask`: inject top-3 similar past incidents (keyword overlap on error + code) + runbook.
  - On resolve: `POST /api/incidents/:id/resolve { fixSummary }` appends to memory. No Letta dep.
- **Borrowed from:** Letta/MemGPT (memory blocks + continual learning, simplified to file JSON).

### 5. Log RAG for long logs (PageIndex / LlamaIndex pattern)
- **Why:** "last 100 lines" misses the real traceback 2000 lines up.
- **Change:**
  - `server/core/log-retrieval.js`: split `logs/<id>.log` into spans (by blank line + `Error|Traceback|EADDRINUSE|404|500|FAIL`), score by keywords from status error + recency, return top spans ≤ ~8KB.
  - No vector DB in v1 (keyword + recency). Interface `retrieveLogs(id, query)` ready for embeddings later.
- **Borrowed from:** PageIndex (reasoning over long docs), LlamaIndex (chunk + retrieve), DSPy deliberately **skipped** (prompt optimizer overkill for v1).

### 6. Synthetic checks (Browser-Use / Skyvern pattern, Phase 4+)
- **Why:** HTTP 200 ≠ login works. Real user-flow checks catch DEGRADED earlier.
- **Change:**
  - `monitoring.checks`: `{ type: "http" }` in v1; interface reserves `{ type: "tcp"|"ssl"|"disk"|"mem"|"browser"|"body-json" }`.
  - `browser` provider shell later (Playwright/Puppeteer on a bigger host, never in Proot v1). v1 ships `http + body-json assert + tcp port` only.
- **Borrowed from:** Browser-Use/Skyvern (robust selectors/flows idea); BrowserGym explicitly **skipped** (eval harness, not monitor).

### 7. Grounded web lookup (Agent-Reach pattern)
- **Why:** unknown errors need docs/GitHub issues, not hallucination.
- **Change:**
  - AI tool `search_docs(query)` → allowlisted fetch (github raw, docs sites), 5s timeout, 50KB cap, quoted as untrusted context. Off by default, per-project enable.
- **Borrowed from:** Agent-Reach (multi-source access, scoped down).

### 8. Launch readiness + free-tier ops (vibe-coding sites pattern)
- **Why:** free alert channels + pre-launch gate fit personal platform.
- **Change:**
  - `templates/launch-checklist.json`: asserts `has /health, has auth, has backup, has STARTING→UP probe, has rollback sha`.
  - Notifier order stays Telegram → Discord → Email → webhook → Slack (all free tiers). `free-for.dev / freepublicapis` as curated links in docs, not deps.

## Tier 2 — host as one-click templates (no code integration)

Each gets `templates/<name>.json`: `{ detect, install, build, start, healthPath, port }`. Dashboard only spawns + monitors them.

| Template | Health path | Notes |
|---|---|---|
| stirling-pdf | `/` | PDF tools, Java — heavy; VPS-only note |
| immich | `/api/server-info/ping` | needs DB; link + monitor first, full compose later |
| librey: librechat | `/` | Node; good local-AI UI template |
| open-webui | `/health` | pairs with Ollama project |
| appflowy-cloud / appflowy | `/` | workspace; monitor-first |
| archivebox | `/` | archival; cron hook example |
| localsend | — | LAN tool; monitor-only (no http) |
| fincept-terminal | `/` | finance dashboard example |
| moneyprinterturbo | — | job-style (run-on-demand, not 24/7) |

Plus dev templates: `node-api, express, nextjs, flask, fastapi, static, vercel-external`.

Autodetect v1: `package.json` → `{ manager, start, port, healthPath }`; `requirements.txt/pyproject` → Flask/FastAPI guess.

## Tier 3 — deliberately skipped (with reason)

- **Training/fine-tune:** Transformers, PEFT, Unsloth, Axolotl, Diffusers, ComfyUI — GPU + Python ML stack, opposite of lightweight ops plane.
- **RL/eval:** Agent-Lightning (RL training), BrowserGym (agent benchmark), ExploitGym (offensive sec) — not monitoring.
- **Prompt optimizer:** DSPy — premature for v1 Explain/Propose loop.
- **Heavy agent runtimes:** Agent-S, Sky-Agent, NanoBot — we shell to user-installed CLIs instead of bundling a runtime in Proot.
- **Consumer/desktop:** PhotoGIMP, OpenToonz, uBlock, ente — not server apps.
- **Voice/video/trading:** VoxCPM, HyperFrames, TradingAgents, Flowsint, MoneyPrinter core — separate products; host via templates if wanted.
- **Skills libraries:** agent-skills, Book-to-Skill, Learn-Claude-Code — useful for the *user*, not dashboard code. Link in `docs/resources.md` (future).

## File deltas (when we build)

```text
+ server/integrations/ai/ollama.js
+ server/integrations/{telegram,discord,email,webhook,slack,vercel,github}.js
+ server/core/integration-runtime.js
+ server/core/log-retrieval.js
+ memory/<projectId>.json (runtime data, gitignored except .example)
+ templates/*.json (17 templates: 8 dev + 9 apps)
+ docs/mcp-tools.md (new)
~ docs/api-v1.md (add /api/mcp/manifest, /api/ai provider field, checks types)
~ docs/registry-schema.md (add checks[], memoryRef, template)
~ docs/security.md (ollama SSRF guard: localhost only; search_docs allowlist)
```

## Constraints reminder
Proot/Termux: no Docker-gated features in v1, no `better-sqlite3`/`node-pty`/Playwright/torch. Every Tier-1 item above works with `node:fetch + fs + child_process`. Browser/GPU items are interface-only until host changes.

## Roadmap deltas
- Phase 1 += provider switcher UI + `ollama` stub + log-retrieval (keyword version).
- Phase 3 += templates/ + autodetect.
- Phase 4 += `body-json/tcp/ssl/disk/mem` checks; `browser` interface only.
- Phase 5 += incident memory + MCP manifest + grounded lookup.
- Phase 6 unchanged (agents), now also serving MCP tools remotely.
