// Incident memory per integrations-plan (Letta pattern, file JSON):
// memory/<projectId>.json { incidents: [{cause, signals, fixThatWorked, ts}], runbook: [] }
// capped at last 50. Injected into ai-ask; appended on resolve w/ fixSummary.
const fs = require("fs");
const path = require("path");

const MEMDIR = path.join(__dirname, "..", "memory");

function load(projectId) {
  try {
    return JSON.parse(fs.readFileSync(path.join(MEMDIR, `${projectId}.json`), "utf8"));
  } catch {
    return { incidents: [], runbook: [] };
  }
}

function save(projectId, mem) {
  fs.mkdirSync(MEMDIR, { recursive: true });
  if (mem.incidents.length > 50) mem.incidents = mem.incidents.slice(-50);
  fs.writeFileSync(path.join(MEMDIR, `${projectId}.json`), JSON.stringify(mem, null, 2));
}

function recall(projectId, query = "", n = 3) {
  const mem = load(projectId);
  const keys = String(query).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const scored = mem.incidents.map((i) => {
    const low = `${i.cause} ${i.signals}`.toLowerCase();
    let s = 0;
    for (const k of keys) if (low.includes(k)) s++;
    return { i, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return { similar: scored.slice(0, n).map((x) => x.i), runbook: mem.runbook || [] };
}

function remember(projectId, { cause, signals, fixThatWorked }) {
  const mem = load(projectId);
  mem.incidents.push({ cause, signals, fixThatWorked, ts: new Date().toISOString() });
  save(projectId, mem);
}

module.exports = { load, save, recall, remember, MEMDIR };
