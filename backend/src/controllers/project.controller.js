const prisma = require("../config/prisma");
const { logActivity } = require("../services/activityLog.service");
const { notifyUser, notifyStudent, notifyProjectTeam } = require("../services/notification.service");
const { recommendMentor, getMentorsForDomain } = require("../services/mentorRecommendation.service");
const { calculateProgress } = require("../services/progress.service");
const { scopeProjectWhere } = require("../services/access.service");

const PROJECT_INCLUDE = {
  subject: true,
  academicYear: true,
  faculty: { include: { user: true } },
  mentor: { include: { user: true } },
  domain: true,
  members: { include: { student: true } },
  idea: true,
  milestones: { orderBy: { weekNumber: "asc" } },
  _count: { select: { weeklyProgress: true, documents: true } },
};

async function getProjects(req, res, next) {
  try {
    const { role, id: userId } = req.user;
    const { subjectId, facultyId, mentorId, domainId, status, academicYearId, search, page = 1, limit = 20 } = req.query;

    const where = {};
    if (subjectId) where.subjectId = subjectId;
    if (domainId) where.domainId = domainId;
    if (status) where.status = status;
    if (academicYearId) where.academicYearId = academicYearId;

    // Role-based filtering
    if (role === "FACULTY") {
      const faculty = await prisma.faculty.findUnique({ where: { userId } });
      if (!faculty) return res.status(403).json({ message: "Faculty profile not found." });
      where.facultyId = facultyId || faculty.id;
    } else if (role === "MENTOR") {
      const mentor = await prisma.mentor.findUnique({ where: { userId } });
      if (!mentor) return res.status(403).json({ message: "Mentor profile not found." });
      where.mentorId = mentor.id;
    } else if (role === "STUDENT") {
      // Students see only their projects
      const student = await prisma.student.findUnique({ where: { id: userId } });
      if (!student) return res.status(403).json({ message: "Student profile not found." });
      where.members = { some: { studentId: student.id } };
    } else {
      // Admin can filter by facultyId
      if (facultyId) where.facultyId = facultyId;
      if (mentorId) where.mentorId = mentorId;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { members: { some: { student: { name: { contains: search, mode: "insensitive" } } } } },
        { members: { some: { student: { enrollmentNumber: { contains: search, mode: "insensitive" } } } } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: PROJECT_INCLUDE,
        orderBy: { updatedAt: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.project.count({ where }),
    ]);

    res.json({ projects, total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
}

async function getProjectById(req, res, next) {
  try {
    const { id } = req.params;

    // Scope the lookup to what this caller may see — a valid token for one
    // role must not be able to read another cohort's project by guessing an id.
    const scope = await scopeProjectWhere(req.user);

    const project = await prisma.project.findFirst({
      where: { AND: [{ id }, scope] },
      include: {
        ...PROJECT_INCLUDE,
        weeklyProgress: {
          include: { reviews: { include: { mentor: { include: { user: true } }, faculty: { include: { user: true } } } } },
          orderBy: { weekNumber: "asc" },
        },
        documents: {
          include: { versions: { orderBy: { version: "desc" }, take: 5 } },
        },
        conversations: {
          include: { participants: true, messages: { take: 1, orderBy: { sentAt: "desc" } } },
        },
        evaluation: { include: { marks: { include: { criteria: true } } } },
        presentations: { orderBy: { scheduledAt: "desc" } },
        meetings: { orderBy: { scheduledAt: "desc" }, take: 10 },
      },
    });
    if (!project) return res.status(404).json({ message: "Project not found." });
    res.json(project);
  } catch (err) { next(err); }
}

async function createProject(req, res, next) {
  try {
    const { title, subjectId, academicYearId, studentIds } = req.body;
    const { role, id: userId } = req.user;

    if (!title || !subjectId || !academicYearId) {
      return res.status(400).json({ message: "Title, subjectId, and academicYearId are required." });
    }

    // Get faculty from the subject
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      include: { faculty: { include: { faculty: true } } },
    });
    if (!subject) return res.status(404).json({ message: "Subject not found." });

    let facultyId;
    if (role === "FACULTY") {
      const faculty = await prisma.faculty.findUnique({ where: { userId } });
      if (!faculty) return res.status(403).json({ message: "Faculty profile not found." });
      facultyId = faculty.id;
    } else {
      facultyId = subject.faculty[0]?.facultyId;
    }

    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: { title, subjectId, academicYearId, facultyId, status: "DRAFT" },
      });

      let memberStudentIds = studentIds || [];
      if (role === "STUDENT") {
        const student = await tx.student.findUnique({ where: { id: userId } });
        if (student && !memberStudentIds.includes(student.id)) {
          memberStudentIds = [student.id, ...memberStudentIds];
        }
      }

      if (memberStudentIds.length) {
        await tx.projectMember.createMany({
          data: memberStudentIds.map((sid, i) => ({ projectId: p.id, studentId: sid, isLead: i === 0 })),
          skipDuplicates: true,
        });
      }

      return p;
    });

    await logActivity({ userId: role !== "STUDENT" ? userId : undefined, action: "CREATE_PROJECT", entityType: "Project", entityId: project.id, projectId: project.id });
    res.status(201).json(project);
  } catch (err) { next(err); }
}

async function updateProject(req, res, next) {
  try {
    const { id } = req.params;
    const { title, status, currentWeek, startDate, endDate, domainId, mentorId } = req.body;
    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(status && { status }),
        ...(currentWeek !== undefined && { currentWeek: parseInt(currentWeek) }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(domainId !== undefined && { domainId }),
        ...(mentorId !== undefined && { mentorId }),
      },
    });
    res.json(project);
  } catch (err) { next(err); }
}

// Project idea submission
async function submitProjectIdea(req, res, next) {
  try {
    const { projectId } = req.params;
    const { title, abstract, problemStatement, objectives, scope, technologies, expectedOutcome, teamMembers, domainId } = req.body;

    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
    if (!project) return res.status(404).json({ message: "Project not found." });

    const idea = await prisma.projectIdea.upsert({
      where: { projectId },
      create: { projectId, title, abstract, problemStatement, objectives, scope, technologies, expectedOutcome, teamMembers, domainId, status: "PENDING" },
      update: { title, abstract, problemStatement, objectives, scope, technologies, expectedOutcome, teamMembers, domainId, status: "PENDING" },
    });

    await prisma.project.update({ where: { id: projectId }, data: { status: "IDEA_SUBMITTED", ...(domainId && { domainId }) } });

    // Notify faculty
    await notifyUser({
      userId: project.faculty ? (await prisma.faculty.findUnique({ where: { id: project.facultyId }, include: { user: true } }))?.userId : null,
      type: "GENERAL",
      title: "New Project Idea Submitted",
      body: `A new project idea "${title}" has been submitted for your review.`,
      link: `/faculty/projects/${projectId}/idea`,
    });

    res.status(201).json(idea);
  } catch (err) { next(err); }
}

// Faculty reviews project idea
async function reviewProjectIdea(req, res, next) {
  try {
    const { projectId } = req.params;
    const { status, comments } = req.body; // APPROVED | REJECTED | CHANGES_REQUIRED
    const { id: userId } = req.user;

    const faculty = await prisma.faculty.findUnique({ where: { userId } });
    if (!faculty) return res.status(403).json({ message: "Faculty profile not found." });

    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { idea: true, members: true } });
    if (!project?.idea) return res.status(404).json({ message: "Project idea not found." });

    await prisma.$transaction(async (tx) => {
      await tx.ideaReview.create({
        data: { ideaId: project.idea.id, reviewerId: faculty.id, status, comments },
      });
      await tx.projectIdea.update({ where: { projectId }, data: { status } });

      let newProjectStatus;
      if (status === "APPROVED") newProjectStatus = "APPROVED";
      else if (status === "REJECTED") newProjectStatus = "REJECTED";
      else newProjectStatus = "CHANGES_REQUIRED";
      await tx.project.update({ where: { id: projectId }, data: { status: newProjectStatus } });
    });

    // Notify students
    for (const m of project.members) {
      await notifyStudent({
        studentId: m.studentId,
        type: status === "APPROVED" ? "IDEA_APPROVED" : status === "REJECTED" ? "IDEA_REJECTED" : "IDEA_CHANGES_REQUIRED",
        title: `Project Idea ${status === "APPROVED" ? "Approved" : status === "REJECTED" ? "Rejected" : "Changes Required"}`,
        body: comments || `Your project idea has been ${status.toLowerCase().replace("_", " ")}.`,
        link: `/student/projects/${projectId}`,
      });
    }

    res.json({ message: "Review submitted." });
  } catch (err) { next(err); }
}

// Mentor recommendation
async function getMentorRecommendation(req, res, next) {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project?.domainId) return res.status(400).json({ message: "Project has no domain assigned." });

    const recommended = await recommendMentor(project.domainId);
    const allMentors = await getMentorsForDomain(project.domainId);

    res.json({ recommended, allMentors });
  } catch (err) { next(err); }
}

// Assign mentor to project
async function assignMentor(req, res, next) {
  try {
    const { projectId } = req.params;
    const { mentorId } = req.body;
    const { id: userId } = req.user;

    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
    if (!project) return res.status(404).json({ message: "Project not found." });

    await prisma.project.update({
      where: { id: projectId },
      data: { mentorId, status: "MENTOR_ASSIGNED" },
    });

    // Notify students
    const mentor = await prisma.mentor.findUnique({ where: { id: mentorId }, include: { user: true } });
    for (const m of project.members) {
      await notifyStudent({
        studentId: m.studentId,
        type: "MENTOR_ASSIGNED",
        title: "Mentor Assigned",
        body: `${mentor?.user?.name} has been assigned as your mentor.`,
        link: `/student/projects/${projectId}`,
      });
    }

    await logActivity({ userId, action: "ASSIGN_MENTOR", entityType: "Project", entityId: projectId, projectId });
    res.json({ message: "Mentor assigned successfully." });
  } catch (err) { next(err); }
}

async function deleteProject(req, res, next) {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: "Project deleted." });
  } catch (err) { next(err); }
}

// Student projects (for student dashboard)
async function getStudentProjects(req, res, next) {
  try {
    const { id: studentId } = req.user;
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ message: "Student not found." });

    const projects = await prisma.project.findMany({
      where: { members: { some: { studentId: student.id } } },
      include: {
        subject: true,
        faculty: { include: { user: true } },
        mentor: { include: { user: true } },
        domain: true,
        members: { include: { student: true } },
        milestones: { orderBy: { weekNumber: "asc" }, take: 20 },
        idea: true,
        _count: { select: { weeklyProgress: true, documents: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json(projects);
  } catch (err) { next(err); }
}

module.exports = {
  getProjects, getProjectById, createProject, updateProject, deleteProject,
  submitProjectIdea, reviewProjectIdea,
  getMentorRecommendation, assignMentor,
  getStudentProjects,
};
