// server-dashboard API v1 per docs/api-v1.md + architecture.md (stdlib only).
// Registry + auth + monitor + logs + process control + safe exec + incidents +
// deployments + AI/MCP stubs + static public/. Run: node server/index.js (:3001)
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

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

    // everything else needs auth (share token = read-only GETs)
    const isReadGet = req.method === "GET" && ["/api/projects", "/api/status", "/api/incidents", "/api/deploy"].some((x) => p === x || p.startsWith(x + "/") || p.startsWith("/api/logs/") || p.startsWith("/api/status/"));
    if (!auth.isAuthed(req, { allowShareRead: isReadGet })) return send(res, 401, { error: { code: "FORBIDDEN", message: "auth required" } });
    const readOnly = !!req.shareReadOnly;
    if (readOnly && req.method !== "GET") return send(res, 403, { error: { code: "FORBIDDEN", message: "read-only token" } });

    // projects CRUD
    if (p === "/api/projects" && req.method === "GET") return send(res, 200, { projects: getRegistry().projects });
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
    if (p === "/api/agents" && req.method === "GET") {
      const reg = getRegistry();
      const remote = store.read("agents-remote.json", []);
      let self = { id: "local", status: "connected", version: "v0.1.0" };
      try {
        const mem = fs.readFileSync("/proc/meminfo", "utf8");
        const total = Number((mem.match(/MemTotal:\s+(\d+)/) || [])[1] || 0) / 1024;
        const avail = Number((mem.match(/MemAvailable:\s+(\d+)/) || [])[1] || 0) / 1024;
        self = { ...self, hostname: require("os").hostname(), platform: `${require("os").platform()}/${require("os").arch()}`, memUsedMB: Math.round(total - avail), memTotalMB: Math.round(total), projectCount: reg.projects.length };
      } catch { /* non-linux */ }
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

    // safe exec (allowlist, cwd jail, 30s timeout, 100KB cap, audit)
    m = p.match(/^\/api\/exec\/([^/]+)$/);
    if (m && req.method === "POST") {
      const pr = getProject(m[1]);
      if (!pr) return send(res, 404, { error: { code: "NOT_FOUND", message: "project" } });
      const b = await body(req);
      const ALLOW = new Set(["npm", "node", "git", "ls", "cat", "python3", "pip", "curl", "ollama", "uvicorn"]);
      if (!ALLOW.has(b.cmd) || /[&;|`$(){}<>\n]/.test(`${b.cmd} ${(b.args || []).join(" ")}`)) {
        audit.append({ actor: actor(req), projectId: m[1], action: "exec_command", args: { cmd: b.cmd }, result: "denied" });
        return send(res, 403, { error: { code: "FORBIDDEN", message: "command not allowlisted" } });
      }
      const cwd = pr.location?.cwd;
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
      audit.append({ actor: actor(req), projectId: m[1], action: "exec_command", args: { cmd: b.cmd, args: b.args }, result: "success" });
      return send(res, 200, out);
    }

    // AI (Phase 5): grounded ask (logs + memory + deploys), gated execute
    m = p.match(/^\/api\/ai\/([^/]+)\/(ask|execute)$/);
    if (m && req.method === "POST") {
      const b = await body(req);
      const st = monitor.state[m[1]] || {};
      const pr = getProject(m[1]);
      if (m[2] === "ask") {
        const retrieval = require("./core/retrieval");
        const memory = require("./core/memory");
        const q = b.question || st.error || "";
        const spans = retrieval.retrieve(m[1], q, 6000);
        const mem = memory.recall(m[1], q, 3);
        const recentDeps = store.read("deployments.json", []).filter((d) => d.projectId === m[1]).slice(0, 2);
        const pastFixes = mem.similar.map((x) => `${x.cause} -> ${x.fixThatWorked || "unresolved"}`);
        return send(res, 200, {
          severity: st.status === "DOWN" ? "high" : st.status === "DEGRADED" ? "medium" : "low",
          likelyCause: st.status === "DOWN" ? "connection refused — upstream not listening" : st.status === "DEGRADED" ? "slow/upstream latency or failing assert" : "healthy",
          confidence: spans.length ? 0.7 : 0.5,
          evidence: [
            `status=${st.status || "unknown"}`,
            `latency=${st.latencyMs || 0}ms`,
            ...spans.slice(0, 3).map((s) => `log: ${s.slice(0, 220)}`),
            ...recentDeps.map((d) => `deploy ${d.id}@${d.sha} ${d.status}`),
          ],
          pastFixes,
          runbook: mem.runbook,
          recommendedActions: ["check evidence spans", "compare with past fixes", "trigger redeploy if deploy-related"],
          commands: [], safeToAutoFix: false,
          provider: (auth.loadSettings().aiProvider || "opencode"),
        });
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
      return send(res, 200, { aiProvider: s.aiProvider || "opencode", alertChannels: s.alertChannels || {}, tokenCreatedAt: s.createdAt || null });
    }
    if (p === "/api/settings" && req.method === "PATCH") {
      const b = await body(req);
      const s = auth.loadSettings();
      if (b.aiProvider) s.aiProvider = b.aiProvider;
      if (b.alertChannels) s.alertChannels = b.alertChannels;
      auth.saveSettings(s);
      return send(res, 200, { ok: true });
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
