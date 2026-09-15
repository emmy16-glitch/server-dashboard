// Auth per docs/security.md: Bearer token (32+ random bytes, stored hashed,
// rotatable) + short-lived browser session + optional read-only share token.
const crypto = require("crypto");
const store = require("./store");

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

function loadSettings() {
  return store.read("settings.json", {});
}

function saveSettings(s) {
  store.write("settings.json", s);
}

function ensureToken() {
  const s = loadSettings();
  if (!s.tokenHash) {
    const token = crypto.randomBytes(32).toString("hex");
    s.tokenHash = sha256(token);
    s.createdAt = new Date().toISOString();
    saveSettings(s);
    // printed once so the operator can log in; afterwards only the hash exists
    console.log(`[auth] generated admin token (save it, shown once): ${token}`);
  }
  return s;
}

function sessions() {
  return store.read("sessions.json", {});
}

function saveSessions(s) {
  store.write("sessions.json", s);
}

function verifyBearer(req) {
  const s = ensureToken();
  const h = req.headers["authorization"] || "";
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return false;
  const hash = sha256(m[1]);
  if (hash === s.tokenHash) return true;
  if (s.shareTokenHash && hash === s.shareTokenHash) {
    req.shareReadOnly = true;
    return true;
  }
  return false;
}

function verifySession(req) {
  const cookies = req.headers["cookie"] || "";
  const m = cookies.match(/sd-session=([a-f0-9]{32,})/);
  if (!m) return false;
  const all = sessions();
  const sess = all[m[1]];
  if (!sess || sess.expires < Date.now()) return false;
  if (sess.readOnly) req.shareReadOnly = true;
  return true;
}

function isAuthed(req, { allowShareRead = false } = {}) {
  if (verifySession(req)) return !(!allowShareRead && req.shareReadOnly);
  if (verifyBearer(req)) {
    if (req.shareReadOnly) return allowShareRead;
    return true;
  }
  return false;
}

function login(token) {
  const s = ensureToken();
  if (sha256(token) !== s.tokenHash) return null;
  const id = crypto.randomBytes(16).toString("hex");
  const all = sessions();
  all[id] = { expires: Date.now() + 12 * 3600e3, created: Date.now() };
  saveSessions(all);
  return id;
}

function rotate() {
  const token = crypto.randomBytes(32).toString("hex");
  const s = loadSettings();
  s.tokenHash = sha256(token);
  s.createdAt = new Date().toISOString();
  s.rotatedAt = s.createdAt;
  saveSettings(s);
  // invalidate sessions on rotation
  saveSessions({});
  return token;
}

module.exports = { ensureToken, isAuthed, login, rotate, loadSettings, saveSettings, sha256 };
