// Append-only audit log per docs/security.md (never raw secrets).
const crypto = require("crypto");
const store = require("./store");

const REDACT = /(KEY|TOKEN|SECRET|PASSWORD|Authorization)(=|: ?)([^\s,}]+)/gi;

function redact(s) {
  return String(s).replace(REDACT, "$1$2***");
}

function append({ actor = "api", projectId = "-", action, args = {}, result = "success" }) {
  const log = store.read("audit.json", []);
  const argsHash = crypto.createHash("sha256").update(JSON.stringify(args)).digest("hex").slice(0, 16);
  log.push({
    ts: new Date().toISOString(),
    actor,
    projectId,
    action,
    argsHash,
    details: redact(JSON.stringify(args).slice(0, 500)),
    result,
  });
  // cap at 5000 entries
  while (log.length > 5000) log.shift();
  store.write("audit.json", log);
}

module.exports = { append, redact };
