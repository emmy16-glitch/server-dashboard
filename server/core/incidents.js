// Incident manager per docs: failed checks open an incident, recovery
// auto-resolves, ack/notes via API. Dedupe: one open incident per project.
const store = require("./store");

function list() {
  return store.read("incidents.json", []);
}
function save(l) {
  store.write("incidents.json", l);
}

function open(projectId, projectName, cause) {
  const all = list();
  const dup = all.find((i) => i.projectId === projectId && i.state !== "resolved");
  if (dup) {
    dup.timeline = [...(dup.timeline || []), { ts: new Date().toISOString(), event: `still failing: ${cause}`, actor: "health-monitor" }];
    save(all);
    return { incident: dup, created: false };
  }
  const inc = {
    id: `inc-${Date.now().toString(36)}`,
    projectId,
    projectName: projectName || projectId,
    startedAt: new Date().toISOString(),
    cause: String(cause).slice(0, 300),
    state: "open",
    recoveryAttempts: 0,
    maxRecoveryAttempts: 3,
    timeline: [{ ts: new Date().toISOString(), event: `opened: ${cause}`, actor: "incident-manager" }],
    alertChannels: [],
  };
  all.unshift(inc);
  save(all);
  return { incident: inc, created: true };
}

function resolve(projectId, event = "recovered: health checks passing") {
  const all = list();
  let changed = null;
  for (const i of all) {
    if (i.projectId === projectId && i.state !== "resolved") {
      i.state = "resolved";
      i.resolvedAt = new Date().toISOString();
      i.timeline = [...(i.timeline || []), { ts: new Date().toISOString(), event, actor: "incident-manager" }];
      changed = i;
    }
  }
  if (changed) save(all);
  return changed;
}

// Called by the monitor after each check.
function evaluate(project, status, detail) {
  if (status === "DOWN") {
    return open(project.id, project.name, detail || "3 failed checks in a row");
  }
  if (status === "UP") {
    return resolve(project.id) || null;
  }
  return null;
}

module.exports = { list, save, open, resolve, evaluate };
