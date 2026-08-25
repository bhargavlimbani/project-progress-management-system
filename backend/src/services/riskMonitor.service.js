const prisma = require("../config/prisma");
const { calculateProgress } = require("./progress.service");
const { notifyUser, notifyStudent } = require("./notification.service");
const { sendTemplate } = require("./email.service");
const { env } = require("../config/env");

/**
 * The system's core promise (spec §3): it is not enough to know whether a
 * project finished — we need to know whether it progressed each week.
 *
 * This module runs the comparison of expected vs actual progress across every
 * active project, advances the week counter as the calendar moves, and nudges
 * everyone who needs to act.
 */

const ACTIVE_STATUSES = [
  "IN_PROGRESS",
  "MENTOR_ASSIGNED",
  "SRS_APPROVED",
  "PROBLEM_STATEMENT_PENDING",
  "SRS_PENDING",
  "AT_RISK",
  "DELAYED",
];

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/**
 * Which week a project is in, derived from its start date rather than a
 * counter someone has to remember to increment.
 */
function weekFromStartDate(startDate, durationWeeks) {
  if (!startDate) return null;
  const elapsed = Date.now() - new Date(startDate).getTime();
  if (elapsed < 0) return 0;
  return Math.min(durationWeeks, Math.floor(elapsed / MS_PER_WEEK) + 1);
}

/**
 * Recalculate progress and risk for every active project.
 * Returns a summary so the caller (cron or an admin action) can report it.
 */
async function sweepProjects() {
  const projects = await prisma.project.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    include: { subject: true },
  });

  const summary = { scanned: 0, weekAdvanced: 0, atRisk: 0, delayed: 0, onTrack: 0 };

  for (const project of projects) {
    summary.scanned += 1;

    // Keep currentWeek honest against the calendar before judging progress.
    const durationWeeks = project.subject?.durationWeeks || 12;
    const derivedWeek = weekFromStartDate(project.startDate, durationWeeks);
    if (derivedWeek !== null && derivedWeek !== project.currentWeek) {
      await prisma.project.update({
        where: { id: project.id },
        data: { currentWeek: derivedWeek },
      });
      summary.weekAdvanced += 1;
    }

    // calculateProgress writes the new status and fires notifications on change.
    await calculateProgress(project.id);

    const updated = await prisma.project.findUnique({
      where: { id: project.id },
      select: { status: true },
    });

    if (updated?.status === "AT_RISK") summary.atRisk += 1;
    else if (updated?.status === "DELAYED") summary.delayed += 1;
    else summary.onTrack += 1;
  }

  return summary;
}

/**
 * Remind students who have not submitted progress for the week their project
 * is currently in. In-app notification plus an email (spec §46).
 */
async function sendWeeklyReminders() {
  const projects = await prisma.project.findMany({
    where: { status: { in: ACTIVE_STATUSES }, currentWeek: { gt: 0 } },
    include: {
      subject: true,
      members: { include: { student: true } },
      weeklyProgress: { select: { weekNumber: true, studentId: true } },
    },
  });

  let sent = 0;

  for (const project of projects) {
    const submittedThisWeek = new Set(
      project.weeklyProgress
        .filter((wp) => wp.weekNumber === project.currentWeek)
        .map((wp) => wp.studentId)
    );

    for (const member of project.members) {
      if (submittedThisWeek.has(member.studentId)) continue;

      const student = member.student;
      const link = `${env.appBaseUrl}/student/projects/${project.id}`;

      await notifyStudent({
        studentId: student.id,
        type: "WEEKLY_PROGRESS_REMINDER",
        title: `Week ${project.currentWeek} progress is due`,
        body: `Submit your Week ${project.currentWeek} update for "${project.title}" with evidence attached.`,
        link: `/student/projects/${project.id}`,
      });

      sendTemplate("weeklyReminder", student.email, {
        name: student.name,
        weekNumber: project.currentWeek,
        projectTitle: project.title,
        dueLabel: "this week",
        link,
      });

      sent += 1;
    }
  }

  return { remindersSent: sent };
}

/**
 * Digest emails for staff: mentors get their pending review count, faculty
 * get their at-risk count. Sent as one message each rather than per event.
 */
async function sendStaffDigests() {
  const result = { mentorDigests: 0, facultyDigests: 0 };

  const mentors = await prisma.mentor.findMany({ include: { user: true } });
  for (const mentor of mentors) {
    const pending = await prisma.weeklyProgress.count({
      where: {
        project: { mentorId: mentor.id },
        reviews: { none: { mentorId: { not: null } } },
      },
    });
    if (pending === 0) continue;

    await notifyUser({
      userId: mentor.userId,
      type: "GENERAL",
      title: "Weekly reviews pending",
      body: `${pending} weekly submission${pending === 1 ? "" : "s"} awaiting your review.`,
      link: "/mentor/weekly-reviews",
    });

    sendTemplate("pendingReviews", mentor.user.email, {
      name: mentor.user.name,
      count: pending,
      link: `${env.appBaseUrl}/mentor/weekly-reviews`,
    });
    result.mentorDigests += 1;
  }

  const faculty = await prisma.faculty.findMany({ include: { user: true } });
  for (const f of faculty) {
    const atRisk = await prisma.project.count({
      where: { facultyId: f.id, status: { in: ["AT_RISK", "DELAYED"] } },
    });
    if (atRisk === 0) continue;

    await notifyUser({
      userId: f.userId,
      type: "PROJECT_AT_RISK",
      title: "Projects need attention",
      body: `${atRisk} of your projects ${atRisk === 1 ? "is" : "are"} at risk or delayed.`,
      link: "/faculty/projects?status=AT_RISK",
    });

    sendTemplate("atRiskDigest", f.user.email, {
      name: f.user.name,
      count: atRisk,
      link: `${env.appBaseUrl}/faculty/projects?status=AT_RISK`,
    });
    result.facultyDigests += 1;
  }

  return result;
}

/** Run everything — used by the daily timer and the admin trigger. */
async function runDailyMonitor() {
  const sweep = await sweepProjects();
  const digests = await sendStaffDigests();
  return { ...sweep, ...digests, ranAt: new Date().toISOString() };
}

/**
 * Start the in-process daily timer. Deliberately simple: for a single-instance
 * deployment this is enough, and it avoids adding a scheduler dependency. If
 * SAPMS is ever run multi-instance, move this to an external cron hitting
 * POST /api/analytics/run-monitor instead.
 */
function startMonitorSchedule() {
  const DAY = 24 * 60 * 60 * 1000;

  // First pass shortly after boot so a fresh deploy reflects reality quickly.
  const bootTimer = setTimeout(() => {
    runDailyMonitor().catch((err) => console.error("Risk monitor failed:", err.message));
  }, 60 * 1000);

  const dailyTimer = setInterval(() => {
    runDailyMonitor().catch((err) => console.error("Risk monitor failed:", err.message));
  }, DAY);

  // Don't hold the process open during tests or a graceful shutdown.
  bootTimer.unref?.();
  dailyTimer.unref?.();

  return () => {
    clearTimeout(bootTimer);
    clearInterval(dailyTimer);
  };
}

module.exports = {
  sweepProjects,
  sendWeeklyReminders,
  sendStaffDigests,
  runDailyMonitor,
  startMonitorSchedule,
  weekFromStartDate,
};
