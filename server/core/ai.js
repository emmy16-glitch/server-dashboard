// AI diagnosis: Groq (Qwen) when GROQ_API_KEY is set, else local
// `opencode run` (muse-spark free model). Read-only analysis: builds a prompt
// from monitor status + log spans + memory, gets JSON back, parses it.
// Falls back to rule-based evidence when both providers are unreachable.
const { spawn } = require("child_process");
const https = require("https");
const http = require("http");

const OPENCODE_BIN =
  process.env.OPENCODE_BIN ||
  (process.platform === "win32" ? "opencode" : (process.env.HOME || "~") + "/.opencode/bin/opencode");
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 75000);
const AI_MAX_CHARS = 6000;
const GROQ_KEY = () => process.env.GROQ_API_KEY || process.env.QWEN_API_KEY || "";
const GROQ_BASE = () => (process.env.GROQ_BASE_URL || process.env.QWEN_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
const GROQ_MODEL = () => process.env.GROQ_MODEL || process.env.QWEN_MODEL || "qwen-qwq-32b";

function stripAnsi(s) {
  return String(s || "")
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")
    .replace(/\r/g, "")
    .replace(/^[>\s]*build[^\n]*\n/i, ""); // opencode header line
}

function trim(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n) + "\n…(truncated)" : s;
}

function buildPrompt({ project, status, question, spans, mem, recentDeps }) {
  const memTxt = (mem.similar || []).map((x) => `- ${x.cause} -> ${x.fixThatWorked || "unresolved"}`).join("\n") || "(no past incidents)";
  const depsTxt = (recentDeps || []).map((d) => `- ${d.id}@${d.sha} ${d.status}`).join("\n") || "(no recent deploys)";
  const logsTxt = trim((spans || []).slice(0, 3).join("\n-----\n"), 3500);
  return `You are a read-only site-reliability diagnostician. DO NOT edit files, run shell commands, or restart anything. Analyze only.
Project: ${project.id} (${project.name || project.id})
Type: ${project.location?.type || "unknown"} | healthUrl: ${project.runtime?.healthUrl || "n/a"} | cwd: ${project.location?.cwd || "n/a"}
Monitor: status=${status.status || "unknown"} code=${status.code ?? "?"} latency=${status.latencyMs ?? 0}ms error=${status.error || "none"}
Operator question: ${question || status.error || "auto-diagnose: why is this failing?"}
Recent log spans:
${logsTxt || "(no logs)"}
Past fixes:
${memTxt}
Recent deploys:
${depsTxt}
First answer the operator's question directly in 1-3 short sentences (plain words, no jargon).
Then output this JSON block on its own lines (no markdown fences):
{"severity":"high|medium|low","likelyCause":"...","confidence":0.0-1.0,"evidence":["..."],"recommendedActions":["..."],"fixTool":"restart_project|none","safeToAutoFix":true|false,"summary":"..."}`;
}

// Find the LAST parseable JSON object (the model's final answer block),
// trying '{' positions from end to start so prose answers still resolve.
function extractJson(stdout) {
  const text = String(stdout || "");
  const end = text.lastIndexOf("}");
  if (end < 0) return null;
  const starts = [];
  for (let i = text.indexOf("{"); i >= 0 && i < end; i = text.indexOf("{", i + 1)) {
    starts.push(i);
    if (starts.length > 60) starts.shift();
  }
  for (let k = starts.length - 1; k >= 0; k--) {
    try {
      const o = JSON.parse(text.slice(starts[k], end + 1));
      if (o && typeof o === "object" && (o.likelyCause || o.summary || o.severity)) return o;
    } catch { /* try earlier start */ }
  }
  return null;
}

// Prose fallback: the model answered but produced no JSON (e.g. simple
// questions). Treat the raw text as the live answer instead of discarding it.
function proseDiagnosis(clean, { status, spans, mem, recentDeps }) {
  const firstLine = clean.split("\n").map((l) => l.trim()).filter(Boolean)[0] || "see full answer";
  return {
    severity: status.status === "DOWN" ? "high" : status.status === "DEGRADED" ? "medium" : "low",
    likelyCause: firstLine.slice(0, 500),
    confidence: 0.6,
    evidence: [
      `status=${status.status || "unknown"}`,
      `latency=${status.latencyMs || 0}ms`,
      ...(spans || []).slice(0, 2).map((s) => `log: ${String(s).slice(0, 220)}`),
    ],
    recommendedActions: ["see full answer below"],
    commands: [],
    fixTool: "none",
    safeToAutoFix: false,
    pastFixes: (mem.similar || []).map((x) => `${x.cause} -> ${x.fixThatWorked || "unresolved"}`),
    runbook: mem.runbook || [],
    rawAnalysis: trim(clean, AI_MAX_CHARS),
    provider: "opencode",
    aiLive: true,
  };
}

function runOpencode(prompt) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(OPENCODE_BIN, ["run", prompt], {
        cwd: "/tmp",
        timeout: AI_TIMEOUT_MS,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, TERM: "dumb", CI: "1" },
      });
    } catch (e) {
      return resolve({ ok: false, error: String(e.message).slice(0, 200) });
    }
    let out = "", err = "", done = false;
    const kill = setTimeout(() => {
      if (!done) { done = true; try { child.kill("SIGKILL"); } catch {} resolve({ ok: false, error: "timeout" }); }
    }, AI_TIMEOUT_MS + 5000);
    kill.unref?.();
    child.stdout?.on("data", (d) => { if (out.length < 32 * 1024) out += d; });
    child.stderr?.on("data", (d) => { if (err.length < 8 * 1024) err += d; });
    child.on("error", (e) => { if (!done) { done = true; clearTimeout(kill); resolve({ ok: false, error: String(e.message).slice(0, 200) }); } });
    child.on("close", (code) => {
      if (done) return;
      done = true; clearTimeout(kill);
      const clean = stripAnsi(out).trim();
      const parsed = extractJson(clean);
      if (parsed) return resolve({ ok: true, diagnosis: parsed, raw: clean.slice(0, AI_MAX_CHARS) });
      // Live prose answer without JSON (simple questions) still counts.
      if (clean.length >= 10) return resolve({ ok: true, prose: clean.slice(0, AI_MAX_CHARS) });
      resolve({ ok: false, error: `exit=${code} empty`, raw: (clean || stripAnsi(err)).slice(0, 1000) });
    });
  });
}

// Groq (OpenAI-compatible) chat call. Key comes from server/.env, never logged.
function callGroq(prompt) {
  return new Promise((resolve) => {
    const key = GROQ_KEY();
    if (!key) return resolve({ ok: false, error: "no-key" });
    let payload;
    try {
      payload = JSON.stringify({
        model: GROQ_MODEL(),
        temperature: 0.2,
        max_tokens: 1200,
        messages: [
          { role: "system", content: "You are a concise site-reliability diagnostician. Plain words, no jargon." },
          { role: "user", content: prompt },
        ],
      });
    } catch (e) {
      return resolve({ ok: false, error: String(e.message).slice(0, 100) });
    }
    let url;
    try { url = new URL(GROQ_BASE() + "/chat/completions"); }
    catch { return resolve({ ok: false, error: "bad-base-url" }); }
    const lib = url.protocol === "https:" ? https : http;
    let done = false;
    const finish = (r) => { if (!done) { done = true; resolve(r); } };
    const kill = setTimeout(() => finish({ ok: false, error: "timeout" }), Math.min(AI_TIMEOUT_MS, 60000));
    kill.unref?.();
    let req;
    try {
      req = lib.request(url, {
        method: "POST",
        timeout: Math.min(AI_TIMEOUT_MS, 60000),
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key, "Content-Length": Buffer.byteLength(payload) },
      }, (resp) => {
        let body = "";
        resp.on("data", (c) => { if (body.length < 32 * 1024) body += c; });
        resp.on("end", () => {
          clearTimeout(kill);
          if (resp.statusCode < 200 || resp.statusCode >= 300) {
            let msg = `http-${resp.statusCode}`;
            try { msg = JSON.parse(body).error?.message || msg; } catch {}
            return finish({ ok: false, error: String(msg).slice(0, 160) });
          }
          try {
            const text = JSON.parse(body).choices?.[0]?.message?.content || "";
            const clean = stripAnsi(text).trim();
            if (!clean) return finish({ ok: false, error: "empty" });
            const parsed = extractJson(clean);
            if (parsed) return finish({ ok: true, diagnosis: parsed, raw: clean.slice(0, AI_MAX_CHARS) });
            if (clean.length >= 10) return finish({ ok: true, prose: clean.slice(0, AI_MAX_CHARS) });
            return finish({ ok: false, error: "empty" });
          } catch (e) {
            return finish({ ok: false, error: "bad-response" });
          }
        });
      });
    } catch (e) {
      clearTimeout(kill);
      return finish({ ok: false, error: String(e.message).slice(0, 100) });
    }
    req.on("timeout", () => { try { req.destroy(); } catch {} finish({ ok: false, error: "timeout" }); });
    req.on("error", (e) => { clearTimeout(kill); finish({ ok: false, error: String(e.message).slice(0, 100) }); });
    req.write(payload);
    req.end();
  });
}

function ruleBased({ status, spans, mem, recentDeps }) {
  return {
    severity: status.status === "DOWN" ? "high" : status.status === "DEGRADED" ? "medium" : "low",
    likelyCause: status.status === "DOWN"
      ? `connection refused — upstream not listening (${status.error || "no route to healthUrl"})`
      : status.status === "DEGRADED" ? "slow/upstream latency or failing assert" : "healthy",
    confidence: spans && spans.length ? 0.7 : 0.5,
    evidence: [
      `status=${status.status || "unknown"}`,
      `latency=${status.latencyMs || 0}ms`,
      ...(spans || []).slice(0, 3).map((s) => `log: ${String(s).slice(0, 220)}`),
      ...(recentDeps || []).map((d) => `deploy ${d.id}@${d.sha} ${d.status}`),
    ],
    recommendedActions: ["check evidence spans", "compare with past fixes", "trigger redeploy if deploy-related"],
    fixTool: "none",
    safeToAutoFix: false,
    pastFixes: (mem.similar || []).map((x) => `${x.cause} -> ${x.fixThatWorked || "unresolved"}`),
    runbook: mem.runbook || [],
    provider: "opencode",
  };
}

async function diagnose({ project, status, question }) {
  const retrieval = require("./retrieval");
  const memory = require("./memory");
  const store = require("./store");
  const q = question || status.error || "";
  let spans = [], mem = { similar: [], runbook: [] }, recentDeps = [];
  try { spans = retrieval.retrieve(project.id, q, 6000); } catch {}
  try { mem = memory.recall(project.id, q, 3); } catch {}
  try { recentDeps = store.read("deployments.json", []).filter((d) => d.projectId === project.id).slice(0, 2); } catch {}
  const prompt = buildPrompt({ project, status, question: q, spans, mem, recentDeps });
  // Groq first (fast, seconds). Opencode second (slow, ~1 min). Rules last.
  // Sequential so a Groq win never leaves a stray opencode process running.
  let r = { ok: false, error: "skipped", via: "none" };
  if (GROQ_KEY()) r = { ...(await callGroq(prompt)), via: "groq" };
  if (!r.ok) r = { ...(await runOpencode(prompt)), via: "opencode" };
  const via = r.via || "opencode";
  if (r.ok && r.prose && !r.diagnosis) {
    return { ...proseDiagnosis(r.prose, { status, spans, mem, recentDeps }), provider: via };
  }
  if (r.ok && r.diagnosis) {
    const d = r.diagnosis;
    return {
      severity: ["high", "medium", "low"].includes(d.severity) ? d.severity : ruleBased({ status, spans, mem, recentDeps }).severity,
      likelyCause: String(d.likelyCause || d.summary || "unknown").slice(0, 500),
      confidence: Math.max(0, Math.min(1, Number(d.confidence ?? 0.65))),
      evidence: Array.isArray(d.evidence) ? d.evidence.map((x) => String(x).slice(0, 300)).slice(0, 6) : [],
      recommendedActions: Array.isArray(d.recommendedActions) ? d.recommendedActions.map((x) => String(x).slice(0, 300)).slice(0, 6) : [],
      commands: [],
      fixTool: d.fixTool === "restart_project" ? "restart_project" : "none",
      safeToAutoFix: d.safeToAutoFix === true,
      pastFixes: (mem.similar || []).map((x) => `${x.cause} -> ${x.fixThatWorked || "unresolved"}`),
      runbook: mem.runbook || [],
      rawAnalysis: trim(r.raw, AI_MAX_CHARS),
      provider: via,
      aiLive: true,
    };
  }
  return { ...ruleBased({ status, spans, mem, recentDeps }), commands: [], aiLive: false, aiError: `${via}:${r.error}` || "unavailable" };
}

module.exports = { diagnose, runOpencode, buildPrompt };
