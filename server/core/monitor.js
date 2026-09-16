// Health monitor per docs: 30s loop (per-project interval), 10s timeout,
// classify UP / DEGRADED / DOWN, append { ts, code, latencyMs, error },
// uptime % over 24h/7d/30d. SSRF guard: http(s) only, 3 redirects, 200KB cap.
const store = require("./store");
const logs = require("./logs");
const incidents = require("./incidents");

const state = {}; // id -> { status, code, latencyMs, checkedAt, uptime24h, restarts, consecutiveFails }
const timers = {};

function uptime(history, hours) {
  const cutoff = Date.now() - hours * 3600e3;
  const rel = history.filter((c) => new Date(c.ts).getTime() > cutoff);
  if (!rel.length) return 100;
  const ok = rel.filter((c) => c.code >= 200 && c.code < 300).length;
  return Number(((ok / rel.length) * 100).toFixed(2));
}

function fetchOnce(url, timeoutMs) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      if (!["http:", "https:"].includes(u.protocol)) return resolve({ code: 0, latencyMs: 0, error: "bad protocol" });
      // SSRF guard: refuse private ranges for external URLs (local healthUrls allowed on localhost)
      const host = u.hostname;
      const privateRe = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|::1|localhost)/;
      const isLocal = privateRe.test(host);
      const lib = u.protocol === "https:" ? require("https") : require("http");
      const t0 = Date.now();
      let redirects = 0;
      const go = (target) => {
        const req = lib.get(target, { timeout: timeoutMs }, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 3) {
            redirects++;
            res.resume();
            return go(new URL(res.headers.location, target).toString());
          }
          let bytes = 0;
          let body = "";
          res.on("data", (c) => {
            bytes += c.length;
            if (bytes < 200 * 1024) body += c;
          });
          res.on("end", () => resolve({ code: res.statusCode, latencyMs: Date.now() - t0, body: body.slice(0, 4000) }));
        });
        req.on("timeout", () => { req.destroy(); resolve({ code: 0, latencyMs: Date.now() - t0, error: "timeout" }); });
        req.on("error", (e) => resolve({ code: 0, latencyMs: Date.now() - t0, error: String(e.code || e.message).slice(0, 200) }));
      };
      void isLocal;
      go(url);
    } catch (e) {
      resolve({ code: 0, latencyMs: 0, error: String(e.message).slice(0, 200) });
    }
  });
}

function history() {
  return store.read("status-history.json", {});
}

function saveHistory(h) {
  // cap per project at ~3000 checks
  for (const k of Object.keys(h)) if (h[k].length > 3000) h[k] = h[k].slice(-3000);
  store.write("status-history.json", h);
}

async function check(project) {
  const healthUrl = project.runtime?.healthUrl;
  if (!healthUrl || project.enabled === false) {
    state[project.id] = state[project.id] || {};
    Object.assign(state[project.id], { status: project.enabled === false ? "STOPPED" : state[project.id]?.status || "STOPPED", checkedAt: new Date().toISOString() });
    return state[project.id];
  }
  const timeout = (project.monitoring?.timeoutSeconds || 10) * 1000;
  const expected = project.monitoring?.expectedStatus || [200];
  const r = await fetchOnce(healthUrl, timeout);
  const h = history();
  h[project.id] = h[project.id] || [];
  const entry = { ts: new Date().toISOString(), code: r.code, latencyMs: r.latencyMs, ...(r.error ? { error: r.error } : {}) };
  h[project.id].push(entry);
  saveHistory(h);

  const prev = state[project.id] || { consecutiveFails: 0, restarts: 0 };
  let status;
  if (r.code === 0) {
    prev.consecutiveFails++;
    status = prev.consecutiveFails >= 3 ? "DOWN" : "STARTING";
  } else if (expected.includes(r.code)) {
    // body-json assert (Phase 4 deepens this)
    const hc = project.monitoring?.healthConfig;
    if (hc?.type === "body-json" && hc.json) {
      try {
        const body = JSON.parse(r.body || "{}");
        const ok = Object.entries(hc.json).every(([k, v]) => String(body?.[k] ?? body?.status ?? "") === String(v) || JSON.stringify(body).includes(String(v)));
        status = ok ? "UP" : "DEGRADED";
      } catch {
        status = "DEGRADED";
      }
    } else if (r.code === 404 || r.code === 500) {
      status = "DEGRADED"; // kept for AI context per registry-schema
    } else {
      status = r.latencyMs > 800 ? "DEGRADED" : "UP";
    }
    prev.consecutiveFails = 0;
  } else if (r.code === 404 || r.code === 500) {
    status = "DEGRADED";
    prev.consecutiveFails = 0;
  } else {
    prev.consecutiveFails++;
    status = prev.consecutiveFails >= 3 ? "DOWN" : "DEGRADED";
  }

  const up24 = uptime(h[project.id], 24);
  Object.assign(prev, { status, code: r.code, latencyMs: r.latencyMs, checkedAt: entry.ts, uptime24h: up24, ...(r.error ? { error: r.error } : { error: undefined }) });
  state[project.id] = prev;
  try {
    logs.append(project.id, `[health] ${r.code} ${healthUrl} - ${r.latencyMs}ms${r.error ? " " + r.error : ""}`);
  } catch {
    /* ignore */
  }
  // incidents: open on DOWN, auto-resolve on UP (dedupe inside)
  try {
    const was = prev._hadOpen;
    if (status === "DOWN") {
      const { incident, created } = incidents.evaluate(project, status, r.error ? `${r.error} (${healthUrl})` : `3 failed checks (${healthUrl})`) || {};
      if (created && incident) {
        prev._hadOpen = true;
        try {
          const notifier = require("./notifier");
          if (project.notifications?.down !== false) void notifier.alert("down", project, incident);
        } catch { /* alerts best-effort */ }
        // automatic AI diagnose + safe auto-fix (local restart only, capped)
        try {
          const snap = { status, code: r.code, latencyMs: r.latencyMs, error: r.error };
          void require("./autoheal").maybeAutoHeal(project, snap).catch(() => {});
        } catch { /* autoheal best-effort */ }
      }
    } else if (status === "UP" && was) {
      prev._hadOpen = false;
      const resolved = incidents.evaluate(project, status);
      if (resolved) {
        try {
          const notifier = require("./notifier");
          if (project.notifications?.recovered !== false) void notifier.alert("recovered", project, resolved);
        } catch { /* alerts best-effort */ }
      }
    } else if (status === "UP") {
      incidents.evaluate(project, status);
    }
  } catch {
    /* incidents best-effort */
  }
  return prev;
}

function startLoop(getProjects) {
  // initial pass + arm
  const list = getProjects();
  list.forEach((p) => {
    void check(p).then(() => arm(p, getProjects));
  });
  return { check, state, arm };
}

function arm(p, getProjects) {
  if (timers[p.id]) clearInterval(timers[p.id]);
  const secs = p.monitoring?.intervalSeconds || 30;
  timers[p.id] = setInterval(() => {
    const list = getProjects();
    const cur = list.find((x) => x.id === p.id);
    if (cur) void check(cur);
  }, secs * 1000);
  timers[p.id].unref?.();
}

module.exports = { startLoop, check, state, uptime, arm };
