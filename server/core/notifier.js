// Notifier per docs: Telegram -> Discord -> Email -> webhook -> Slack.
// Channels configured in settings.json alertChannels; no-ops when unconfigured.
// Rules: DOWN always; recovered only if project.notifications.recovered.
const http = require("https");
const store = require("./store");
const audit = require("./audit");

function settings() {
  return store.read("settings.json", {});
}

function post(url, payload, timeoutMs = 5000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const data = JSON.stringify(payload);
      const req = http.request(
        { hostname: u.hostname, port: 443, path: u.pathname + u.search, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }, timeout: timeoutMs },
        (res) => { res.resume(); res.on("end", () => resolve(res.statusCode >= 200 && res.statusCode < 300)); }
      );
      req.on("timeout", () => { req.destroy(); resolve(false); });
      req.on("error", () => resolve(false));
      req.end(data);
    } catch {
      resolve(false);
    }
  });
}

async function send(channel, text) {
  const s = settings();
  const cfg = (s.alertChannels || {})[channel];
  if (!cfg) return false;
  if (channel === "telegram" && cfg.botToken && cfg.chatId) {
    return post(`https://api.telegram.org/bot${cfg.botToken}/sendMessage`, { chat_id: cfg.chatId, text: String(text).slice(0, 4000) });
  }
  if ((channel === "discord" || channel === "slack") && cfg.webhookUrl) {
    return post(cfg.webhookUrl, channel === "discord" ? { content: text } : { text });
  }
  if (channel === "webhook" && cfg.url) {
    return post(cfg.url, { text, ts: new Date().toISOString() });
  }
  if (channel === "email") return false; // SMTP lands Phase 4 final
  return false;
}

async function alert(kind, project, incident) {
  // kind: 'down' | 'recovered'
  const order = ["telegram", "discord", "email", "webhook", "slack"];
  const text = kind === "down"
    ? `🔴 DOWN: ${project.name} (${project.id}) — ${incident?.cause || "health checks failing"}`
    : `🟢 RECOVERED: ${project.name} (${project.id})`;
  for (const ch of order) {
    try {
      const ok = await send(ch, text);
      if (incident && ok) {
        const all = store.read("incidents.json", []);
        const cur = all.find((i) => i.id === incident.id);
        if (cur) {
          cur.alertChannels = [...(cur.alertChannels || []), { channel: ch, sent: true, ts: new Date().toISOString() }];
          store.write("incidents.json", all);
        }
      }
      if (ok) break; // first working channel wins per alert
    } catch {
      /* next channel */
    }
  }
  audit.append({ actor: "notifier", projectId: project.id, action: "alert", args: { kind }, result: "success" });
}

module.exports = { send, alert, settings };
