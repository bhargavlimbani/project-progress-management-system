const prisma = require("../config/prisma");
const { logActivity } = require("../services/activityLog.service");
const { notifyUser, notifyStudent, notifyProjectTeam } = require("../services/notification.service");
const { recommendMentor, getMentorsForDomain, getAllMentorsWithWorkload } = require("../services/mentorRecommendation.service");
const { calculateProgress } = require("../services/progress.service");
const { scopeProjectWhere, getAccessibleProject } = require("../services/access.service");
const { SAFE_USER_SELECT, STUDENT_SUMMARY_SELECT } = require("../utils/safeFields");

const PROJECT_INCLUDE = {
  subject: true,
  academicYear: true,
  // `user: true` / `student: true` would serialize passwordHash (and the
  // student activation token) into every project response — always select.
  faculty: { include: { user: { select: SAFE_USER_SELECT } } },
  mentor: { include: { user: { select: SAFE_USER_SELECT } } },
  domain: true,
  members: { include: { student: { select: STUDENT_SUMMARY_SELECT } } },
  // Reviews must be nested here — the Overview tab renders the approval
  // history from project.idea.reviews, and without this it always reads
  // "No review recorded yet" even when reviews exist.
  idea: {
    include: {
      domain: true,
      reviews: {
        include: {
          reviewer: { include: { user: { select: { name: true } } } },
          mentorReviewer: { include: { user: { select: { name: true } } } },
        },
        orderBy: { reviewedAt: "desc" },
      },
    },
  },
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

    // Role-based filtering: Admin sees all, faculty strictly sees assigned projects
    if (role === "FACULTY") {
      const faculty = await prisma.faculty.findUnique({ where: { userId } });
      if (!faculty) return res.status(403).json({ message: "Faculty profile not found." });

      // Strictly assigned faculty only
      where.facultyId = faculty.id;
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
      const searchCondition = {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { members: { some: { student: { name: { contains: search, mode: "insensitive" } } } } },
          { members: { some: { student: { enrollmentNumber: { contains: search, mode: "insensitive" } } } } },
        ],
      };
      if (!where.AND) where.AND = [];
      where.AND.push(searchCondition);
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
          include: {
            reviews: {
              include: {
                mentor: { include: { user: { select: SAFE_USER_SELECT } } },
                faculty: { include: { user: { select: SAFE_USER_SELECT } } },
              },
            },
          },
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
      if (!facultyId) {
        const fallbackFaculty = await prisma.faculty.findFirst();
        facultyId = fallbackFaculty?.id;
      }
    }

    if (!facultyId) {
      return res.status(400).json({ message: "No faculty found in the system to assign to this project." });
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

    // Write access must be at least as tight as read access. Without this a
    // caller who gets 404 on GET could still PUT the same id successfully.
    const existing = await getAccessibleProject(req.user, id);
    if (!existing) return res.status(404).json({ message: "Project not found." });

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

    // Only a member of this project may submit or revise its idea — otherwise
    // any student could overwrite another team's submission.
    if (req.user.role === "STUDENT") {
      const isMember = project.members.some((m) => m.studentId === req.user.id);
      if (!isMember) {
        return res.status(403).json({ message: "You are not a member of this project." });
      }

      // Institutional attendance rule check: only enforced if ATTENDANCE_ENABLED is explicitly enabled
      const attendanceSetting = await prisma.systemSetting.findUnique({ where: { key: "ATTENDANCE_ENABLED" } });
      if (attendanceSetting?.value === "true") {
        const minAttendanceRule = await prisma.systemSetting.findUnique({ where: { key: "MIN_ATTENDANCE_FOR_IDEA" } });
        const minRequired = Number(minAttendanceRule?.value || 0);

        if (minRequired > 0) {
          const studentRecords = await prisma.attendanceRecord.findMany({
            where: { studentId: req.user.id, subjectId: project.subjectId },
          });

          if (studentRecords.length > 0) {
            const present = studentRecords.filter((r) => r.isPresent).length;
            const percentage = (present / studentRecords.length) * 100;
            if (percentage < minRequired) {
              return res.status(403).json({
                message: `Institutional policy requires a minimum of ${minRequired}% attendance to submit project ideas. Your current attendance is ${percentage.toFixed(1)}%.`,
              });
            }
          }
        }
      }
    }

    const idea = await prisma.projectIdea.upsert({
      where: { projectId },
      create: { projectId, title, abstract, problemStatement, objectives, scope, technologies, expectedOutcome, teamMembers, domainId, status: "PENDING" },
      update: { title, abstract, problemStatement, objectives, scope, technologies, expectedOutcome, teamMembers, domainId, status: "PENDING" },
    });

    // Auto-link teammates to ProjectMember if enrollment numbers or emails were entered
    if (teamMembers && typeof teamMembers === "string") {
      const tokens = teamMembers
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (tokens.length > 0) {
        const foundStudents = await prisma.student.findMany({
          where: {
            OR: [
              { enrollmentNumber: { in: tokens, mode: "insensitive" } },
              { email: { in: tokens, mode: "insensitive" } },
            ],
          },
          select: { id: true },
        });

        for (const s of foundStudents) {
          await prisma.projectMember.upsert({
            where: {
              projectId_studentId: { projectId, studentId: s.id },
            },
            create: {
              projectId,
              studentId: s.id,
              isLead: false,
            },
            update: {},
          });
        }
      }
    }

    await prisma.project.update({ where: { id: projectId }, data: { status: "IDEA_SUBMITTED", ...(domainId && { domainId }) } });

    // Notify faculty if assigned
    if (project.facultyId) {
      const faculty = await prisma.faculty.findUnique({
        where: { id: project.facultyId },
        include: { user: true },
      });
      if (faculty?.user?.id) {
        await notifyUser({
          userId: faculty.user.id,
          type: "GENERAL",
          title: "New Project Idea Submitted",
          body: `A new project idea "${title}" has been submitted for your review.`,
          link: `/faculty/projects/${projectId}/idea`,
        });
      }
    }

    res.status(201).json(idea);
  } catch (err) { next(err); }
}

// Faculty reviews project idea
async function reviewProjectIdea(req, res, next) {
  try {
    const { projectId } = req.params;
    const { status, comments } = req.body;
    const { id: userId, role } = req.user;

    if (!status || !["APPROVED", "REJECTED", "CHANGES_REQUIRED"].includes(status)) {
      return res.status(400).json({ message: "Valid status (APPROVED, REJECTED, CHANGES_REQUIRED) is required." });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, include: { idea: true, members: true } });
    if (!project?.idea) return res.status(404).json({ message: "Project idea not found." });

    const faculty = await prisma.faculty.findUnique({ where: { userId } });
    let reviewerId = faculty?.id;
    if (!reviewerId && role === "ADMIN") {
      reviewerId = project.facultyId || null;
    }

    if (!reviewerId && role !== "ADMIN") {
      return res.status(403).json({ message: "Faculty profile not found." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.ideaReview.create({
        data: { ideaId: project.idea.id, reviewerId: reviewerId || null, status, comments: comments || null },
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
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { domain: true },
    });
    if (!project) return res.status(404).json({ message: "Project not found." });

    const { recommended, allMentors, domainMatchesCount } = await getAllMentorsWithWorkload(project.domainId);

    res.json({
      recommended,
      recommendation: recommended,
      candidates: allMentors,
      mentors: allMentors,
      allMentors,
      domainMatchesCount,
      projectDomain: project.domain,
    });
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
    const { id } = req.params;
    const { role } = req.user || {};

    if (role !== "ADMIN" && role !== "FACULTY") {
      return res.status(403).json({ message: "You are not authorized to delete projects." });
    }

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return res.status(404).json({ message: "Project not found." });
    }

    if (role === "FACULTY") {
      const accessible = await getAccessibleProject(req.user, id);
      if (!accessible) {
        return res.status(403).json({ message: "You are not authorized to delete this project." });
      }
    }

    await prisma.project.delete({ where: { id } });

    await logActivity({
      userId: req.user.id,
      action: "DELETE_PROJECT",
      entityType: "Project",
      entityId: id,
    });

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
        faculty: { include: { user: { select: SAFE_USER_SELECT } } },
        mentor: { include: { user: { select: SAFE_USER_SELECT } } },
        domain: true,
        members: { include: { student: { select: STUDENT_SUMMARY_SELECT } } },
        milestones: { orderBy: { weekNumber: "asc" }, take: 20 },
        idea: true,
        _count: { select: { weeklyProgress: true, documents: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json(projects);
  } catch (err) { next(err); }
}

const { generateProjectReportPdf } = require("../services/projectReportPdf.service");

async function downloadProjectReportPdf(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        subject: true,
        academicYear: true,
        domain: true,
        faculty: { include: { user: true } },
        mentor: { include: { user: true } },
        members: { include: { student: true } },
        milestones: true,
        weeklyProgress: true,
        documents: true,
      },
    });

    if (!project) return res.status(404).json({ message: "Project not found." });

    const evaluation = await prisma.evaluation.findUnique({
      where: { projectId },
      include: {
        marks: { include: { criteria: true } },
        studentEvaluations: { include: { student: true } },
      },
    });

    const pdfBuffer = await generateProjectReportPdf(project, evaluation);

    const safeTitle = (project.title || "project")
      .replace(/[^a-zA-Z0-9-_]/g, "_")
      .slice(0, 30);
    const filename = `SAPMS-Report-${safeTitle}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
}

async function addProjectMember(req, res, next) {
  try {
    const { id: projectId } = req.params;
    const { studentId, enrollmentNumber } = req.body;

    let targetStudent = null;
    if (studentId) {
      targetStudent = await prisma.student.findUnique({ where: { id: studentId } });
    } else if (enrollmentNumber) {
      const term = String(enrollmentNumber).trim();
      targetStudent = await prisma.student.findFirst({
        where: {
          OR: [
            { enrollmentNumber: { equals: term, mode: "insensitive" } },
            { email: { equals: term, mode: "insensitive" } },
          ],
        },
      });
    }

    if (!targetStudent) {
      return res.status(404).json({ message: "Student not found with that enrollment number or email." });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { include: { student: true } } },
    });
    if (!project) return res.status(404).json({ message: "Project not found." });

    const member = await prisma.projectMember.upsert({
      where: {
        projectId_studentId: { projectId, studentId: targetStudent.id },
      },
      create: {
        projectId,
        studentId: targetStudent.id,
        isLead: false,
      },
      update: {},
      include: { student: true },
    });

    // Notify the invited student
    await notifyStudent({
      studentId: targetStudent.id,
      type: "GENERAL",
      title: "Team Project Invitation",
      body: `You have been added to the team for project "${project.title}".`,
      link: `/student/projects/${projectId}`,
    });

    res.status(201).json({ message: "Teammate added successfully.", member });
  } catch (err) { next(err); }
}

async function removeProjectMember(req, res, next) {
  try {
    const { id: projectId, memberId } = req.params;

    const member = await prisma.projectMember.findFirst({
      where: {
        projectId,
        OR: [{ id: memberId }, { studentId: memberId }],
      },
    });

    if (!member) return res.status(404).json({ message: "Member not found in this project." });
    if (member.isLead) {
      return res.status(400).json({ message: "Cannot remove the team lead. Reassign lead first." });
    }

    await prisma.projectMember.delete({ where: { id: member.id } });
    res.json({ message: "Member removed from project team." });
  } catch (err) { next(err); }
}

module.exports = {
  getProjects, getProjectById, createProject, updateProject, deleteProject,
  submitProjectIdea, reviewProjectIdea,
  getMentorRecommendation, assignMentor,
  getStudentProjects,
  downloadProjectReportPdf,
  addProjectMember,
  removeProjectMember,
};
