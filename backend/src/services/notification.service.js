const prisma = require("../config/prisma");

/**
 * Send an in-app notification to a staff user (User table)
 */
async function notifyUser({ userId, type, title, body, link }) {
  try {
    await prisma.notification.create({ data: { userId, type, title, body, link } });
  } catch (err) {
    console.error("Notification error:", err.message);
  }
}

/**
 * Send an in-app notification to a student
 */
async function notifyStudent({ studentId, type, title, body, link }) {
  try {
    await prisma.studentNotification.create({ data: { studentId, type, title, body, link } });
  } catch (err) {
    console.error("Student notification error:", err.message);
  }
}

/**
 * Notify all members of a project (students + faculty + mentor)
 */
async function notifyProjectTeam({ projectId, type, title, body, link, excludeStudentId }) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: true,
        faculty: { include: { user: true } },
        mentor: { include: { user: true } },
      },
    });
    if (!project) return;

    const promises = [];

    // Notify students
    for (const m of project.members) {
      if (m.studentId !== excludeStudentId) {
        promises.push(notifyStudent({ studentId: m.studentId, type, title, body, link }));
      }
    }

    // Notify faculty
    if (project.faculty?.user) {
      promises.push(notifyUser({ userId: project.faculty.userId, type, title, body, link }));
    }

    // Notify mentor
    if (project.mentor?.user) {
      promises.push(notifyUser({ userId: project.mentor.userId, type, title, body, link }));
    }

    await Promise.allSettled(promises);
  } catch (err) {
    console.error("Project team notification error:", err.message);
  }
}

module.exports = { notifyUser, notifyStudent, notifyProjectTeam };
