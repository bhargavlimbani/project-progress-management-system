const express = require("express");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const {
  getAdminStats, getProjectStatusChart, getDomainDistribution,
  getMentorWorkload, getFacultyWorkload, getSubjectProjectStats, getWeeklySubmissionStats, getProgressTrend,
  getRecentActivity, getAtRiskProjects,
  getFacultyStats, getMentorStats, getStudentStats,
} = require("../controllers/analytics.controller");

const router = express.Router();
router.use(authenticate);

// Admin analytics
router.get("/admin/stats", authorize("ADMIN"), getAdminStats);
router.get("/admin/project-status", authorize("ADMIN"), getProjectStatusChart);
router.get("/admin/domain-distribution", authorize("ADMIN"), getDomainDistribution);
router.get("/admin/mentor-workload", authorize("ADMIN"), getMentorWorkload);
router.get("/admin/faculty-workload", authorize("ADMIN"), getFacultyWorkload);
router.get("/admin/progress-trend", authorize("ADMIN"), getProgressTrend);
router.get("/admin/subject-stats", authorize("ADMIN"), getSubjectProjectStats);
router.get("/admin/weekly-submissions", authorize("ADMIN"), getWeeklySubmissionStats);
router.get("/admin/recent-activity", authorize("ADMIN"), getRecentActivity);
router.get("/admin/at-risk", authorize("ADMIN"), getAtRiskProjects);

// Manually trigger the expected-vs-actual sweep (also runs daily in-process)
router.post("/run-monitor", authorize("ADMIN"), async (req, res, next) => {
  try {
    const { runDailyMonitor } = require("../services/riskMonitor.service");
    res.json(await runDailyMonitor());
  } catch (err) { next(err); }
});

router.post("/send-reminders", authorize("ADMIN"), async (req, res, next) => {
  try {
    const { sendWeeklyReminders } = require("../services/riskMonitor.service");
    res.json(await sendWeeklyReminders());
  } catch (err) { next(err); }
});

// Role-specific stats
router.get("/faculty/stats", authorize("FACULTY"), getFacultyStats);
router.get("/mentor/stats", authorize("MENTOR"), getMentorStats);
router.get("/student/stats", authorize("STUDENT"), getStudentStats);

module.exports = router;
