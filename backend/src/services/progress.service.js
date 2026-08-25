const prisma = require("../config/prisma");
const { notifyProjectTeam, notifyStudent, notifyUser } = require("./notification.service");

/**
 * Recalculate a project's overall progress based on
 * approved weekly submissions and milestone weights.
 */
async function calculateProgress(projectId) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        milestones: true,
        weeklyProgress: {
          include: { reviews: true },
        },
        subject: true,
      },
    });

    if (!project) return 0;

    const totalWeeks = project.subject?.durationWeeks || 12;
    const milestones = project.milestones;

    let progress = 0;

    if (milestones.length > 0) {
      // Weighted milestone progress
      const totalWeight = milestones.reduce((sum, m) => sum + m.weight, 0);
      if (totalWeight > 0) {
        const completedWeight = milestones
          .filter((m) => m.status === "APPROVED")
          .reduce((sum, m) => sum + m.weight, 0);
        progress = (completedWeight / totalWeight) * 100;
      }
    } else {
      // Weekly progress count
      const approvedWeeks = project.weeklyProgress.filter((wp) =>
        wp.reviews.some((r) => r.status === "APPROVED" && r.facultyId)
      ).length;
      progress = totalWeeks > 0 ? (approvedWeeks / totalWeeks) * 100 : 0;
    }

    progress = Math.min(Math.round(progress * 10) / 10, 100);

    // Detect risk/delay
    const currentWeek = project.currentWeek;
    const expectedProgress = (currentWeek / totalWeeks) * 100;
    let newStatus = project.status;

    const activeStatuses = [
      "IN_PROGRESS", "MENTOR_ASSIGNED", "SRS_APPROVED",
      "PROBLEM_STATEMENT_PENDING", "SRS_PENDING", "AT_RISK", "DELAYED",
    ];

    if (activeStatuses.includes(project.status)) {
      if (progress < expectedProgress - 30) {
        newStatus = "DELAYED";
      } else if (progress < expectedProgress - 15) {
        newStatus = "AT_RISK";
      } else {
        newStatus = "IN_PROGRESS";
      }
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { progress, status: newStatus },
    });

    // Send at-risk/delayed notifications
    if (newStatus === "AT_RISK" && project.status !== "AT_RISK") {
      await notifyProjectTeam({
        projectId,
        type: "PROJECT_AT_RISK",
        title: "Project At Risk",
        body: `Project "${project.title}" is falling behind schedule.`,
        link: `/projects/${projectId}`,
      });
    } else if (newStatus === "DELAYED" && project.status !== "DELAYED") {
      await notifyProjectTeam({
        projectId,
        type: "PROJECT_DELAYED",
        title: "Project Delayed",
        body: `Project "${project.title}" is significantly delayed.`,
        link: `/projects/${projectId}`,
      });
    }

    return progress;
  } catch (err) {
    console.error("Progress calculation error:", err.message);
    return 0;
  }
}

/**
 * Advance the current week of a project
 */
async function advanceProjectWeek(projectId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return;
  await prisma.project.update({
    where: { id: projectId },
    data: { currentWeek: project.currentWeek + 1 },
  });
}

module.exports = { calculateProgress, advanceProjectWeek };
