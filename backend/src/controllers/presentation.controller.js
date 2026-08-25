const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { parsePagination, paginated } = require("../utils/pagination");
const { notifyProjectTeam } = require("../services/notification.service");
const { logActivity } = require("../services/activityLog.service");
const { scopeProjectWhere } = require("../services/access.service");

const projectInclude = {
  project: {
    include: {
      subject: { select: { id: true, name: true, code: true } },
      domain: { select: { id: true, name: true } },
      members: { include: { student: { select: { id: true, name: true, enrollmentNumber: true } } } },
      mentor: { include: { user: { select: { name: true } } } },
    },
  },
  faculty: { include: { user: { select: { name: true, email: true } } } },
};

/**
 * List presentations visible to the caller. Faculty see their own subjects,
 * mentors and students see only projects they belong to — the scope is
 * resolved on the server, never trusted from the client.
 */
const getPresentations = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { upcoming, type, projectId } = req.query;

  const where = { project: await scopeProjectWhere(req.user) };
  if (projectId) where.projectId = projectId;
  if (type) where.type = type;
  if (upcoming === "true") where.scheduledAt = { gte: new Date() };

  const [items, total] = await Promise.all([
    prisma.presentation.findMany({
      where,
      include: projectInclude,
      orderBy: { scheduledAt: upcoming === "true" ? "asc" : "desc" },
      skip,
      take,
    }),
    prisma.presentation.count({ where }),
  ]);

  res.json(paginated(items, total, { page, limit }));
});

const getPresentationById = asyncHandler(async (req, res) => {
  const presentation = await prisma.presentation.findFirst({
    where: { id: req.params.id, project: await scopeProjectWhere(req.user) },
    include: projectInclude,
  });
  if (!presentation) throw ApiError.notFound("Presentation not found.");
  res.json(presentation);
});

const createPresentation = asyncHandler(async (req, res) => {
  const { projectId, title, scheduledAt, venue, panelMembers, type, notes } = req.body;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { faculty: true },
  });
  if (!project) throw ApiError.notFound("Project not found.");

  // Faculty may only schedule for projects in their own subjects.
  if (req.user.role === "FACULTY") {
    const faculty = await prisma.faculty.findUnique({ where: { userId: req.user.id } });
    if (!faculty || project.facultyId !== faculty.id) {
      throw ApiError.forbidden("You can only schedule presentations for your own projects.");
    }
  }

  const facultyId =
    req.user.role === "FACULTY"
      ? (await prisma.faculty.findUnique({ where: { userId: req.user.id } }))?.id
      : project.facultyId;

  const presentation = await prisma.$transaction(async (tx) => {
    const created = await tx.presentation.create({
      data: {
        projectId,
        facultyId,
        title,
        scheduledAt: new Date(scheduledAt),
        venue: venue || null,
        panelMembers: panelMembers || null,
        type: type || "INTERNAL",
        notes: notes || null,
      },
      include: projectInclude,
    });

    // Scheduling a presentation moves the project into its final phase.
    if (!["COMPLETED", "ARCHIVED", "REJECTED"].includes(project.status)) {
      await tx.project.update({
        where: { id: projectId },
        data: { status: "PRESENTATION_SCHEDULED" },
      });
    }

    return created;
  });

  await notifyProjectTeam({
    projectId,
    type: "PRESENTATION_SCHEDULED",
    title: "Presentation Scheduled",
    body: `"${title}" is scheduled for ${new Date(scheduledAt).toLocaleString()}${
      venue ? ` at ${venue}` : ""
    }.`,
    link: `/projects/${projectId}`,
  });

  await logActivity({
    userId: req.user.id,
    projectId,
    action: "PRESENTATION_SCHEDULED",
    entityType: "Presentation",
    entityId: presentation.id,
  });

  res.status(201).json(presentation);
});

const updatePresentation = asyncHandler(async (req, res) => {
  const { title, scheduledAt, venue, panelMembers, type, notes } = req.body;

  const existing = await prisma.presentation.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound("Presentation not found.");

  const presentation = await prisma.presentation.update({
    where: { id: req.params.id },
    data: {
      ...(title && { title }),
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      ...(venue !== undefined && { venue }),
      ...(panelMembers !== undefined && { panelMembers }),
      ...(type && { type }),
      ...(notes !== undefined && { notes }),
    },
    include: projectInclude,
  });

  // Only re-notify when the time or place actually moved.
  const rescheduled =
    scheduledAt && new Date(scheduledAt).getTime() !== existing.scheduledAt.getTime();
  if (rescheduled || (venue !== undefined && venue !== existing.venue)) {
    await notifyProjectTeam({
      projectId: presentation.projectId,
      type: "PRESENTATION_SCHEDULED",
      title: "Presentation Rescheduled",
      body: `"${presentation.title}" now takes place on ${presentation.scheduledAt.toLocaleString()}${
        presentation.venue ? ` at ${presentation.venue}` : ""
      }.`,
      link: `/projects/${presentation.projectId}`,
    });
  }

  res.json(presentation);
});

const deletePresentation = asyncHandler(async (req, res) => {
  await prisma.presentation.delete({ where: { id: req.params.id } });
  res.json({ message: "Presentation cancelled." });
});

module.exports = {
  getPresentations,
  getPresentationById,
  createPresentation,
  updatePresentation,
  deletePresentation,
};
