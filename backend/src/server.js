const express = require("express");
const http = require("http");
const path = require("path");

const { env, assertRequiredEnv } = require("./config/env");
assertRequiredEnv();

const {
  secureHeaders,
  corsMiddleware,
  apiLimiter,
  authLimiter,
} = require("./middleware/security.middleware");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");
const { initSocket } = require("./services/socket.service");
const { startMonitorSchedule } = require("./services/riskMonitor.service");

// ── Routes ─────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const academicRoutes = require("./routes/academic.routes");
const facultyRoutes = require("./routes/faculty.routes");
const mentorRoutes = require("./routes/mentor.routes");
const domainRoutes = require("./routes/domain.routes");
const subjectRoutes = require("./routes/subject.routes");
const studentRoutes = require("./routes/student.routes");
const studentImportRoutes = require("./routes/studentImport.routes");
const projectRoutes = require("./routes/project.routes");
const projectModulesRoutes = require("./routes/projectModules.routes");
const notificationRoutes = require("./routes/notification.routes");
const analyticsRoutes = require("./routes/analytics.routes");
const presentationRoutes = require("./routes/presentation.routes");
const meetingRoutes = require("./routes/meeting.routes");
const evaluationRoutes = require("./routes/evaluation.routes");
const messageRoutes = require("./routes/message.routes");
const reportRoutes = require("./routes/report.routes");
const searchRoutes = require("./routes/search.routes");
const activityRoutes = require("./routes/activity.routes");

const app = express();
const server = http.createServer(app);

// Trust the first proxy hop so rate limiting keys on the real client IP.
app.set("trust proxy", 1);

// ── Security & parsing ─────────────────────────────────────────────────────
app.use(secureHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Locally-stored uploads (used when Cloudinary isn't configured).
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"), {
    // Never let an uploaded file be interpreted as a page on our origin.
    setHeaders: (res) => res.setHeader("Content-Disposition", "inline"),
    dotfiles: "deny",
    index: false,
  })
);

// ── Real-time ──────────────────────────────────────────────────────────────
const io = initSocket(server);
app.set("io", io);

// ── Health ─────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) =>
  res.json({
    status: "ok",
    service: "SAPMS API",
    environment: env.nodeEnv,
    timestamp: new Date().toISOString(),
  })
);

// ── API ────────────────────────────────────────────────────────────────────
app.use("/api", apiLimiter);

// Credential endpoints get a tighter limiter on top of the global one.
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/refresh", authLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/academic", academicRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/mentors", mentorRoutes);
app.use("/api/domains", domainRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/students/import", studentImportRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/modules", projectModulesRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/presentations", presentationRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/evaluations", evaluationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/activity", activityRoutes);

// ── Errors ─────────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

server.listen(env.port, () => {
  console.log(`\n  SAPMS API listening on http://localhost:${env.port}`);
  console.log(`   Environment : ${env.nodeEnv}`);
  console.log(`   CORS origins: ${env.clientOrigins.join(", ")}`);
  console.log(`   File storage: ${env.cloudinary.enabled ? "Cloudinary" : "local disk"}`);
  console.log(`   Email       : ${env.smtp.enabled ? "SMTP configured" : "console (SMTP unset)"}\n`);

  // Expected-vs-actual progress sweep + staff digests, once a day.
  startMonitorSchedule();
});

// Surface unexpected failures instead of dying silently.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

module.exports = { app, server };
