const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { parsePagination, paginated } = require("../utils/pagination");
const { logActivity } = require("../services/activityLog.service");
const { scopeProjectWhere, facultyOf, mentorOf } = require("../services/access.service");
const { dispatchMultiChannel } = require("../services/channelNotification.service");

const meetingInclude = {
  project: {
    include: {
      subject: { select: { id: true, name: true, code: true } },
      members: {
        include: {
          student: {
            select: { id: true, name: true, enrollmentNumber: true, email: true, mobile: true },
          },
        },
      },
    },
  },
  mentor: { include: { user: { select: { id: true, name: true, email: true } } } },
  faculty: { include: { user: { select: { id: true, name: true, email: true } } } },
};

const getMeetings = asyncHandler(async (req, res) => {
  const { page, limit, skip, take } = parsePagination(req.query);
  const { upcoming, projectId, status } = req.query;

  const where = { project: await scopeProjectWhere(req.user) };
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (upcoming === "true") {
    where.scheduledAt = { gte: new Date() };
    where.status = { in: ["SCHEDULED", "RESCHEDULED"] };
  }

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

const getMeetingById = asyncHandler(async (req, res) => {
  const scope = await scopeProjectWhere(req.user);
  const meeting = await prisma.meeting.findFirst({
    where: {
      id: req.params.id,
      project: scope,
    },
    include: meetingInclude,
  });

  if (!meeting) throw ApiError.notFound("Meeting or review appointment not found.");
  res.json(meeting);
});

const createMeeting = asyncHandler(async (req, res) => {
  const { projectId, title, scheduledAt, timeZone, duration, type, venue, meetLink, agenda } = req.body;

  const scope = await scopeProjectWhere(req.user);
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    include: {
      members: { include: { student: true } },
      faculty: { include: { user: true } },
      mentor: { include: { user: true } },
    },
  });
  if (!project) throw ApiError.notFound("Project not found or not accessible.");

  const mentor = await mentorOf(req.user);
  const faculty = await facultyOf(req.user);

  const meeting = await prisma.meeting.create({
    data: {
      projectId,
      mentorId: mentor?.id ?? project.mentorId ?? null,
      facultyId: faculty?.id ?? project.facultyId ?? null,
      conductedById: req.user.id,
      title,
      scheduledAt: new Date(scheduledAt),
      timeZone: timeZone || "Asia/Kolkata",
      duration: duration ? Number(duration) : null,
      type: type || "IN_PERSON",
      status: "SCHEDULED",
      venue: venue || null,
      meetLink: meetLink || null,
      agenda: agenda || null,
    },
    include: meetingInclude,
  });

  // Multi-channel notification to students
  const formattedDate = new Date(scheduledAt).toLocaleString("en-IN", { timeZone: timeZone || "Asia/Kolkata" });
  for (const m of project.members) {
    await dispatchMultiChannel({
      dedupKey: `meeting-created-${meeting.id}-${m.student.id}`,
      channels: ["IN_APP", "EMAIL", "WHATSAPP"],
      recipient: {
        id: m.student.id,
        studentId: m.student.id,
        name: m.student.name,
        email: m.student.email,
        mobile: m.student.mobile,
        isStudent: true,
      },
      title: "Review / Meeting Scheduled",
      body: `"${title}" has been scheduled on ${formattedDate} (${timeZone || "Asia/Kolkata"}). ${venue ? `Venue: ${venue}` : ""}${meetLink ? `Link: ${meetLink}` : ""}`,
      link: `/student/projects/${projectId}`,
      metadata: { notificationType: "MEETING_SCHEDULED", meetingId: meeting.id, projectId },
    });
  }

  await logActivity({
    userId: req.user.id,
    projectId,
    action: "MEETING_SCHEDULED",
    entityType: "Meeting",
    entityId: meeting.id,
    metadata: { title, scheduledAt, timeZone: meeting.timeZone },
  });

  res.status(201).json(meeting);
});

const updateMeeting = asyncHandler(async (req, res) => {
  const { title, scheduledAt, timeZone, duration, type, venue, meetLink, agenda, rescheduleReason } = req.body;

  const existing = await prisma.meeting.findUnique({
    where: { id: req.params.id },
    include: {
      project: {
        include: {
          members: { include: { student: true } },
        },
      },
    },
  });
  if (!existing) throw ApiError.notFound("Meeting not found.");

  const isRescheduled = Boolean(
    (scheduledAt && new Date(scheduledAt).getTime() !== existing.scheduledAt.getTime()) ||
    rescheduleReason
  );

  const meeting = await prisma.meeting.update({
    where: { id: req.params.id },
    data: {
      ...(title && { title }),
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      ...(timeZone && { timeZone }),
      ...(duration !== undefined && { duration: duration ? Number(duration) : null }),
      ...(type && { type }),
      ...(venue !== undefined && { venue }),
      ...(meetLink !== undefined && { meetLink }),
      ...(agenda !== undefined && { agenda }),
      ...(isRescheduled && {
        status: "RESCHEDULED",
        rescheduleReason: rescheduleReason || "Date or time updated by reviewer",
        reminderSentAt: null, // Allow a new reminder for the new time
      }),
    },
    include: meetingInclude,
  });

  if (isRescheduled) {
    const formattedDate = new Date(meeting.scheduledAt).toLocaleString("en-IN", {
      timeZone: meeting.timeZone || "Asia/Kolkata",
    });

    for (const m of existing.project.members) {
      await dispatchMultiChannel({
        dedupKey: `meeting-rescheduled-${meeting.id}-${new Date(meeting.scheduledAt).getTime()}-${m.student.id}`,
        channels: ["IN_APP", "EMAIL", "WHATSAPP"],
        recipient: {
          id: m.student.id,
          studentId: m.student.id,
          name: m.student.name,
          email: m.student.email,
          mobile: m.student.mobile,
          isStudent: true,
        },
        title: "Meeting Rescheduled",
        body: `"${meeting.title}" has been rescheduled to ${formattedDate}. Reason: ${meeting.rescheduleReason || "Schedule updated."}`,
        link: `/student/projects/${meeting.projectId}`,
        metadata: { notificationType: "MEETING_SCHEDULED", meetingId: meeting.id },
      });
    }

    await logActivity({
      userId: req.user.id,
      projectId: meeting.projectId,
      action: "MEETING_RESCHEDULED",
      entityType: "Meeting",
      entityId: meeting.id,
      metadata: { newTime: meeting.scheduledAt, reason: meeting.rescheduleReason },
    });
  }

  res.json(meeting);
});

const cancelMeeting = asyncHandler(async (req, res) => {
  const { cancelReason } = req.body;

  const existing = await prisma.meeting.findUnique({
    where: { id: req.params.id },
    include: {
      project: {
        include: {
          members: { include: { student: true } },
        },
      },
    },
  });
  if (!existing) throw ApiError.notFound("Meeting not found.");

  const meeting = await prisma.meeting.update({
    where: { id: req.params.id },
    data: {
      status: "CANCELLED",
      cancelReason: cancelReason || "Cancelled by reviewer",
    },
    include: meetingInclude,
  });

  for (const m of existing.project.members) {
    await dispatchMultiChannel({
      dedupKey: `meeting-cancelled-${meeting.id}-${m.student.id}`,
      channels: ["IN_APP", "EMAIL"],
      recipient: {
        id: m.student.id,
        studentId: m.student.id,
        name: m.student.name,
        email: m.student.email,
        mobile: m.student.mobile,
        isStudent: true,
      },
      title: "Meeting Cancelled",
      body: `"${meeting.title}" has been cancelled. Reason: ${meeting.cancelReason}`,
      link: `/student/projects/${meeting.projectId}`,
      metadata: { meetingId: meeting.id },
    });
  }

  await logActivity({
    userId: req.user.id,
    projectId: meeting.projectId,
    action: "MEETING_CANCELLED",
    entityType: "Meeting",
    entityId: meeting.id,
    metadata: { reason: meeting.cancelReason },
  });

  res.json({ message: "Meeting cancelled successfully.", meeting });
});

const completeMeeting = asyncHandler(async (req, res) => {
  const { feedback } = req.body;

  const existing = await prisma.meeting.findUnique({
    where: { id: req.params.id },
    include: {
      project: {
        include: {
          members: { include: { student: true } },
        },
      },
    },
  });
  if (!existing) throw ApiError.notFound("Meeting not found.");

  const meeting = await prisma.meeting.update({
    where: { id: req.params.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      conductedById: req.user.id,
      feedback: feedback || null,
    },
    include: meetingInclude,
  });

  for (const m of existing.project.members) {
    await dispatchMultiChannel({
      dedupKey: `meeting-completed-${meeting.id}-${m.student.id}`,
      channels: ["IN_APP", "EMAIL"],
      recipient: {
        id: m.student.id,
        studentId: m.student.id,
        name: m.student.name,
        email: m.student.email,
        mobile: m.student.mobile,
        isStudent: true,
      },
      title: "Review / Meeting Completed",
      body: `Review "${meeting.title}" has been marked complete. Reviewer Feedback: ${feedback || "No additional remarks."}`,
      link: `/student/projects/${meeting.projectId}`,
      metadata: { meetingId: meeting.id },
    });
  }

  await logActivity({
    userId: req.user.id,
    projectId: meeting.projectId,
    action: "MEETING_COMPLETED",
    entityType: "Meeting",
    entityId: meeting.id,
    metadata: { feedback },
  });

  res.json({ message: "Meeting marked completed.", meeting });
});

const deleteMeeting = asyncHandler(async (req, res) => {
  const meeting = await prisma.meeting.findUnique({ where: { id: req.params.id } });
  if (!meeting) throw ApiError.notFound("Meeting not found.");

  // Soft cancel by default, or hard delete if draft/already cancelled
  if (meeting.status === "CANCELLED") {
    await prisma.meeting.delete({ where: { id: req.params.id } });
    return res.json({ message: "Meeting record deleted." });
  }

  await prisma.meeting.update({
    where: { id: req.params.id },
    data: { status: "CANCELLED", cancelReason: "Removed by user" },
  });
  res.json({ message: "Meeting cancelled." });
});

/**
 * Sweeper function to dispatch reminders for meetings starting in the next 24 hours.
 */
async function sendUpcomingMeetingReminders() {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const upcomingMeetings = await prisma.meeting.findMany({
    where: {
      status: { in: ["SCHEDULED", "RESCHEDULED"] },
      scheduledAt: { gte: now, lte: in24h },
      reminderSentAt: null,
    },
    include: {
      project: {
        include: {
          members: { include: { student: true } },
        },
      },
    },
  });

  let count = 0;
  for (const m of upcomingMeetings) {
    const formattedDate = new Date(m.scheduledAt).toLocaleString("en-IN", {
      timeZone: m.timeZone || "Asia/Kolkata",
    });

    for (const member of m.project.members) {
      await dispatchMultiChannel({
        dedupKey: `meeting-reminder-24h-${m.id}-${member.student.id}`,
        channels: ["IN_APP", "EMAIL", "WHATSAPP"],
        recipient: {
          id: member.student.id,
          studentId: member.student.id,
          name: member.student.name,
          email: member.student.email,
          mobile: member.student.mobile,
          isStudent: true,
        },
        title: "Reminder: Upcoming Project Review / Meeting",
        body: `You have an upcoming review "${m.title}" scheduled for ${formattedDate} (${m.timeZone}). Venue: ${m.venue || "Online"}.`,
        link: `/student/projects/${m.projectId}`,
        metadata: { notificationType: "MEETING_SCHEDULED", meetingId: m.id },
      });
    }

    await prisma.meeting.update({
      where: { id: m.id },
      data: { reminderSentAt: new Date() },
    });
    count++;
  }

  return { remindersSent: count };
}

module.exports = {
  getMeetings,
  getMeetingById,
  createMeeting,
  updateMeeting,
  cancelMeeting,
  completeMeeting,
  deleteMeeting,
  sendUpcomingMeetingReminders,
};
