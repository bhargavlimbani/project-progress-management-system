const prisma = require("../config/prisma");
const { calculateProgress } = require("../services/progress.service");
const { notifyUser, notifyStudent } = require("../services/notification.service");
const { logActivity } = require("../services/activityLog.service");

async function getWeeklyProgress(req, res, next) {
  try {
    const { projectId } = req.params;
    const progress = await prisma.weeklyProgress.findMany({
      where: { projectId },
      include: {
        milestone: true,
        reviews: {
          include: {
            mentor: { include: { user: true } },
            faculty: { include: { user: true } },
          },
        },
        student: true,
      },
      orderBy: { weekNumber: "asc" },
    });
    res.json(progress);
  } catch (err) { next(err); }
}

async function submitWeeklyProgress(req, res, next) {
  try {
    const { projectId } = req.params;
    const {
      weekNumber, taskTitle, description, completedWork,
      problemsFaced, nextWeekPlan, githubUrl, demoUrl,
      screenshots = [], files = [], milestoneId,
    } = req.body;

    const { id: studentId } = req.user;

    if (!weekNumber || !taskTitle || !description || !completedWork) {
      return res.status(400).json({ message: "Week number, task title, description, and completed work are required." });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ message: "Student profile not found." });

    const existing = await prisma.weeklyProgress.findUnique({
      where: { projectId_weekNumber: { projectId, weekNumber: parseInt(weekNumber) } },
    });

    let progress;
    if (existing) {
      progress = await prisma.weeklyProgress.update({
        where: { id: existing.id },
        data: {
          taskTitle, description, completedWork, problemsFaced, nextWeekPlan,
          githubUrl, demoUrl, screenshots, files, milestoneId,
        },
      });
    } else {
      progress = await prisma.weeklyProgress.create({
        data: {
          projectId, studentId: student.id,
          weekNumber: parseInt(weekNumber),
          taskTitle, description, completedWork, problemsFaced, nextWeekPlan,
          githubUrl, demoUrl, screenshots, files, milestoneId,
        },
      });
    }

    // Update project's current week
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { mentor: { include: { user: true } }, faculty: { include: { user: true } } },
    });
    if (project && project.currentWeek < parseInt(weekNumber)) {
      await prisma.project.update({
        where: { id: projectId },
        data: { currentWeek: parseInt(weekNumber), status: "IN_PROGRESS" },
      });
    }

    // Notify mentor for review
    if (project?.mentor) {
      await notifyUser({
        userId: project.mentor.userId,
        type: "GENERAL",
        title: "Weekly Progress Submitted",
        body: `Week ${weekNumber} progress for "${project.title}" requires your review.`,
        link: `/mentor/reviews/${progress.id}`,
      });
    }

    await logActivity({ studentId: student.id, action: "SUBMIT_WEEKLY_PROGRESS", entityType: "WeeklyProgress", entityId: progress.id, projectId });
    res.status(201).json(progress);
  } catch (err) { next(err); }
}

async function reviewProgress(req, res, next) {
  try {
    const { progressId } = req.params;
    const { status, feedback } = req.body;
    const { id: userId, role } = req.user;

    const wp = await prisma.weeklyProgress.findUnique({
      where: { id: progressId },
      include: { project: { include: { members: true, faculty: { include: { user: true } } } } },
    });
    if (!wp) return res.status(404).json({ message: "Weekly progress not found." });

    let data = { progressId, status, feedback };

    if (role === "MENTOR") {
      const mentor = await prisma.mentor.findUnique({ where: { userId } });
      if (!mentor) return res.status(403).json({ message: "Mentor profile not found." });
      data.mentorId = mentor.id;
    } else if (role === "FACULTY") {
      const faculty = await prisma.faculty.findUnique({ where: { userId } });
      if (!faculty) return res.status(403).json({ message: "Faculty profile not found." });
      data.facultyId = faculty.id;
    } else {
      return res.status(403).json({ message: "Only mentors and faculty can review progress." });
    }

    await prisma.progressReview.create({ data });

    // Notify students
    const notifType = status === "APPROVED" ? "WEEKLY_PROGRESS_APPROVED" : "WEEKLY_PROGRESS_REJECTED";
    for (const m of wp.project.members) {
      await notifyStudent({
        studentId: m.studentId,
        type: notifType,
        title: `Week ${wp.weekNumber} ${role === "MENTOR" ? "Mentor" : "Faculty"} Review`,
        body: feedback || `Your Week ${wp.weekNumber} submission has been ${status.toLowerCase()}.`,
        link: `/student/projects/${wp.projectId}`,
      });
    }

    // If faculty approved, recalculate progress
    if (role === "FACULTY" && status === "APPROVED") {
      await calculateProgress(wp.projectId);
    }

    // If mentor approved, notify faculty for verification
    if (role === "MENTOR" && status === "APPROVED" && wp.project.faculty) {
      await notifyUser({
        userId: wp.project.faculty.userId,
        type: "GENERAL",
        title: "Weekly Progress Ready for Verification",
        body: `Week ${wp.weekNumber} for "${wp.project.title}" has been reviewed by mentor and awaits your verification.`,
        link: `/faculty/projects/${wp.projectId}`,
      });
    }

    res.json({ message: "Review submitted." });
  } catch (err) { next(err); }
}

// Get pending reviews for mentor/faculty
async function getPendingReviews(req, res, next) {
  try {
    const { id: userId, role } = req.user;
    let where = {};

    if (role === "MENTOR") {
      const mentor = await prisma.mentor.findUnique({ where: { userId } });
      if (!mentor) return res.status(403).json({ message: "Mentor profile not found." });
      // All progress in mentor's projects that don't have a mentor review yet
      where = {
        project: { mentorId: mentor.id },
        reviews: { none: { mentorId: mentor.id } },
      };
    } else if (role === "FACULTY") {
      const faculty = await prisma.faculty.findUnique({ where: { userId } });
      if (!faculty) return res.status(403).json({ message: "Faculty profile not found." });
      // All progress in faculty's projects that have mentor approval but no faculty review
      where = {
        project: { facultyId: faculty.id },
        reviews: {
          some: { mentorId: { not: null }, status: "APPROVED" },
          none: { facultyId: faculty.id },
        },
      };
    }

    const pending = await prisma.weeklyProgress.findMany({
      where,
      include: {
        project: { include: { subject: true, members: { include: { student: true } } } },
        milestone: true,
        reviews: { include: { mentor: { include: { user: true } } } },
        student: true,
      },
      orderBy: { submittedAt: "asc" },
    });

    res.json(pending);
  } catch (err) { next(err); }
}

module.exports = { getWeeklyProgress, submitWeeklyProgress, reviewProgress, getPendingReviews };
