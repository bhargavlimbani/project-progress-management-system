const prisma = require("../config/prisma");
const { VISIBLE_USER_RELATION } = require("../utils/visibility");

// ── Analytics Controller ───────────────────────────────────────────────────

async function getAdminStats(req, res, next) {
  try {
    const [
      totalStudents,
      totalFaculty,
      totalMentors,
      totalSubjects,
      totalDomains,
      totalProjects,
      activeProjects,
      completedProjects,
      atRiskProjects,
      delayedProjects,
    ] = await Promise.all([
      prisma.student.count({ where: { isActive: true } }),
      prisma.faculty.count(),
      prisma.mentor.count(),
      prisma.subject.count({ where: { isActive: true } }),
      prisma.domain.count({ where: { isActive: true } }),
      prisma.project.count(),
      prisma.project.count({ where: { status: "IN_PROGRESS" } }),
      prisma.project.count({ where: { status: "COMPLETED" } }),
      prisma.project.count({ where: { status: "AT_RISK" } }),
      prisma.project.count({ where: { status: "DELAYED" } }),
    ]);

    const pendingApprovals = await prisma.projectIdea.count({ where: { status: "PENDING" } });
    const presentationScheduled = await prisma.project.count({ where: { status: "PRESENTATION_SCHEDULED" } });

    const progressAggregate = await prisma.project.aggregate({ _avg: { progress: true } });
    const averageProgress = Math.round((progressAggregate._avg.progress || 0) * 10) / 10;

    res.json({
      totalStudents,
      totalFaculty,
      totalMentors,
      totalSubjects,
      totalDomains,
      totalProjects,
      activeProjects,
      completedProjects,
      atRiskProjects,
      delayedProjects,
      pendingApprovals,
      presentationScheduled,
      averageProgress,
    });
  } catch (err) { next(err); }
}

/**
 * Expected vs actual progress per week across the department — the chart the
 * whole system exists to produce (spec §3).
 *
 * For each week w, "actual" is the mean weighted milestone progress every
 * project had *reached* by that week, so the curve reflects real approvals
 * rather than a single aggregate stretched over time.
 */
async function getProgressTrend(req, res, next) {
  try {
    const projects = await prisma.project.findMany({
      where: { status: { notIn: ["DRAFT", "REJECTED", "ARCHIVED"] } },
      include: { subject: { select: { durationWeeks: true } }, milestones: true },
    });

    if (!projects.length) return res.json([]);

    const maxWeeks = Math.max(
      12,
      ...projects.map((p) => p.subject?.durationWeeks || 12)
    );

    const trend = [];
    for (let week = 1; week <= maxWeeks; week += 1) {
      // Only projects that have actually reached this week can contribute.
      const reached = projects.filter((p) => p.currentWeek >= week);

      let actual = 0;
      if (reached.length) {
        const sum = reached.reduce((total, project) => {
          const totalWeight = project.milestones.reduce((s, m) => s + m.weight, 0);
          if (!totalWeight) return total;
          const earned = project.milestones
            .filter((m) => m.weekNumber <= week && m.status === "APPROVED")
            .reduce((s, m) => s + m.weight, 0);
          return total + (earned / totalWeight) * 100;
        }, 0);
        actual = sum / reached.length;
      }

      trend.push({
        week,
        expected: Math.round((week / maxWeeks) * 100),
        actual: Math.round(actual * 10) / 10,
        projectsAtWeek: reached.length,
      });
    }

    res.json(trend);
  } catch (err) { next(err); }
}

async function getProjectStatusChart(req, res, next) {
  try {
    const statuses = [
      "DRAFT", "IN_PROGRESS", "AT_RISK", "DELAYED", "COMPLETED", "REJECTED",
      "IDEA_SUBMITTED", "APPROVED", "MENTOR_ASSIGNED",
    ];
    const counts = await Promise.all(
      statuses.map((s) => prisma.project.count({ where: { status: s } }).then((c) => ({ status: s, count: c })))
    );
    res.json(counts.filter((c) => c.count > 0));
  } catch (err) { next(err); }
}

async function getDomainDistribution(req, res, next) {
  try {
    const projects = await prisma.project.groupBy({
      by: ["domainId"],
      _count: { id: true },
      where: { domainId: { not: null } },
    });

    const domainIds = projects.map((p) => p.domainId).filter(Boolean);
    const domains = await prisma.domain.findMany({ where: { id: { in: domainIds } } });
    const domainMap = Object.fromEntries(domains.map((d) => [d.id, d.name]));

    res.json(
      projects.map((p) => ({
        domain: domainMap[p.domainId] || "Unknown",
        count: p._count.id,
      }))
    );
  } catch (err) { next(err); }
}

async function getMentorWorkload(req, res, next) {
  try {
    const mentors = await prisma.mentor.findMany({
      include: {
        user: { select: { name: true } },
        _count: { select: { projects: true } },
        projects: {
          where: { status: { notIn: ["COMPLETED", "REJECTED", "ARCHIVED"] } },
          select: { id: true },
        },
      },
    });

    res.json(
      mentors.map((m) => ({
        name: m.user.name,
        totalProjects: m._count.projects,
        activeProjects: m.projects.length,
      }))
    );
  } catch (err) { next(err); }
}

async function getFacultyWorkload(req, res, next) {
  try {
    const faculty = await prisma.faculty.findMany({
      include: {
        user: { select: { name: true } },
        _count: { select: { projects: true, subjects: true } },
        projects: {
          select: { status: true },
        },
      },
    });

    res.json(
      faculty.map((f) => ({
        name: f.user.name,
        designation: f.designation,
        subjects: f._count.subjects,
        totalProjects: f._count.projects,
        activeProjects: f.projects.filter(
          (p) => !["COMPLETED", "REJECTED", "ARCHIVED"].includes(p.status)
        ).length,
        pendingApprovals: f.projects.filter((p) =>
          ["IDEA_SUBMITTED", "FACULTY_REVIEW"].includes(p.status)
        ).length,
      }))
    );
  } catch (err) { next(err); }
}

async function getSubjectProjectStats(req, res, next) {
  try {
    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { projects: true } },
        projects: {
          select: { status: true },
        },
      },
    });

    res.json(
      subjects.map((s) => ({
        name: s.name,
        total: s._count.projects,
        active: s.projects.filter((p) => p.status === "IN_PROGRESS").length,
        completed: s.projects.filter((p) => p.status === "COMPLETED").length,
        atRisk: s.projects.filter((p) => p.status === "AT_RISK" || p.status === "DELAYED").length,
      }))
    );
  } catch (err) { next(err); }
}

async function getWeeklySubmissionStats(req, res, next) {
  try {
    // Progress submissions per week number
    const stats = await prisma.weeklyProgress.groupBy({
      by: ["weekNumber"],
      _count: { id: true },
      orderBy: { weekNumber: "asc" },
    });
    res.json(stats.map((s) => ({ week: s.weekNumber, submissions: s._count.id })));
  } catch (err) { next(err); }
}

async function getRecentActivity(req, res, next) {
  try {
    const logs = await prisma.activityLog.findMany({
      where: VISIBLE_USER_RELATION,
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true, role: true } } },
    });
    res.json(logs);
  } catch (err) { next(err); }
}

async function getAtRiskProjects(req, res, next) {
  try {
    const projects = await prisma.project.findMany({
      where: { status: { in: ["AT_RISK", "DELAYED"] } },
      include: {
        subject: true,
        faculty: { include: { user: true } },
        mentor: { include: { user: true } },
        members: { include: { student: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    });
    res.json(projects);
  } catch (err) { next(err); }
}

// Faculty dashboard stats
async function getFacultyStats(req, res, next) {
  try {
    const { id: userId } = req.user;
    const faculty = await prisma.faculty.findUnique({ where: { userId } });
    if (!faculty) return res.status(404).json({ message: "Faculty profile not found." });

    const [totalProjects, pendingApprovals, atRisk, delayed, completed] = await Promise.all([
      prisma.project.count({ where: { facultyId: faculty.id } }),
      prisma.projectIdea.count({ where: { project: { facultyId: faculty.id }, status: "PENDING" } }),
      prisma.project.count({ where: { facultyId: faculty.id, status: "AT_RISK" } }),
      prisma.project.count({ where: { facultyId: faculty.id, status: "DELAYED" } }),
      prisma.project.count({ where: { facultyId: faculty.id, status: "COMPLETED" } }),
    ]);

    const pendingWeeklyReviews = await prisma.weeklyProgress.count({
      where: {
        project: { facultyId: faculty.id },
        reviews: {
          some: { mentorId: { not: null }, status: "APPROVED" },
          none: { facultyId: faculty.id },
        },
      },
    });

    res.json({ totalProjects, pendingApprovals, atRisk, delayed, completed, pendingWeeklyReviews });
  } catch (err) { next(err); }
}

// Mentor dashboard stats
async function getMentorStats(req, res, next) {
  try {
    const { id: userId } = req.user;
    const mentor = await prisma.mentor.findUnique({ where: { userId } });
    if (!mentor) return res.status(404).json({ message: "Mentor profile not found." });

    const [totalProjects, atRisk, pendingReviews] = await Promise.all([
      prisma.project.count({ where: { mentorId: mentor.id } }),
      prisma.project.count({ where: { mentorId: mentor.id, status: { in: ["AT_RISK", "DELAYED"] } } }),
      prisma.weeklyProgress.count({
        where: {
          project: { mentorId: mentor.id },
          reviews: { none: { mentorId: mentor.id } },
        },
      }),
    ]);

    const upcomingMeetings = await prisma.meeting.count({
      where: { mentorId: mentor.id, scheduledAt: { gte: new Date() } },
    });

    res.json({ totalProjects, atRisk, pendingReviews, upcomingMeetings });
  } catch (err) { next(err); }
}

// Student dashboard stats
async function getStudentStats(req, res, next) {
  try {
    const { id: studentId } = req.user;
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ message: "Student not found." });

    const projects = await prisma.project.findMany({
      where: { members: { some: { studentId: student.id } } },
      select: { status: true, progress: true },
    });

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === "IN_PROGRESS").length;
    const completedProjects = projects.filter((p) => p.status === "COMPLETED").length;
    const atRiskProjects = projects.filter((p) => p.status === "AT_RISK" || p.status === "DELAYED").length;
    const overallProgress = totalProjects > 0
      ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / totalProjects)
      : 0;

    res.json({ totalProjects, activeProjects, completedProjects, atRiskProjects, overallProgress });
  } catch (err) { next(err); }
}

module.exports = {
  getAdminStats, getProjectStatusChart, getDomainDistribution,
  getMentorWorkload, getFacultyWorkload, getSubjectProjectStats, getWeeklySubmissionStats,
  getProgressTrend,
  getRecentActivity, getAtRiskProjects,
  getFacultyStats, getMentorStats, getStudentStats,
};
