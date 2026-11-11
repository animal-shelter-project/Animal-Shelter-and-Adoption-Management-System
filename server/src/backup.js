// Database backups (v2). The whole database is one file, so a backup is a
// consistent copy of it, made with SQLite's VACUUM INTO (safe while the
// server is running). The newest KEEP backups are kept.
//
//   npm run backup                 -> one backup now
//   BACKUP_EVERY_HOURS=24 (default) -> the server also makes one at start-up
//                                      and then every 24 hours (0 = off)
//
// To restore: stop the server, copy a file from server/backups/ over
// server/data/shelter.db, and start the server again.
const fs = require("fs");
const path = require("path");
const db = require("./db");

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, "..", "backups");
const KEEP = Number(process.env.BACKUP_KEEP) || 14;
const pad = (n) => String(n).padStart(2, "0");

function backupNow(dir = BACKUP_DIR, keep = KEEP) {
  fs.mkdirSync(dir, { recursive: true });
  const d = new Date();
  const name = `shelter-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.db`;
  const file = path.join(dir, name);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);

  // Keep only the newest `keep` backups.
  const old = fs
    .readdirSync(dir)
    .filter((f) => /^shelter-\d{8}-\d{6}\.db$/.test(f))
    .sort()
    .reverse()
    .slice(keep);
  for (const f of old) fs.unlinkSync(path.join(dir, f));
  return file;
}

module.exports = { backupNow, BACKUP_DIR };

if (require.main === module) {
  const file = backupNow();
  console.log(`Backup saved: ${file}`);
}
