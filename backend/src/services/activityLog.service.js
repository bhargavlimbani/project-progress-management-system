const prisma = require("../config/prisma");

async function logActivity({ userId, studentId, projectId, action, entityType, entityId, metadata }) {
  try {
    if (studentId) {
      await prisma.studentActivityLog.create({
        data: { studentId, action, entityType, entityId, metadata },
      });
    } else if (userId) {
      await prisma.activityLog.create({
        data: { userId, projectId, action, entityType, entityId, metadata },
      });
    }
  } catch (err) {
    // Non-critical — never throw from activity log
    console.error("Activity log error:", err.message);
  }
}

module.exports = { logActivity };
