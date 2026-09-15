# UI Plan — server-dashboard console (premium build)

Updated 2026-09-15. Supersedes the vanilla-CSS draft: the shipped UI is the
`design-premium` build (from `emmy16-glitch-patch-1`), now living in `web/`.

## Stack
Vite 7 + React 19 + TypeScript + Tailwind 4 + `lucide-react`, single-file
production build (`vite-plugin-singlefile`), `@` alias for `src/*`.
Dev: `npm --prefix web run dev` (proxy `/api` -> :3001).
Prod: `npm --prefix web run build` -> `server/public/`, served by `server/index.js`.

## Layout
- `Header`: global nav (projects / incidents / deploys / terminal / ai-ops / templates / agents), search, Add Project, token state, read-only toggle.
- `DesignBar`: material/composition/structure/feeling presets + scanlines + sound.
- Main: tabbed workspace + modals (`ProjectDetailModal` with logs/terminal/deploys/AI tabs, `AddProjectModal`, `McpInspectorModal`, `AuditLogModal`, `DeployPipelineModal`).
- Supporting views: `ProjectsGrid` + `ProjectCard`, `IncidentsCenter`, `SafeTerminal`, `AiAssistantModal`, `TemplatesDirectory`, `AgentsMatrix`.

## Data
`src/context/DashboardContext.tsx` is the store. On load + every 30s it syncs
from the server (`/api/projects`, `/api/status`, `/api/incidents`,
`/api/deploy`, `/api/templates`, `/api/agents`) and merges live status over
`src/data/mockData.ts` fallback. Mutating actions (start/stop/restart) POST to
`/api` first, fall back to local simulation when offline / no token.
Token lives in `localStorage` (`sd-token`); see `src/lib/api.ts`.

## Non-goals v1
No PTY (safe-mode exec only), no chart lib beyond canvas/sparkline components,
no team RBAC (admin token + read-only share only).
