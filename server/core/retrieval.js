// Log retrieval per integrations-plan §5: split logs into spans, score by
// keywords from the status error + recency, return top spans ≤ ~8KB.
// Keyword + recency in v1 (no vector DB); interface ready for embeddings.
const logs = require("./logs");

const SEED_KEYS = ["error", "traceback", "eaddrinuse", "404", "500", "fail", "timeout", "refused", "exception", "panic", "502", "503"];

function spans(id, maxLines = 500) {
  const lines = logs.tail(id, maxLines);
  const out = [];
  let cur = [];
  for (const l of lines) {
    cur.push(l);
    if (/^\s*$/.test(l) || /Error|Traceback|EADDRINUSE|40[04]|50[02]|FAIL/i.test(l) || cur.length >= 12) {
      if (cur.length) out.push(cur.join("\n"));
      cur = [];
    }
  }
  if (cur.length) out.push(cur.join("\n"));
  return out;
}

function retrieve(id, query = "", maxBytes = 8192) {
  const keys = new Set([...SEED_KEYS, ...String(query).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2)]);
  const all = spans(id);
  const scored = all.map((s, i) => {
    const low = s.toLowerCase();
    let score = 0;
    for (const k of keys) if (low.includes(k)) score += 2;
    score += (i / Math.max(1, all.length)) * 3; // recency wins
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const picked = [];
  let bytes = 0;
  for (const { s } of scored) {
    if (bytes + s.length > maxBytes) break;
    picked.push(s);
    bytes += s.length;
  }
  return picked;
}

module.exports = { retrieve, spans };
