const prisma = require("../config/prisma");

async function getNotifications(req, res, next) {
  try {
    const { id: userId, role } = req.user;
    let notifications;

    if (role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { id: userId } });
      if (!student) return res.json([]);
      notifications = await prisma.studentNotification.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    } else {
      notifications = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }

    res.json(notifications);
  } catch (err) { next(err); }
}

async function markAsRead(req, res, next) {
  try {
    const { id: userId, role } = req.user;
    const { ids } = req.body; // optional array of IDs; if empty, mark all

    if (role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { id: userId } });
      if (!student) return res.json({ message: "Done." });
      const where = { studentId: student.id, isRead: false };
      if (ids?.length) where.id = { in: ids };
      await prisma.studentNotification.updateMany({ where, data: { isRead: true } });
    } else {
      const where = { userId, isRead: false };
      if (ids?.length) where.id = { in: ids };
      await prisma.notification.updateMany({ where, data: { isRead: true } });
    }

    res.json({ message: "Notifications marked as read." });
  } catch (err) { next(err); }
}

async function getUnreadCount(req, res, next) {
  try {
    const { id: userId, role } = req.user;
    let count;

    if (role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { id: userId } });
      count = student
        ? await prisma.studentNotification.count({ where: { studentId: student.id, isRead: false } })
        : 0;
    } else {
      count = await prisma.notification.count({ where: { userId, isRead: false } });
    }

    res.json({ count });
  } catch (err) { next(err); }
}

module.exports = { getNotifications, markAsRead, getUnreadCount };
