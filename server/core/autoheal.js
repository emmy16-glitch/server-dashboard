// Automatic diagnose + safe auto-fix loop.
// Triggered fire-and-forget from monitor on new DOWN incidents (and DEGRADED
// escalation). Caps: local-only restart, <=3 attempts per incident, >=10min
// between auto-fixes per project, >=15min between AI diagnoses per project.
// Everything is audited + noted on the incident timeline + remembered.
const store = require("./store");

const COOLDOWN_FIX_MS = 10 * 60 * 1000;
const COOLDOWN_DIAG_MS = 15 * 60 * 1000;
let running = new Set();

function autoState() {
  return store.read("ai-auto.json", {});
}
function saveAuto(s) {
  store.write("ai-auto.json", s);
}

async function maybeAutoHeal(project, status) {
  if (!project || project.enabled === false) return;
  if (running.has(project.id)) return;
  const settings = (() => { try { return require("./auth").loadSettings(); } catch { return {}; } })();
  if (settings.aiAutoHeal === false) return;
  if (project.location?.type !== "local") return; // externals: diagnose only, never restart
  if (!["DOWN", "DEGRADED"].includes(status)) return;

  const now = Date.now();
  const st = autoState();
  const rec = st[project.id] || {};
  if (rec.lastDiagAt && now - rec.lastDiagAt < COOLDOWN_DIAG_MS) return;
  running.add(project.id);
  try {
    const ai = require("./ai");
    const diag = await ai.diagnose({ project, status, question: "" });
    st[project.id] = { ...rec, lastDiagAt: now, lastSeverity: diag.severity, lastCause: diag.likelyCause };
    saveAuto(st);

    const incidents = require("./incidents");
    const logs = require("./logs");
    const audit = require("./audit");
    const all = incidents.list();
    const open = all.find((i) => i.projectId === project.id && i.state !== "resolved");

    const note = (event) => {
      try {
        const list = incidents.list();
        const t = list.find((i) => i.projectId === project.id && i.state !== "resolved");
        if (t) {
          t.timeline = [...(t.timeline || []), { ts: new Date().toISOString(), event, actor: "ai-autoheal" }];
          incidents.save(list);
        }
      } catch {}
    };

    try { logs.append(project.id, `[ai] auto-diagnose (${diag.aiLive ? "opencode-live" : "fallback"}): ${diag.likelyCause}`.slice(0, 500)); } catch {}

    const attempts = open ? (open.recoveryAttempts || 0) : 0;
    const maxAttempts = open ? (open.maxRecoveryAttempts || 3) : 3;
    const canFix = diag.safeToAutoFix && diag.fixTool === "restart_project" && open && attempts < maxAttempts;

    if (!canFix) {
      note(`AI diagnosis (${diag.aiLive ? "live" : "fallback"}, ${diag.severity}): ${String(diag.likelyCause).slice(0, 200)} — no safe auto-fix, waiting for operator`);
      return { diagnosed: true, fixed: false, reason: "no-safe-fix" };
    }
    if (rec.lastFixAt && now - rec.lastFixAt < COOLDOWN_FIX_MS) {
      note(`AI wants restart but cooldown active (${Math.round((COOLDOWN_FIX_MS - (now - rec.lastFixAt)) / 60000)}m left)`);
      return { diagnosed: true, fixed: false, reason: "cooldown" };
    }
    // Safe fix: local restart only
    try {
      const pm = require("./process");
      const r = pm.restart(project, logs);
      const list = incidents.list();
      const t = list.find((i) => i.projectId === project.id && i.state !== "resolved");
      if (t) {
        t.recoveryAttempts = (t.recoveryAttempts || 0) + 1;
        t.timeline = [...(t.timeline || []), { ts: new Date().toISOString(), event: `AI auto-restart (${t.recoveryAttempts}/${t.maxRecoveryAttempts}): ${String(diag.likelyCause).slice(0, 160)} pid=${r?.pid || "?"}`, actor: "ai-autoheal" }];
        incidents.save(list);
      }
      try { audit.append({ actor: "ai-autoheal", projectId: project.id, action: "process_restart", args: { auto: true, cause: diag.likelyCause }, result: "success" }); } catch {}
      st[project.id] = { ...(st[project.id] || {}), lastFixAt: now };
      saveAuto(st);
      return { diagnosed: true, fixed: true };
    } catch (e) {
      note(`AI auto-restart failed: ${String(e.message).slice(0, 200)}`);
      return { diagnosed: true, fixed: false, reason: "restart-failed" };
    }
  } finally {
    running.delete(project.id);
  }
}

module.exports = { maybeAutoHeal };
