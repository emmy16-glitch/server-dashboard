// JSON file store: read/write with timestamped backup (keep 20) per docs/security.md.
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "storage");

function file(name) {
  return path.join(DIR, name);
}

function read(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), "utf8"));
  } catch {
    return fallback;
  }
}

function write(name, data) {
  fs.mkdirSync(DIR, { recursive: true });
  const target = file(name);
  // backup before every write
  try {
    if (fs.existsSync(target)) {
      const backups = path.join(DIR, "backups");
      fs.mkdirSync(backups, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(target, path.join(backups, `${name}.${stamp}.bak`));
      const list = fs.readdirSync(backups).filter((f) => f.startsWith(name + ".")).sort();
      while (list.length > 20) fs.unlinkSync(path.join(backups, list.shift()));
    }
  } catch {
    /* backup best-effort */
  }
  fs.writeFileSync(target, JSON.stringify(data, null, 2));
}

module.exports = { read, write, file, DIR };
