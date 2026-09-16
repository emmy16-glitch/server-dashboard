// Process manager (Phase 2 minimal, stdlib only): spawn/kill with cwd jail,
// lock file, PID probe, /proc cpu/mem, restart counters. No shell, no PTY.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const LOCKDIR = path.join(__dirname, "..", "locks");
// Portable roots: DASHBOARD_ROOTS="C:\apps;/data/apps" (or ":/..." on unix)
// plus legacy Termux defaults plus cwd + home so any box works out of the box.
const ALLOWED_ROOTS = (() => {
  const extra = (process.env.DASHBOARD_ROOTS || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  const home = (() => { try { return require("os").homedir(); } catch { return null; } })();
  return [...extra, "/root/projects", "/root/Software_projects", "/root/models", "/root/server-dashboard", process.cwd(), home].filter(Boolean);
})();

function realInside(p, roots = ALLOWED_ROOTS) {
  try {
    const rp = fs.realpathSync(p);
    return roots.some((r) => { try { return rp === fs.realpathSync(r) || rp.startsWith(fs.realpathSync(r) + "/"); } catch { return rp === r || rp.startsWith(r + "/"); } });
  } catch { return false; }
}

function lockPath(id) { return path.join(LOCKDIR, `${id}.lock`); }
function procs() {
  try { return JSON.parse(fs.readFileSync(path.join(LOCKDIR, "procs.json"), "utf8")); }
  catch { return {}; }
}
function saveProcs(p) {
  fs.mkdirSync(LOCKDIR, { recursive: true });
  fs.writeFileSync(path.join(LOCKDIR, "procs.json"), JSON.stringify(p, null, 2));
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function rushStat(pid) {
  // cpu/mem via /proc (Linux only); fallback zeros
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf8").split(" ");
    const utime = Number(stat[13]) || 0, stime = Number(stat[14]) || 0;
    const rss = Number(fs.readFileSync(`/proc/${pid}/statm`, "utf8").split(" ")[1]) || 0;
    const uptime = Number(fs.readFileSync("/proc/uptime", "utf8").split(" ")[0]) || 1;
    const starttime = Number(stat[21]) || 0;
    const hertz = 100;
    const total = (utime + stime) / hertz;
    const elapsed = Math.max(1, uptime - starttime / hertz);
    return { cpuPct: Number(((total / elapsed) * 100).toFixed(1)), memMB: Number(((rss * 4096) / 1048576).toFixed(1)) };
  } catch { return { cpuPct: 0, memMB: 0 }; }
}

function info(project) {
  const all = procs();
  const rec = all[project.id] || {};
  const pid = rec.pid;
  const isAlive = pid && alive(pid);
  const res = isAlive ? rushStat(pid) : { cpuPct: 0, memMB: 0 };
  let uptimeSec = 0;
  if (isAlive && rec.startedAt) uptimeSec = Math.floor((Date.now() - rec.startedAt) / 1000);
  return { pid: isAlive ? pid : undefined, alive: !!isAlive, cpuPct: res.cpuPct, memMB: res.memMB, uptimeSec, restarts: rec.restarts || 0 };
}

function start(project, logs) {
  if (project.location?.type !== "local") throw Object.assign(new Error("external projects cannot be started here"), { code: 400 });
  const cwd = project.location?.cwd;
  if (!cwd || !realInside(cwd)) throw Object.assign(new Error("cwd outside allowedRoots"), { code: 400 });
  fs.mkdirSync(LOCKDIR, { recursive: true });
  if (fs.existsSync(lockPath(project.id))) throw Object.assign(new Error("project locked (already starting?)"), { code: 409 });
  const all = procs();
  if (all[project.id]?.pid && alive(all[project.id].pid)) throw Object.assign(new Error("already running"), { code: 409 });
  fs.writeFileSync(lockPath(project.id), String(process.pid));

  const cmd = project.runtime?.command;
  const args = project.runtime?.args || [];
  if (!cmd || !/^[a-z0-9_.-]+$/i.test(cmd)) { fs.rmSync(lockPath(project.id), { force: true }); throw Object.assign(new Error("invalid command"), { code: 400 }); }
  try {
    const child = spawn(cmd, args, { cwd: fs.realpathSync(cwd), shell: false, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    child.unref();
    child.stdout.on("data", (d) => String(d).split("\n").filter(Boolean).forEach((l) => logs.append(project.id, `[out] ${l}`)));
    child.stderr.on("data", (d) => String(d).split("\n").filter(Boolean).forEach((l) => logs.append(project.id, `[err] ${l}`)));
    child.on("exit", (code) => {
      logs.append(project.id, `[exit] code=${code}`);
      fs.rmSync(lockPath(project.id), { force: true });
      const cur = procs();
      if (cur[project.id]?.pid === child.pid) { delete cur[project.id].pid; saveProcs(cur); }
    });
    const prev = all[project.id] || {};
    all[project.id] = { pid: child.pid, startedAt: Date.now(), restarts: prev.restarts || 0 };
    saveProcs(all);
    logs.append(project.id, `[start] ${cmd} ${args.join(" ")} pid=${child.pid}`);
    fs.rmSync(lockPath(project.id), { force: true });
    return { pid: child.pid };
  } catch (e) {
    fs.rmSync(lockPath(project.id), { force: true });
    throw e;
  }
}

function stop(project, logs, signal = "SIGTERM") {
  const all = procs();
  const pid = all[project.id]?.pid;
  if (!pid || !alive(pid)) { delete all[project.id]?.pid; saveProcs(all); return { ok: true, alreadyStopped: true }; }
  try { process.kill(pid, signal); } catch { /* gone */ }
  setTimeout(() => { try { if (alive(pid)) process.kill(pid, "SIGKILL"); } catch { /* gone */ } }, 10000).unref?.();
  delete all[project.id].pid;
  saveProcs(all);
  logs.append(project.id, `[stop] pid=${pid} ${signal}`);
  return { ok: true };
}

function restart(project, logs) {
  const all = procs();
  const prev = all[project.id] || {};
  try { stop(project, logs); } catch { /* continue */ }
  const r = start(project, logs);
  all[project.id] = { ...(procs()[project.id] || {}), restarts: (prev.restarts || 0) + 1 };
  saveProcs(all[project.id] ? procs() : procs());
  const cur = procs();
  cur[project.id] = { ...(cur[project.id] || {}), restarts: (prev.restarts || 0) + 1 };
  saveProcs(cur);
  return r;
}

module.exports = { info, start, stop, restart, alive, ALLOWED_ROOTS };
