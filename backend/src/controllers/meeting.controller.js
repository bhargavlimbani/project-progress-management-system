const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { parsePagination, paginated } = require("../utils/pagination");
const { notifyProjectTeam } = require("../services/notification.service");
const { logActivity } = require("../services/activityLog.service");
const { scopeProjectWhere, facultyOf, mentorOf } = require("../services/access.service");

const meetingInclude = {
  project: {
    include: {
      subject: { select: { id: true, name: true, code: true } },
      members: { include: { student: { select: { id: true, name: true, enrollmentNumber: true } } } },
    },
  },
  mentor: { include: { user: { select: { name: true, email: true } } } },
  faculty: { include: { user: { select: { name: true, email: true } } } },
};

const getMeetings = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { upcoming, projectId } = req.query;

  const where = { project: await scopeProjectWhere(req.user) };
  if (projectId) where.projectId = projectId;
  if (upcoming === "true") where.scheduledAt = { gte: new Date() };

  const [items, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      include: meetingInclude,
      orderBy: { scheduledAt: upcoming === "true" ? "asc" : "desc" },
      skip,
      take,
    }),
    prisma.meeting.count({ where }),
  ]);

  res.json(paginated(items, total, { page, limit }));
});

const createMeeting = asyncHandler(async (req, res) => {
  const { projectId, title, scheduledAt, duration, type, venue, meetLink, agenda } = req.body;

  // Confirm the caller actually has access to this project before writing.
  const scope = await scopeProjectWhere(req.user);
  const project = await prisma.project.findFirst({ where: { AND: [{ id: projectId }, scope] } });
  if (!project) throw ApiError.notFound("Project not found or not accessible.");

  const mentor = await mentorOf(req.user);
  const faculty = await facultyOf(req.user);

  const meeting = await prisma.meeting.create({
    data: {
      projectId,
      mentorId: mentor?.id ?? project.mentorId ?? null,
      facultyId: faculty?.id ?? null,
      title,
      scheduledAt: new Date(scheduledAt),
      duration: duration ? Number(duration) : null,
      type: type || "IN_PERSON",
      venue: venue || null,
      meetLink: meetLink || null,
      agenda: agenda || null,
    },
    include: meetingInclude,
  });

  await notifyProjectTeam({
    projectId,
    type: "MEETING_SCHEDULED",
    title: "Meeting Scheduled",
    body: `"${title}" is scheduled for ${new Date(scheduledAt).toLocaleString()}.`,
    link: `/projects/${projectId}`,
  });

  await logActivity({
    userId: req.user.id,
    projectId,
    action: "MEETING_SCHEDULED",
    entityType: "Meeting",
    entityId: meeting.id,
  });

  res.status(201).json(meeting);
});

const updateMeeting = asyncHandler(async (req, res) => {
  const { title, scheduledAt, duration, type, venue, meetLink, agenda } = req.body;

  const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!existing) throw ApiError.notFound("Meeting not found.");

  const meeting = await prisma.meeting.update({
    where: { id: req.params.id },
    data: {
      ...(title && { title }),
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      ...(duration !== undefined && { duration: duration ? Number(duration) : null }),
      ...(type && { type }),
      ...(venue !== undefined && { venue }),
      ...(meetLink !== undefined && { meetLink }),
      ...(agenda !== undefined && { agenda }),
    },
    include: meetingInclude,
  });

  if (scheduledAt && new Date(scheduledAt).getTime() !== existing.scheduledAt.getTime()) {
    await notifyProjectTeam({
      projectId: meeting.projectId,
      type: "MEETING_SCHEDULED",
      title: "Meeting Rescheduled",
      body: `"${meeting.title}" now takes place on ${meeting.scheduledAt.toLocaleString()}.`,
      link: `/projects/${meeting.projectId}`,
    });
  }

  res.json(meeting);
});

const deleteMeeting = asyncHandler(async (req, res) => {
  await prisma.meeting.delete({ where: { id: req.params.id } });
  res.json({ message: "Meeting cancelled." });
});

module.exports = { getMeetings, createMeeting, updateMeeting, deleteMeeting };
