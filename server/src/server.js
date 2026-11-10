const app = require("./app");
const { PORT } = require("./config");
const { backupNow } = require("./backup");

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// v2: automatic backups (see src/backup.js). Not for the in-memory test database.
const hours = Number(process.env.BACKUP_EVERY_HOURS ?? 24);
if (hours > 0 && process.env.DB_PATH !== ":memory:") {
  const run = () => {
    try {
      console.log(`Backup saved: ${backupNow()}`);
    } catch (error) {
      console.error("Backup failed:", error.message);
    }
  };
  run();
  setInterval(run, hours * 60 * 60 * 1000).unref();
}
