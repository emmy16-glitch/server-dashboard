// Log tail/append/rotation per docs: 5MB/file keep 3, tail API cap 500 lines,
// secrets redaction. Real process output lands here in Phase 2.
const fs = require("fs");
const path = require("path");
const audit = require("./audit");

const LOGDIR = path.join(__dirname, "..", "logs");
const MAX_BYTES = 5 * 1024 * 1024;

function logPath(id) {
  if (!/^[a-z0-9-]{2,40}$/.test(id)) throw new Error("bad id");
  return path.join(LOGDIR, `${id}.log`);
}

function tail(id, lines = 200) {
  lines = Math.min(Math.max(1, Number(lines) || 200), 500);
  try {
    const data = fs.readFileSync(logPath(id), "utf8");
    const all = data.split("\n").filter((l) => l.length);
    return all.slice(-lines).map((l) => audit.redact(l));
  } catch {
    return [];
  }
}

function append(id, line) {
  fs.mkdirSync(LOGDIR, { recursive: true });
  const p = logPath(id);
  try {
    const st = fs.statSync(p);
    if (st.size > MAX_BYTES) {
      for (let i = 2; i >= 0; i--) {
        const a = i === 0 ? p : `${p}.${i}`;
        const b = `${p}.${i + 1}`;
        if (fs.existsSync(a)) fs.renameSync(a, b);
      }
      const old = fs.readdirSync(LOGDIR).filter((f) => f.startsWith(path.basename(p) + ".")).sort();
      while (old.length > 3) fs.unlinkSync(path.join(LOGDIR, old.shift()));
    }
  } catch {
    /* first write */
  }
  fs.appendFileSync(p, audit.redact(String(line)).slice(0, 4000) + "\n");
}

module.exports = { tail, append, logPath, LOGDIR };
