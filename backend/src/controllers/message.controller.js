const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { uploadFile } = require("../services/storage.service");
const { scopeProjectWhere } = require("../services/access.service");
const { listContactsFor, canMessage } = require("../services/contacts.service");

/**
 * Chat is stored in two tables because students and staff live in separate
 * identity tables. These helpers merge both sides into one ordered timeline
 * so the client sees a single conversation.
 */
function toTimelineItem(row, senderKind) {
  const sender =
    senderKind === "STUDENT"
      ? { id: row.studentId, name: row.student?.name, role: "STUDENT" }
      : { id: row.senderId, name: row.sender?.name, role: row.sender?.role };

  return {
    id: row.id,
    conversationId: row.conversationId,
    body: row.body,
    fileUrl: row.fileUrl,
    fileName: row.fileName,
    isRead: row.isRead,
    sentAt: row.sentAt,
    senderKind,
    sender,
  };
}

/** True when the caller is a participant of the conversation. */
async function assertParticipant(user, conversationId) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: true },
  });
  if (!conversation) throw ApiError.notFound("Conversation not found.");

  const isParticipant = conversation.participants.some((p) =>
    user.role === "STUDENT" ? p.studentId === user.id : p.userId === user.id
  );

  /**
   * A DIRECT thread is private between exactly two people — not even an admin
   * may read it without being one of them. Project group threads stay
   * auditable by an admin, since they are team-wide by design.
   */
  const adminMayAudit = user.role === "ADMIN" && conversation.type !== "DIRECT";

  if (!isParticipant && !adminMayAudit) {
    throw ApiError.forbidden("You are not a participant in this conversation.");
  }
  return conversation;
}

/** Every conversation the caller belongs to, newest activity first. */
const getConversations = asyncHandler(async (req, res) => {
  // Only threads the caller actually belongs to. Admins previously matched
  // `{}` here, which listed every conversation in the system — including
  // direct messages between other people.
  const where =
    req.user.role === "STUDENT"
      ? { participants: { some: { studentId: req.user.id } } }
      : { participants: { some: { userId: req.user.id } } };

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      project: {
        select: {
          id: true,
          title: true,
          subject: { select: { name: true, code: true } },
        },
      },
      participants: {
        include: {
          user: { select: { id: true, name: true, role: true, profilePhoto: true } },
          student: { select: { id: true, name: true, enrollmentNumber: true, profilePhoto: true } },
        },
      },
      messages: { orderBy: { sentAt: "desc" }, take: 1, include: { sender: { select: { name: true } } } },
      studentMessages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        include: { student: { select: { name: true } } },
      },
    },
  });

  const shaped = conversations.map((c) => {
    const candidates = [
      ...c.messages.map((m) => toTimelineItem(m, "USER")),
      ...c.studentMessages.map((m) => toTimelineItem(m, "STUDENT")),
    ].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));

    // A direct thread has no project, so it is titled by the other person.
    const me = (p) =>
      req.user.role === "STUDENT" ? p.studentId === req.user.id : p.userId === req.user.id;
    const other = c.participants.find((p) => !me(p));
    const otherPerson = other?.user || other?.student || null;

    return {
      id: c.id,
      type: c.type,
      project: c.project,
      participants: c.participants,
      title:
        c.type === "DIRECT"
          ? otherPerson?.name || "Direct message"
          : c.project?.title || "Project",
      subtitle:
        c.type === "DIRECT"
          ? other?.user?.role || (other?.student ? "STUDENT" : "")
          : c.project?.subject?.name || "",
      counterpart: otherPerson,
      lastMessage: candidates[0] || null,
      updatedAt: candidates[0]?.sentAt || c.createdAt,
    };
  });

  shaped.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  res.json(shaped);
});

/** Full merged message timeline for one conversation. */
const getMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  await assertParticipant(req.user, conversationId);

  const [userMessages, studentMessages] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: { id: true, name: true, role: true, profilePhoto: true } } },
    }),
    prisma.studentMessage.findMany({
      where: { conversationId },
      include: { student: { select: { id: true, name: true, profilePhoto: true } } },
    }),
  ]);

  const timeline = [
    ...userMessages.map((m) => toTimelineItem(m, "USER")),
    ...studentMessages.map((m) => toTimelineItem(m, "STUDENT")),
  ].sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));

  res.json(timeline);
});

/**
 * Find or create the conversation attached to a project. Participants are
 * derived from the project itself (its students, faculty and mentor) rather
 * than from anything the client supplies.
 */
const openProjectConversation = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const scope = await scopeProjectWhere(req.user);
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    include: { members: true, faculty: true, mentor: true },
  });
  if (!project) throw ApiError.notFound("Project not found or not accessible.");

  const existing = await prisma.conversation.findFirst({
    where: { projectId },
    include: { participants: true },
  });
  if (existing) return res.json(existing);

  const conversation = await prisma.$transaction(async (tx) => {
    const created = await tx.conversation.create({ data: { projectId } });

    const participants = [
      ...project.members.map((m) => ({ conversationId: created.id, studentId: m.studentId })),
    ];
    if (project.faculty) {
      participants.push({ conversationId: created.id, userId: project.faculty.userId });
    }
    if (project.mentor) {
      participants.push({ conversationId: created.id, userId: project.mentor.userId });
    }

    await tx.conversationParticipant.createMany({ data: participants, skipDuplicates: true });

    return tx.conversation.findUnique({
      where: { id: created.id },
      include: { participants: true },
    });
  });

  res.status(201).json(conversation);
});

/**
 * Post a message. The sender identity comes from the verified token, never
 * from the request body, and the row lands in the table matching the caller.
 */
const sendMessage = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const { body } = req.body;

  await assertParticipant(req.user, conversationId);

  let attachment = null;
  if (req.file) {
    attachment = await uploadFile(req.file, "chat");
  }

  const data = {
    conversationId,
    body: body?.trim() || null,
    fileUrl: attachment?.fileUrl || null,
    fileName: attachment?.fileName || null,
  };

  const created =
    req.user.role === "STUDENT"
      ? await prisma.studentMessage.create({
          data: { ...data, studentId: req.user.id },
          include: { student: { select: { id: true, name: true, profilePhoto: true } } },
        })
      : await prisma.message.create({
          data: { ...data, senderId: req.user.id },
          include: { sender: { select: { id: true, name: true, role: true, profilePhoto: true } } },
        });

  const item = toTimelineItem(created, req.user.role === "STUDENT" ? "STUDENT" : "USER");

  // Push to everyone currently watching the thread.
  req.app.get("io")?.to(`conv:${conversationId}`).emit("chat:message", item);

  res.status(201).json(item);
});

/** Mark everything the caller did not write as read. */
const markConversationRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  await assertParticipant(req.user, conversationId);

  if (req.user.role === "STUDENT") {
    await Promise.all([
      prisma.message.updateMany({ where: { conversationId, isRead: false }, data: { isRead: true } }),
      prisma.studentMessage.updateMany({
        where: { conversationId, isRead: false, studentId: { not: req.user.id } },
        data: { isRead: true },
      }),
    ]);
  } else {
    await Promise.all([
      prisma.studentMessage.updateMany({
        where: { conversationId, isRead: false },
        data: { isRead: true },
      }),
      prisma.message.updateMany({
        where: { conversationId, isRead: false, senderId: { not: req.user.id } },
        data: { isRead: true },
      }),
    ]);
  }

  res.json({ message: "Conversation marked as read." });
});

/** Unread count across all of the caller's conversations, for the navbar badge. */
const getUnreadCount = asyncHandler(async (req, res) => {
  const where =
    req.user.role === "STUDENT"
      ? { conversation: { participants: { some: { studentId: req.user.id } } } }
      : { conversation: { participants: { some: { userId: req.user.id } } } };

  const [fromUsers, fromStudents] = await Promise.all([
    prisma.message.count({
      where: {
        ...where,
        isRead: false,
        ...(req.user.role !== "STUDENT" && { senderId: { not: req.user.id } }),
      },
    }),
    prisma.studentMessage.count({
      where: {
        ...where,
        isRead: false,
        ...(req.user.role === "STUDENT" && { studentId: { not: req.user.id } }),
      },
    }),
  ]);

  res.json({ count: fromUsers + fromStudents });
});

/** People the caller may start a direct conversation with. */
const getContacts = asyncHandler(async (req, res) => {
  const { staff, students } = await listContactsFor(req.user);

  const q = String(req.query.q || "").trim().toLowerCase();
  const match = (c) =>
    !q ||
    [c.name, c.email, c.code, c.subtitle]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));

  const filteredStaff = staff.filter(match);
  const filteredStudents = students.filter(match);

  // Grouped the way the picker renders them.
  res.json({
    groups: [
      { key: "ADMIN", label: "Administrators", items: filteredStaff.filter((c) => c.role === "ADMIN") },
      { key: "FACULTY", label: "Faculty", items: filteredStaff.filter((c) => c.role === "FACULTY") },
      { key: "MENTOR", label: "Mentors", items: filteredStaff.filter((c) => c.role === "MENTOR") },
      { key: "STUDENT", label: "Students", items: filteredStudents },
    ].filter((g) => g.items.length > 0),
    total: filteredStaff.length + filteredStudents.length,
  });
});

/**
 * Find or create the one-to-one thread between the caller and one other
 * person. Idempotent: messaging the same person twice reuses the thread
 * rather than creating a second one.
 */
const openDirectConversation = asyncHandler(async (req, res) => {
  const { kind, id } = req.body;

  if (!["USER", "STUDENT"].includes(kind) || !id) {
    throw ApiError.badRequest("Provide kind ('USER' or 'STUDENT') and the person's id.");
  }
  if (!(await canMessage(req.user, { kind, id }))) {
    throw ApiError.forbidden("You cannot start a conversation with this person.");
  }

  const meIsStudent = req.user.role === "STUDENT";
  const mine = meIsStudent ? { studentId: req.user.id } : { userId: req.user.id };
  const theirs = kind === "STUDENT" ? { studentId: id } : { userId: id };

  // A direct thread containing BOTH of us and nobody else.
  const existing = await prisma.conversation.findFirst({
    where: {
      type: "DIRECT",
      AND: [{ participants: { some: mine } }, { participants: { some: theirs } }],
    },
    include: { participants: true },
  });

  if (existing && existing.participants.length === 2) {
    return res.json(existing);
  }

  const conversation = await prisma.$transaction(async (tx) => {
    const created = await tx.conversation.create({ data: { type: "DIRECT" } });
    await tx.conversationParticipant.createMany({
      data: [
        { conversationId: created.id, ...mine },
        { conversationId: created.id, ...theirs },
      ],
    });
    return tx.conversation.findUnique({
      where: { id: created.id },
      include: {
        participants: {
          include: {
            user: { select: { id: true, name: true, role: true, profilePhoto: true } },
            student: { select: { id: true, name: true, enrollmentNumber: true, profilePhoto: true } },
          },
        },
      },
    });
  });

  res.status(201).json(conversation);
});

module.exports = {
  getConversations,
  getContacts,
  openDirectConversation,
  getMessages,
  openProjectConversation,
  sendMessage,
  markConversationRead,
  getUnreadCount,
};
