// server-dashboard API v1 per docs/api-v1.md + architecture.md (stdlib only).
// Registry + auth + monitor + logs + process control + safe exec + incidents +
// deployments + AI/MCP stubs + static public/. Run: node server/index.js (:3001)
// Local secrets live in server/.env (gitignored), loaded below.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// minimal .env loader (KEY=VALUE, skips blanks/# comments, never logs values)
try {
  const envFile = path.join(__dirname, ".env");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
} catch { /* env best-effort */ }

const store = require("./core/store");
const auth = require("./core/auth");
const audit = require("./core/audit");
const logs = require("./core/logs");
const monitor = require("./core/monitor");
const pm = require("./core/process");

const PORT = process.env.PORT || 3001;
const PUBLIC = path.join(__dirname, "public");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

// ---- registry ----
const ID_RE = /^[a-z0-9-]{2,40}$/;
function getRegistry() { return store.read("projects.json", { version: 1, agents: [{ id: "local" }], projects: [] }); }
function getProject(id) { return getRegistry().projects.find((p) => p.id === id); }
function validateProject(p, isNew) {
  if (!p || typeof p !== "object") throw Object.assign(new Error("invalid body"), { code: 400 });
  if (isNew) {
    if (!ID_RE.test(p.id || "")) throw Object.assign(new Error("id must match ^[a-z0-9-]{2,40}$"), { code: 400 });
    if (getProject(p.id)) throw Object.assign(new Error("id exists"), { code: 409 });
  }
  if (p.location?.type === "local" && p.location?.cwd) {
    const roots = pm.ALLOWED_ROOTS;
    if (p.location.cwd.startsWith("~/")) p.location.cwd = path.join(require("os").homedir(), p.location.cwd.slice(2));
    let ok = false;
    try { const rp = fs.realpathSync(p.location.cwd); ok = roots.some((r) => { try { const rr = fs.realpathSync(r); return rp === rr || rp.startsWith(rr + "/"); } catch { return false; } }); }
    catch { ok = false; }
    if (!ok) throw Object.assign(new Error("cwd must exist inside allowedRoots"), { code: 400 });
  }
  if (p.location?.type === "external" && p.runtime?.healthUrl && !/^https?:\/\//.test(p.runtime.healthUrl))
    throw Object.assign(new Error("external healthUrl must be http(s)"), { code: 400 });
  if (p.runtime?.port && (p.runtime.port < 1024 || p.runtime.port > 65535))
    throw Object.assign(new Error("port must be 1024-65535"), { code: 400 });
}

// ---- helpers ----
function send(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(obj));
}
const err = (res, e) => send(res, e.code && typeof e.code === "number" ? e.code : 500, { error: { code: "ERR", message: String(e.message).slice(0, 300) } });
function body(req) {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > 512 * 1024) { reject(Object.assign(new Error("body too large"), { code: 413 })); req.destroy(); } });
    req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(Object.assign(new Error("invalid JSON"), { code: 400 })); } });
  });
}
function actor(req) { return req.headers["x-actor"] ? String(req.headers["x-actor"]).slice(0, 40) : "token"; }

// `ai` terminal command: talk to the dashboard's AI about a service.
// Never spawns a shell — calls the same diagnose/autoheal core as the UI.
async function aiTerminal(b, res, req) {
  const args = (b.args || []).map(String);
  const sub = args[0];
  const known = () => { try { return store.read("projects.json", { projects: [] }).projects; } catch { return []; } };
  const usage = "usage:\n  ai ask <service> <question>  - diagnose (live, ~1 min)\n  ai fix <service>             - diagnose + safe auto-fix attempt";
  if (sub !== "ask" && sub !== "fix") return send(res, 200, { exitCode: 0, stdout: usage, stderr: "" });
  const id = args[1] || "";
  const pr = known().find((x) => x.id === id);
  if (!pr) return send(res, 200, { exitCode: 1, stdout: "", stderr: `unknown service "${id}". Known: ${known().map((x) => x.id).join(", ") || "none"}` });
  try {
    const st = monitor.state[id] || {};
    if (sub === "ask") {
      const q = args.slice(2).join(" ");
      const ai = require("./core/ai");
      const d = await ai.diagnose({ project: pr, status: st, question: q });
      try { logs.append(id, `[ai] terminal ask: ${q.slice(0, 200)} -> ${String(d.likelyCause).slice(0, 200)}`); } catch {}
      const out = `${d.aiLive ? "[live answer]" : "[offline summary]"}\n${d.likelyCause}\n\nWhat I saw:\n${(d.evidence || []).map((e) => "- " + e).join("\n")}\n\nWhat to do:\n${(d.recommendedActions || []).map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
      audit.append({ actor: actor(req), projectId: id, action: "ai_fix_execute", args: { tool: "terminal_ask", q: q.slice(0, 200) }, result: "success" });
      return send(res, 200, { exitCode: 0, stdout: out.slice(0, 8000), stderr: "" });
    }
    const heal = require("./core/autoheal");
    const r = await heal.maybeAutoHeal(pr, st.status ? st : { ...st, status: st.status || "DOWN" });
    audit.append({ actor: actor(req), projectId: id, action: "ai_fix_execute", args: { tool: "terminal_fix" }, result: "success" });
    if (!r) return send(res, 200, { exitCode: 0, stdout: `${pr.name}: no auto-fix applied (healthy, cooling down, or needs you).`, stderr: "" });
    return send(res, 200, {
      exitCode: 0,
      stdout: r.fixed ? `${pr.name}: diagnosed and auto-restarted. Watch the next checks.` : `${pr.name}: diagnosed, no safe auto-fix (${r.reason || "waiting for operator"}).`,
      stderr: "",
    });
  } catch (e) {
    return send(res, 200, { exitCode: 1, stdout: "", stderr: String(e.message).slice(0, 300) });
  }
}

// monitor loop over registry
monitor.startLoop(() => getRegistry().projects.filter((p) => p.enabled !== false));

// ---- server ----
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Actor" });
      return res.end();
    }

    // public
    if (p === "/api/health") return send(res, 200, { ok: true });
    if (p === "/api/auth/login" && req.method === "POST") {
      const b = await body(req);
      const sess = auth.login(b.token || "");
      if (!sess) { audit.append({ actor: "anon", action: "auth_login", args: {}, result: "denied" }); return send(res, 401, { error: { code: "FORBIDDEN", message: "bad token" } }); }
      res.writeHead(200, { "Content-Type": "application/json", "Set-Cookie": `sd-session=${sess}; HttpOnly; SameSite=Lax; Max-Age=43200; Path=/` });
      audit.append({ actor: "login", action: "auth_login", args: {}, result: "success" });
      return res.end(JSON.stringify({ ok: true }));
    }

    // only /api/* needs auth — the static frontend (login screen) is public
    if (p.startsWith("/api/")) {
      const isReadGet = req.method === "GET" && ["/api/projects", "/api/status", "/api/incidents", "/api/deploy"].some((x) => p === x || p.startsWith(x + "/") || p.startsWith("/api/logs/") || p.startsWith("/api/status/"));
      if (!auth.isAuthed(req, { allowShareRead: isReadGet })) return send(res, 401, { error: { code: "FORBIDDEN", message: "auth required" } });
      const readOnly = !!req.shareReadOnly;
      if (readOnly && req.method !== "GET") return send(res, 403, { error: { code: "FORBIDDEN", message: "read-only token" } });
    }

    // projects CRUD
    if (p === "/api/projects" && req.method === "GET") return send(res, 200, { projects: getRegistry().projects });
    // inspect a local folder and auto-fill start command + port (read-only).
    if (p === "/api/projects/inspect" && req.method === "GET") {
      const rawPath = (u.searchParams.get("path") || "").trim();
      const expand = (s) => s.startsWith("~/") ? path.join(require("os").homedir(), s.slice(2)) : s;
      const abs = expand(rawPath);
      if (!abs) return send(res, 200, { ok: false, error: "empty-path" });
      let rp;
      try {
        rp = fs.realpathSync(abs);
        if (!fs.statSync(rp).isDirectory()) return send(res, 200, { ok: false, error: "not-a-folder" });
      } catch {
        return send(res, 200, { ok: false, error: "not-found" });
      }
      const inside = pm.ALLOWED_ROOTS.some((r) => { try { const rr = fs.realpathSync(r); return rp === rr || rp.startsWith(rr + "/"); } catch { return false; } });
      if (!inside) return send(res, 200, { ok: false, error: "outside-roots", roots: pm.ALLOWED_ROOTS });
      const readCapped = (f, cap = 65536) => { try { const s = fs.readFileSync(path.join(rp, f), "utf8"); return s.slice(0, cap); } catch { return ""; } };
      const pkgTxt = readCapped("package.json");
      let pkg = null;
      try { pkg = pkgTxt ? JSON.parse(pkgTxt) : null; } catch { /* ignore */ }
      const det = { name: path.basename(rp), kind: "", description: "", command: "", args: [], port: 3000 };
      if (pkg) {
        const deps = { ...((pkg.dependencies) || {}), ...((pkg.devDependencies) || {}) };
        const scripts = pkg.scripts || {};
        det.description = String(pkg.description || "").slice(0, 200);
        if (pkg.name && !/^(app|server|project|my-app)$/i.test(pkg.name)) det.name = String(pkg.name).slice(0, 40);
        if (deps.next) { det.kind = "Next.js app"; det.command = "npm"; det.args = scripts.start ? ["run", "start"] : ["run", "dev"]; }
        else if (deps.express || deps.fastify || deps.koa || deps.nestjs) { det.kind = "Node.js API"; det.command = "npm"; det.args = scripts.start ? ["run", "start"] : ["run", "dev"]; }
        else if (deps.react || deps.vite) { det.kind = "Vite app"; det.command = "npm"; det.args = scripts.dev ? ["run", "dev"] : ["run", "start"]; }
        else if (scripts.start || scripts.dev) { det.kind = "Node.js app"; det.command = "npm"; det.args = scripts.start ? ["run", "start"] : ["run", "dev"]; }
        // hunt for the port in likely server files + .env
        const envPort = (readCapped(".env", 8192).match(/^\s*PORT\s*=\s*(\d{2,5})/m) || [])[1];
        let filePort = "";
        for (const f of [pkg.main || "", "server.js", "index.js", "src/index.js", "src/server.js", "app.js"]) {
          if (!f) continue;
          const t = readCapped(f);
          if (!t) continue;
          const m = t.match(/\.listen\(\s*(\d{2,5})/) || t.match(/PORT\s*\|\|\s*(\d{2,5})/) || t.match(/port\s*[:=]\s*(\d{2,5})/i);
          if (m) { filePort = m[1]; break; }
        }
        det.port = Number(envPort || filePort || 3000);
      } else {
        const reqTxt = readCapped("requirements.txt", 16384);
        if (/fastapi|uvicorn/i.test(reqTxt)) { det.kind = "Python API (FastAPI)"; det.command = "python3"; det.args = ["-m", "uvicorn", "main:app"]; det.port = 8000; }
        else if (/flask/i.test(reqTxt) || fs.existsSync(path.join(rp, "app.py"))) { det.kind = "Python app"; det.command = "python3"; det.args = ["app.py"]; det.port = 5000; }
      }
      if (!det.command) return send(res, 200, { ok: false, error: "unknown-type", folder: det.name });
      det.healthUrl = `http://localhost:${det.port}/health`;
      return send(res, 200, { ok: true, folder: rp, detection: det });
    }
    if (p === "/api/projects/detect" && req.method === "POST") {
      const b = await body(req);
      const files = b.files || {};
      let pkg = null;
      try { pkg = JSON.parse(files["package.json"] || "null"); } catch { /* ignore */ }
      const req_txt = files["requirements.txt"] || "";
      let template = "static", runtime = { healthUrl: b.healthUrl || "" };
      if (pkg) {
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (deps.next) template = "nextjs";
        else if (deps.express) template = "express";
        else template = "node-api";
        const scripts = pkg.scripts || {};
        runtime = { command: "npm", args: scripts.start ? ["run", "start"] : ["run", "dev"], port: b.port || 3000, healthUrl: b.healthUrl || "http://localhost:3000/health" };
      } else if (/uvicorn|fastapi/i.test(req_txt)) {
        template = "fastapi";
        runtime = { command: "python3", args: ["-m", "uvicorn", "main:app"], port: b.port || 8000, healthUrl: b.healthUrl || "http://localhost:8000/health" };
      } else if (/flask/i.test(req_txt)) {
        template = "flask";
        runtime = { command: "python3", args: ["app.py"], port: b.port || 5000, healthUrl: b.healthUrl || "http://localhost:5000/health" };
      } else if (files["vercel.json"]) {
        template = "vercel-external";
      }
      audit.append({ actor: actor(req), action: "autodetect", args: { template }, result: "success" });
      return send(res, 200, { template, runtime });
    }
    if (p === "/api/projects" && req.method === "POST") {
      const b = await body(req);
      const id = (b.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || b.id;
      const proj = { id, enabled: true, ...b, id };
      validateProject(proj, true);
      const reg = getRegistry();
      reg.projects.push(proj);
      store.write("projects.json", reg);
      audit.append({ actor: actor(req), action: "project_create", args: { id }, result: "success" });
      // start health-checking it right away (no restart needed)
      try {
        const getProjects = () => getRegistry().projects.filter((x) => x.enabled !== false);
        void monitor.check(proj).then(() => monitor.arm(proj, getProjects)).catch(() => {});
      } catch { /* monitor best-effort */ }
      return send(res, 201, { id });
    }
    let m = p.match(/^\/api\/projects\/([^/]+)$/);
    if (m) {
      const cur = getProject(m[1]);
      if (!cur) return send(res, 404, { error: { code: "NOT_FOUND", message: "project" } });
      if (req.method === "GET") return send(res, 200, cur);
      if (req.method === "PATCH") {
        const b = await body(req);
        const reg = getRegistry();
        const i = reg.projects.findIndex((x) => x.id === m[1]);
        reg.projects[i] = { ...cur, ...b, id: cur.id };
        validateProject(reg.projects[i], false);
        store.write("projects.json", reg);
        audit.append({ actor: actor(req), projectId: m[1], action: "project_update", args: b, result: "success" });
        return send(res, 200, reg.projects[i]);
      }
      if (req.method === "DELETE") {
        try { const pr = getProject(m[1]); if (pr.location?.type === "local") pm.stop(pr, logs); } catch { /* ignore */ }
        const reg = getRegistry();
        reg.projects = reg.projects.filter((x) => x.id !== m[1]);
        store.write("projects.json", reg);
        audit.append({ actor: actor(req), projectId: m[1], action: "project_delete", args: {}, result: "success" });
        return send(res, 200, { ok: true });
      }
    }

    // status
    if (p === "/api/status" && req.method === "GET") {
      const out = {};
      for (const pr of getRegistry().projects) {
        const s = monitor.state[pr.id] || {};
        out[pr.id] = { status: s.status || "STARTING", code: s.code ?? null, latencyMs: s.latencyMs ?? 0, checkedAt: s.checkedAt || null, uptime24h: s.uptime24h ?? 100, restarts: (pm.info(pr).restarts || 0) };
      }
      return send(res, 200, out);
    }
    m = p.match(/^\/api\/status\/([^/]+)\/history$/);
    if (m && req.method === "GET") {
      const range = u.searchParams.get("range") || "24h";
      const hours = range === "7d" ? 168 : range === "30d" ? 720 : 24;
      const h = store.read("status-history.json", {})[m[1]] || [];
      const cutoff = Date.now() - hours * 3600e3;
      return send(res, 200, { checks: h.filter((c) => new Date(c.ts).getTime() > cutoff) });
    }

    // process (local only)
    m = p.match(/^\/api\/process\/([^/]+)(?:\/(start|stop|restart))?$/);
    if (m) {
      const pr = getProject(m[1]);
      if (!pr) return send(res, 404, { error: { code: "NOT_FOUND", message: "project" } });
      if (!m[2]) return send(res, 200, pm.info(pr));
      if (pr.location?.type !== "local") return send(res, 400, { error: { code: "VALIDATION", message: "external: control in provider" } });
      try {
        const r = m[2] === "start" ? pm.start(pr, logs) : m[2] === "stop" ? pm.stop(pr, logs) : pm.restart(pr, logs);
        audit.append({ actor: actor(req), projectId: m[1], action: `process_${m[2]}`, args: {}, result: "success" });
        return send(res, 200, { ok: true, ...(r || {}) });
      } catch (e) { audit.append({ actor: actor(req), projectId: m[1], action: `process_${m[2]}`, args: {}, result: "failed" }); return err(res, e); }
    }

    // logs
    m = p.match(/^\/api\/logs\/([^/]+)$/);
    if (m && req.method === "GET") return send(res, 200, { lines: logs.tail(m[1], u.searchParams.get("lines") || 200) });
    m = p.match(/^\/api\/logs\/([^/]+)\/stream$/);
    if (m && req.method === "GET") { // SSE tail-follow
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
      res.write(`: connected\n\n`);
      let last = logs.tail(m[1], 500).length;
      const t = setInterval(() => {
        try {
          const lines = logs.tail(m[1], 500);
          if (lines.length > last) {
            lines.slice(last).forEach((l) => res.write(`data: ${JSON.stringify(l)}\n\n`));
            last = lines.length;
          }
          res.write(`: ping\n\n`);
        } catch { /* ignore */ }
      }, 2000);
      req.on("close", () => clearInterval(t));
      return;
    }

    // deployments (record + stub engine w/ audit; full git engine Phase 3)
    if (p === "/api/deploy" && req.method === "GET") return send(res, 200, { deployments: store.read("deployments.json", []) });
    m = p.match(/^\/api\/deploy\/([^/]+)$/);
    if (m && req.method === "GET") return send(res, 200, { deployments: store.read("deployments.json", []).filter((d) => d.projectId === m[1]) });
    if (m && req.method === "POST" && p.endsWith("/rollback")) {
      audit.append({ actor: actor(req), projectId: m[1].replace("/rollback", ""), action: "rollback", args: await body(req), result: "success" });
      return send(res, 200, { ok: true, note: "rollback recorded; git engine lands Phase 3" });
    }
    m = p.match(/^\/api\/deploy\/([^/]+)$/);
    if (m && req.method === "POST") {
      const b = await body(req);
      const all = store.read("deployments.json", []);
      const dep = { id: `dep-${Date.now().toString(36)}`, projectId: m[1], sha: b.sha || "latest", branch: "main", startedAt: new Date().toISOString(), status: "running", buildTail: ["$ git fetch origin", "recorded; git engine lands Phase 3"] };
      all.unshift(dep); store.write("deployments.json", all);
      audit.append({ actor: actor(req), projectId: m[1], action: "deploy", args: b, result: "success" });
      return send(res, 202, { deploymentId: dep.id });
    }

    // incidents
    if (p === "/api/incidents" && req.method === "GET") {
      let list = store.read("incidents.json", []);
      const q = u.searchParams.get("project"), st = u.searchParams.get("state");
      if (q) list = list.filter((i) => i.projectId === q);
      if (st) list = list.filter((i) => i.state === st);
      return send(res, 200, { incidents: list });
    }
    // templates (Phase 3) + autodetect
    if (p === "/api/templates" && req.method === "GET") {
      const dir = path.join(__dirname, "templates");
      const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
      return send(res, 200, { templates: names.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) });
    }
    m = p.match(/^\/api\/templates\/([^/]+)$/);
    if (m && req.method === "GET") {
      try {
        return send(res, 200, JSON.parse(fs.readFileSync(path.join(__dirname, "templates", `${m[1]}.json`), "utf8")));
      } catch {
        return send(res, 404, { error: { code: "NOT_FOUND", message: "template" } });
      }
    }
    // Vercel deploy hook trigger (externals: never fake local control)
    m = p.match(/^\/api\/deploy\/([^/]+)\/trigger$/);
    if (m && req.method === "POST") {
      const pr = getProject(m[1]);
      if (!pr) return send(res, 404, { error: { code: "NOT_FOUND", message: "project" } });
      const hooks = auth.loadSettings().deployHooks || {};
      const hook = hooks[m[1]];
      if (!hook) return send(res, 400, { error: { code: "VALIDATION", message: "no deploy hook configured; set settings.deployHooks." + m[1] + " to the Vercel Deploy Hook URL" } });
      const ok = await new Promise((resolve) => {
        try {
          const lib = hook.startsWith("https:") ? require("https") : require("http");
          const r = lib.request(hook, { method: "POST", timeout: 15000 }, (resp) => { resp.resume(); resp.on("end", () => resolve(resp.statusCode >= 200 && resp.statusCode < 300)); });
          r.on("timeout", () => { r.destroy(); resolve(false); });
          r.on("error", () => resolve(false));
          r.end("{}");
        } catch { resolve(false); }
      });
      const all = store.read("deployments.json", []);
      const dep = { id: `dep-${Date.now().toString(36)}`, projectId: m[1], sha: "latest", branch: pr.source?.branch || "main", startedAt: new Date().toISOString(), status: ok ? "running" : "failed", commitMessage: "Vercel deploy-hook trigger", author: actor(req), buildTail: ok ? ["POST deploy hook accepted — watch Vercel dashboard"] : ["deploy hook POST failed"] };
      all.unshift(dep); store.write("deployments.json", all);
      audit.append({ actor: actor(req), projectId: m[1], action: "deploy_trigger", args: {}, result: ok ? "success" : "failed" });
      return send(res, ok ? 202 : 502, { deploymentId: dep.id, ok });
    }
    // deep links (control happens in provider)
    m = p.match(/^\/api\/deploy\/([^/]+)\/links$/);
    if (m && req.method === "GET") {
      const pr = getProject(m[1]);
      if (!pr) return send(res, 404, { error: { code: "NOT_FOUND", message: "project" } });
      return send(res, 200, {
        production: pr.runtime?.healthUrl || null,
        repository: pr.source ? `https://github.com/${pr.source.repository}` : null,
        vercelDashboard: "https://vercel.com/dashboard (select the project; team slug varies)",
      });
    }

    // agents seam (Phase 6): local registry agents + remote heartbeats + self stats
    // portable: os module works on Linux/macOS/Windows (no /proc dependency).
    if (p === "/api/agents" && req.method === "GET") {
      const reg = getRegistry();
      const remote = store.read("agents-remote.json", []);
      const os = require("os");
      let self = { id: "local", status: "connected", version: "v0.1.0" };
      try {
        const total = os.totalmem() / 1048576, free = os.freemem() / 1048576;
        self = { ...self, hostname: os.hostname(), platform: `${os.platform()}/${os.arch()}`, memUsedMB: Math.round(total - free), memTotalMB: Math.round(total), projectCount: reg.projects.length };
      } catch { /* ignore */ }
      return send(res, 200, { agents: [...reg.agents.map((a) => ({ ...a, ...(a.id === "local" ? self : { status: "unknown" }) })), ...remote] });
    }
    if (p === "/api/agents/heartbeat" && req.method === "POST") {
      const b = await body(req);
      if (!b.id || !/^[a-z0-9-]{2,40}$/.test(b.id)) return send(res, 400, { error: { code: "VALIDATION", message: "agent id required" } });
      const all = store.read("agents-remote.json", []);
      const i = all.findIndex((a) => a.id === b.id);
      const rec = { ...b, status: "connected", lastHeartbeat: new Date().toISOString() };
      if (i >= 0) all[i] = rec; else all.push(rec);
      store.write("agents-remote.json", all);
      return send(res, 200, { ok: true });
    }
    m = p.match(/^\/api\/incidents\/([^/]+)\/(ack|resolve)$/);
    if (m && req.method === "POST") {
      const b = await body(req);
      const list = store.read("incidents.json", []);
      const i = list.findIndex((x) => x.id === m[1]);
      if (i < 0) return send(res, 404, { error: { code: "NOT_FOUND", message: "incident" } });
      list[i].state = m[2] === "ack" ? "acknowledged" : "resolved";
      if (b.note) list[i].notes = [...(list[i].notes || []), String(b.note).slice(0, 500)];
      if (m[2] === "resolve") {
        list[i].resolvedAt = new Date().toISOString();
        try { require("./core/memory").remember(list[i].projectId, { cause: list[i].cause, signals: (list[i].timeline || []).map((x) => x.event).join(" | ").slice(0, 500), fixThatWorked: b.fixSummary || b.note || "resolved by operator" }); } catch { /* ignore */ }
      }
      store.write("incidents.json", list);
      audit.append({ actor: actor(req), projectId: list[i].projectId, action: `incident_${m[2]}`, args: { id: m[1] }, result: "success" });
      return send(res, 200, { ok: true });
    }

    // safe exec: per-service folder (/api/exec/:id) or whole box (/api/exec,
    // runs in the home folder). Allowlist, no shell, 30s cap, audited.
    // `ai` is a built-in command (intercepted, never spawned):
    //   ai ask <service> <question>  -> live diagnosis in the terminal
    //   ai fix <service>             -> diagnose + safe auto-fix attempt
    m = p.match(/^\/api\/exec(?:\/([^/]+))?$/);
    if (m && req.method === "POST") {
      const boxMode = !m[1];
      const pr = boxMode ? null : getProject(m[1]);
      if (!boxMode && !pr) return send(res, 404, { error: { code: "NOT_FOUND", message: "project" } });
      const b = await body(req);
      if (b.cmd === "ai") return aiTerminal(b, res, req);
      // Read-only-friendly allowlist; shell metachars rejected (no pipes/redirects).
      // df/free/ps/pwd/uptime exist on unix; on Windows use node/npm/git/python.
      const ALLOW = new Set(["npm", "node", "git", "ls", "cat", "mkdir", "python3", "python", "pip", "curl", "ollama", "uvicorn", "df", "free", "ps", "pwd", "echo", "uptime", "du", "whoami", "hostname", "lsb_release"]);
      if (!ALLOW.has(b.cmd) || /[&;|`$(){}<>\n]/.test(`${b.cmd} ${(b.args || []).join(" ")}`)) {
        audit.append({ actor: actor(req), projectId: boxMode ? "box" : m[1], action: "exec_command", args: { cmd: b.cmd }, result: "denied" });
        return send(res, 403, { error: { code: "FORBIDDEN", message: "command not allowlisted" } });
      }
      const cwd = boxMode
        ? (process.env.DASHBOARD_HOME || require("os").homedir())
        : pr.location?.cwd;
      if (!cwd) return send(res, 400, { error: { code: "VALIDATION", message: "external has no cwd" } });
      const { spawn } = require("child_process");
      const out = await new Promise((resolve) => {
        let stdout = "", stderr = "", done = false;
        let child;
        try { child = spawn(b.cmd, (b.args || []).map(String), { cwd, shell: false, timeout: Math.min((b.timeoutSec || 30), 30) * 1000 }); }
        catch (e) { return resolve({ exitCode: 1, stdout: "", stderr: String(e.message).slice(0, 1000), truncated: false }); }
        const kill = setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* x */ } }, 30000);
        child.stdout?.on("data", (d) => { if (stdout.length < 100 * 1024) stdout += d; });
        child.stderr?.on("data", (d) => { if (stderr.length < 100 * 1024) stderr += d; });
        child.on("error", (e) => { if (!done) { done = true; clearTimeout(kill); resolve({ exitCode: 1, stdout, stderr: String(e.message).slice(0, 1000), truncated: false }); } });
        child.on("close", (code) => { if (!done) { done = true; clearTimeout(kill); resolve({ exitCode: code ?? 1, stdout: stdout.slice(0, 100 * 1024), stderr: stderr.slice(0, 100 * 1024), truncated: stdout.length >= 100 * 1024 }); } });
      });
      audit.append({ actor: actor(req), projectId: boxMode ? "box" : m[1], action: "exec_command", args: { cmd: b.cmd, args: b.args }, result: "success" });
      return send(res, 200, out);
    }

    // AI (Phase 5): grounded ask (logs + memory + deploys), gated execute
    m = p.match(/^\/api\/ai\/([^/]+)\/(ask|execute)$/);
    if (m && req.method === "POST") {
      const b = await body(req);
      const st = monitor.state[m[1]] || {};
      const pr = getProject(m[1]);
      if (m[2] === "ask") {
        if (!pr) return send(res, 404, { error: { code: "NOT_FOUND", message: "project" } });
        try {
          const ai = require("./core/ai");
          const d = await ai.diagnose({ project: pr, status: st, question: b.question || st.error || "" });
          return send(res, 200, { ...d, provider: d.provider || "opencode" });
        } catch (e) {
          return err(res, e);
        }
      }
      // execute: confirm-gated, manifest-validated, audited
      const manifest = ["restart_project", "run_safe_command", "deploy_project", "ack_incident", "resolve_incident"];
      if (!manifest.includes(b.tool)) return send(res, 400, { error: { code: "VALIDATION", message: "unknown tool" } });
      if (b.confirm !== true) return send(res, 400, { error: { code: "VALIDATION", message: "confirm:true required for mutating tools" } });
      audit.append({ actor: actor(req), projectId: m[1], action: "ai_fix_execute", args: { tool: b.tool, args: b.args }, result: "success" });
      if (b.tool === "ack_incident" || b.tool === "resolve_incident") {
        const list = store.read("incidents.json", []);
        const t = list.find((x) => x.id === (b.args || {}).incidentId && x.state !== "resolved");
        if (!t) return send(res, 404, { error: { code: "NOT_FOUND", message: "incident" } });
        t.state = b.tool === "ack_incident" ? "acknowledged" : "resolved";
        if (b.tool === "resolve_incident") {
          t.resolvedAt = new Date().toISOString();
          try { require("./core/memory").remember(m[1], { cause: t.cause, signals: (t.timeline || []).map((x) => x.event).join(" | ").slice(0, 500), fixThatWorked: (b.args || {}).fixSummary || "resolved via AI execute" }); } catch { /* ignore */ }
        }
        store.write("incidents.json", list);
        return send(res, 200, { ok: true });
      }
      if (!pr) return send(res, 404, { error: { code: "NOT_FOUND", message: "project" } });
      if (b.tool === "restart_project") {
        if (pr.location?.type !== "local") return send(res, 400, { error: { code: "VALIDATION", message: "external: restart in provider dashboard" } });
        try { const r = pm.restart(pr, logs); return send(res, 200, { ok: true, ...r }); }
        catch (e) { return err(res, e); }
      }
      if (b.tool === "deploy_project") {
        const all = store.read("deployments.json", []);
        const dep = { id: `dep-${Date.now().toString(36)}`, projectId: m[1], sha: (b.args || {}).sha || "latest", branch: pr.source?.branch || "main", startedAt: new Date().toISOString(), status: pr.location?.type === "local" ? "running" : "pending", commitMessage: "AI-approved deploy", author: actor(req), buildTail: pr.location?.type === "local" ? [] : ["external: use POST /api/deploy/:id/trigger with a Deploy Hook"] };
        all.unshift(dep); store.write("deployments.json", all);
        return send(res, 202, { ok: true, deploymentId: dep.id });
      }
      return send(res, 200, { ok: true, note: "run_safe_command: use POST /api/exec/:id directly" });
    }

    // MCP manifest (served tools per docs/mcp-tools.md)
    if (p === "/api/mcp/manifest" && req.method === "GET") {
      return send(res, 200, {
        tools: [
          { name: "get_status", args: { projectId: "string" }, sideEffects: false },
          { name: "get_logs", args: { projectId: "string", lines: "number?", query: "string?" }, sideEffects: false },
          { name: "check_port", args: { port: "number" }, sideEffects: false },
          { name: "restart_project", args: { projectId: "string" }, sideEffects: true, confirm: true },
          { name: "run_safe_command", args: { projectId: "string", cmd: "string", args: "string[]" }, sideEffects: true, confirm: true },
          { name: "deploy_project", args: { projectId: "string", sha: "string?" }, sideEffects: true, confirm: true },
        ],
      });
    }

    // settings + token rotation
    if (p === "/api/settings" && req.method === "GET") {
      const s = auth.loadSettings();
      return send(res, 200, { aiProvider: s.aiProvider || "opencode", aiAutoHeal: s.aiAutoHeal !== false, alertChannels: s.alertChannels || {}, tokenCreatedAt: s.createdAt || null });
    }
    if (p === "/api/settings" && req.method === "PATCH") {
      const b = await body(req);
      const s = auth.loadSettings();
      if (b.aiProvider) s.aiProvider = b.aiProvider;
      if (typeof b.aiAutoHeal === "boolean") s.aiAutoHeal = b.aiAutoHeal;
      if (b.alertChannels) s.alertChannels = b.alertChannels;
      auth.saveSettings(s);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/ai/auto-state" && req.method === "GET") {
      return send(res, 200, { auto: store.read("ai-auto.json", {}) });
    }
    if (p === "/api/auth/rotate" && req.method === "POST") {
      const t = auth.rotate();
      audit.append({ actor: actor(req), action: "auth_rotate", args: {}, result: "success" });
      return send(res, 200, { token: t });
    }
    if (p === "/api/audit" && req.method === "GET") return send(res, 200, { audit: store.read("audit.json", []).slice(-200) });

    if (p.startsWith("/api/")) return send(res, 404, { error: { code: "NOT_FOUND", message: p } });

    // static
    let f = path.join(PUBLIC, p === "/" ? "index.html" : decodeURIComponent(p).slice(1).split("?")[0]);
    if (!f.startsWith(PUBLIC)) return send(res, 403, { error: { code: "FORBIDDEN", message: "escape" } });
    fs.readFile(f, (e, data) => {
      if (e) fs.readFile(path.join(PUBLIC, "index.html"), (e2, fb) => {
        if (e2) return send(res, 404, { error: { code: "NOT_FOUND", message: "no public build" } });
        res.writeHead(200, { "Content-Type": "text/html" }); res.end(fb);
      });
      else { res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(data); }
    });
  } catch (e) { err(res, e); }
});

auth.ensureToken();
server.listen(PORT, () => console.log(`server-dashboard :${PORT} (GET /api/health)`));
