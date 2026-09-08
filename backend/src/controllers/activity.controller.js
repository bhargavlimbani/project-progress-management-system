const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const { parsePagination, paginated } = require("../utils/pagination");
const { getAccessibleProject, scopeProjectWhere } = require("../services/access.service");
const ApiError = require("../utils/ApiError");
const { VISIBLE_USER_RELATION } = require("../utils/visibility");

/** Merge staff and student log rows into one reverse-chronological feed. */
function mergeLogs(userLogs, studentLogs) {
  return [
    ...userLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata,
      createdAt: l.createdAt,
      actor: l.user ? { id: l.user.id, name: l.user.name, role: l.user.role } : null,
      project: l.project ? { id: l.project.id, title: l.project.title } : null,
    })),
    ...studentLogs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata,
      createdAt: l.createdAt,
      actor: { id: l.student.id, name: l.student.name, role: "STUDENT" },
      project: null,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Department-wide activity feed. Admin only. */
const getActivityLog = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { action, userId } = req.query;

  // Actions taken by a hidden account stay out of the audit feed.
  const userWhere = { ...VISIBLE_USER_RELATION };
  if (action) userWhere.action = action;
  if (userId) userWhere.userId = userId;

  const [userLogs, studentLogs, userTotal, studentTotal] = await Promise.all([
    prisma.activityLog.findMany({
      where: userWhere,
      include: {
        user: { select: { id: true, name: true, role: true } },
        project: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: skip + take,
    }),
    prisma.studentActivityLog.findMany({
      where: action ? { action } : {},
      include: { student: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: skip + take,
    }),
    prisma.activityLog.count({ where: userWhere }),
    prisma.studentActivityLog.count({ where: action ? { action } : {} }),
  ]);

  const merged = mergeLogs(userLogs, studentLogs).slice(skip, skip + take);
  res.json(paginated(merged, userTotal + studentTotal, { page, limit }));
});

/** Activity for one project — the Activity tab on the project details page. */
const getProjectActivity = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await getAccessibleProject(req.user, projectId);
  if (!project) throw ApiError.notFound("Project not found or not accessible.");

  const logs = await prisma.activityLog.findMany({
    where: { projectId, ...VISIBLE_USER_RELATION },
    include: {
      user: { select: { id: true, name: true, role: true } },
      project: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Student-side actions are logged without a projectId, so pull the ones
  // belonging to this project's members and filter by entity.
  const memberIds = (
    await prisma.projectMember.findMany({ where: { projectId }, select: { studentId: true } })
  ).map((m) => m.studentId);

  const studentLogs = await prisma.studentActivityLog.findMany({
    where: {
      studentId: { in: memberIds },
      OR: [{ entityId: projectId }, { metadata: { path: ["projectId"], equals: projectId } }],
    },
    include: { student: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  res.json(mergeLogs(logs, studentLogs));
});

/** The signed-in user's own recent activity. */
const getMyActivity = asyncHandler(async (req, res) => {
  const { take } = parsePagination(req.query);

  if (req.user.role === "STUDENT") {
    const logs = await prisma.studentActivityLog.findMany({
      where: { studentId: req.user.id },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });
    return res.json(mergeLogs([], logs));
  }

  const logs = await prisma.activityLog.findMany({
    where: { userId: req.user.id },
    include: {
      user: { select: { id: true, name: true, role: true } },
      project: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  res.json(mergeLogs(logs, []));
});

module.exports = { getActivityLog, getProjectActivity, getMyActivity };
