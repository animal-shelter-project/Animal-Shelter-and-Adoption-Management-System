const db = require("../db");
const Animal = require("../models/Animal");
const AdoptionApplication = require("../models/AdoptionApplication");
const Appointment = require("../models/Appointment");
const { localStamp } = require("./AppointmentController");

class DashboardController {
  // GET /api/stats (public): the shelter's headline numbers for the home
  // page. Only counts, never anything about a person.
  static publicStats(req, res) {
    const counts = Animal.countByStatus();
    const yearStartUtc = `${new Date().getFullYear()}-01-01 00:00:00`;
    const adoptionsThisYear = db
      .prepare("SELECT COUNT(*) AS n FROM applications WHERE status = 'Approved' AND decided_at >= ?")
      .get(yearStartUtc).n;
    res.json({
      available: counts.Available,
      inFoster: counts.Fostered,
      adopted: counts.Adopted,
      adoptionsThisYear,
    });
  }

  // GET /api/dashboard (Staff): the numbers a shelter manager asks for first.
  static summary(req, res) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // Applications store UTC timestamps (CURRENT_TIMESTAMP).
    const monthStartUtc = monthStart.toISOString().slice(0, 19).replace("T", " ");
    const count = (sql, ...args) => db.prepare(sql).get(...args).n;

    res.json({
      animals: Animal.countByStatus(),
      pendingApplications: AdoptionApplication.countPending(),
      adoptionsThisMonth: count(
        "SELECT COUNT(*) AS n FROM applications WHERE status = 'Approved' AND decided_at >= ?",
        monthStartUtc,
      ),
      arrivalsThisMonth: count(
        "SELECT COUNT(*) AS n FROM animals WHERE created_at >= ? AND archived_at IS NULL",
        monthStartUtc,
      ),
      // Available animals waiting longest (by when they were added).
      longestWaiting: db
        .prepare(
          `SELECT a.id, a.name, a.species, a.created_at AS since
             FROM animals a
            WHERE a.status = 'Available' AND a.archived_at IS NULL
            ORDER BY a.created_at, a.id LIMIT 5`,
        )
        .all(),
      upcomingAppointments: Appointment.upcoming(
        localStamp(new Date(now.getTime() - 60 * 60 * 1000)),
        localStamp(new Date(now.getTime() + 7 * 86400000)),
      ),
    });
  }
}

module.exports = DashboardController;
