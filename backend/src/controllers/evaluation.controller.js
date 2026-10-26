const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { logActivity } = require("../services/activityLog.service");
const { scopeProjectWhere, facultyOf } = require("../services/access.service");
const { dispatchMultiChannel, getManualWhatsAppShareUrl } = require("../services/channelNotification.service");
const {
  generateStudentEvaluationPdf,
  generateProjectEvaluationPdf,
} = require("../services/export.service");

/** Percentage → letter grade used across reports and the evaluation UI. */
function gradeFor(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B+";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 40) return "D";
  return "F";
}

const evaluationInclude = {
  marks: { include: { criteria: true } },
  faculty: { include: { user: { select: { id: true, name: true, email: true } } } },
  studentEvaluations: {
    include: {
      student: { select: { id: true, name: true, enrollmentNumber: true, email: true, mobile: true } },
      marks: { include: { criteria: true } },
    },
  },
  project: {
    include: {
      subject: { select: { id: true, name: true, code: true } },
      domain: { select: { name: true } },
      mentor: { include: { user: { select: { id: true, name: true, email: true } } } },
      members: {
        include: {
          student: { select: { id: true, name: true, enrollmentNumber: true, email: true, mobile: true } },
        },
      },
    },
  },
};

/** Evaluations across every project the caller can see. */
const getEvaluations = asyncHandler(async (req, res) => {
  const where = { project: await scopeProjectWhere(req.user) };
  if (req.query.subjectId) where.project = { ...where.project, subjectId: req.query.subjectId };

  // If a student calls the general list, only return published ones
  if (req.user.role === "STUDENT") {
    where.isPublished = true;
  }

  const evaluations = await prisma.evaluation.findMany({
    where,
    include: evaluationInclude,
    orderBy: { updatedAt: "desc" },
  });

  // Filter student-private data if student caller
  if (req.user.role === "STUDENT") {
    const studentId = req.user.id;
    const sanitized = evaluations.map((e) => ({
      ...e,
      studentEvaluations: e.studentEvaluations.filter((se) => se.studentId === studentId),
    }));
    return res.json(sanitized);
  }

  res.json(evaluations);
});

/**
 * Evaluation sheet for one project.
 * Implements strict privacy boundary: students can NEVER see draft marks,
 * and can only see their own individual evaluation when published.
 */
const getProjectEvaluation = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const scope = await scopeProjectWhere(req.user);
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    include: {
      subject: true,
      faculty: { include: { user: true } },
      mentor: { include: { user: true } },
      members: { include: { student: true } },
    },
  });
  if (!project) throw ApiError.notFound("Project not found or not accessible.");

  const [criteria, evaluation] = await Promise.all([
    prisma.evaluationCriteria.findMany({
      where: { subjectId: project.subjectId, isActive: true },
      orderBy: [{ scope: "asc" }, { name: "asc" }],
    }),
    prisma.evaluation.findUnique({
      where: { projectId },
      include: evaluationInclude,
    }),
  ]);

  const teamCriteria = criteria.filter((c) => c.scope === "TEAM");
  const individualCriteria = criteria.filter((c) => c.scope === "INDIVIDUAL");

  const teamMax = teamCriteria.reduce((sum, c) => sum + c.maxMarks, 0);
  const individualMax = individualCriteria.reduce((sum, c) => sum + c.maxMarks, 0);
  const maxTotal = criteria.reduce((sum, c) => sum + c.maxMarks, 0);

  // Student Access: if unpublished, hide draft results
  if (req.user.role === "STUDENT") {
    const studentId = req.user.id;
    if (!evaluation || !evaluation.isPublished) {
      return res.json({
        project: { id: project.id, title: project.title, subject: project.subject },
        criteria,
        maxTotal,
        teamMax,
        individualMax,
        isPublished: false,
        message: "Evaluation results for this project are currently in draft and have not been published.",
      });
    }

    // Student can only view their own student evaluation
    const myStudentEval = evaluation.studentEvaluations.find((se) => se.studentId === studentId);
    return res.json({
      project: { id: project.id, title: project.title, subject: project.subject },
      criteria,
      maxTotal,
      teamMax,
      individualMax,
      isPublished: true,
      evaluation: {
        id: evaluation.id,
        projectId: evaluation.projectId,
        totalMarks: evaluation.totalMarks,
        grade: evaluation.grade,
        isPublished: true,
        publishedAt: evaluation.publishedAt,
        facultyRemarks: evaluation.facultyRemarks,
        mentorRemarks: evaluation.mentorRemarks,
        marks: evaluation.marks, // common team marks
        studentEvaluations: myStudentEval ? [myStudentEval] : [],
      },
    });
  }

  res.json({
    project: {
      id: project.id,
      title: project.title,
      subject: project.subject,
      members: project.members,
      faculty: project.faculty,
      mentor: project.mentor,
    },
    criteria,
    teamCriteria,
    individualCriteria,
    maxTotal,
    teamMax,
    individualMax,
    evaluation,
  });
});

/**
 * Record or publish project and individual student marks.
 * Supports team marks, individual viva & contribution marks, and individual rubric criteria.
 */
const submitEvaluation = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const {
    marks, // backwards-compatible array of { criteriaId, marksAwarded }
    teamMarks, // { criteriaId, marksAwarded }
    studentEvaluations, // [{ studentId, vivaMarks, contributionMarks, marks: [{ criteriaId, marksAwarded }], feedback }]
    facultyRemarks,
    mentorRemarks,
    complete,
    publish,
  } = req.body;

  const shouldPublish = Boolean(publish || complete);

  const scope = await scopeProjectWhere(req.user);
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    include: {
      subject: true,
      members: { include: { student: true } },
    },
  });
  if (!project) throw ApiError.notFound("Project not found or not accessible.");

  const criteria = await prisma.evaluationCriteria.findMany({
    where: { subjectId: project.subjectId, isActive: true },
  });
  const criteriaById = new Map(criteria.map((c) => [c.id, c]));

  // Combine team marks from either new `teamMarks` or legacy `marks`
  const incomingTeamMarks = teamMarks || marks || [];
  const fieldErrors = {};

  // Validate team marks against criteria max
  for (const m of incomingTeamMarks) {
    const criterion = criteriaById.get(m.criteriaId);
    if (!criterion) {
      fieldErrors[m.criteriaId] = "Unknown criterion for this subject.";
      continue;
    }
    const awarded = Number(m.marksAwarded);
    if (awarded < 0 || awarded > criterion.maxMarks) {
      fieldErrors[m.criteriaId] = `${criterion.name} must be between 0 and ${criterion.maxMarks} marks.`;
    }
  }

  // Validate student-specific marks if provided
  const incomingStudentEvals = Array.isArray(studentEvaluations) ? studentEvaluations : [];
  for (const se of incomingStudentEvals) {
    if (Array.isArray(se.marks)) {
      for (const sm of se.marks) {
        const crit = criteriaById.get(sm.criteriaId);
        if (crit) {
          const awarded = Number(sm.marksAwarded);
          if (awarded < 0 || awarded > crit.maxMarks) {
            fieldErrors[`${se.studentId}_${sm.criteriaId}`] = `${crit.name} must be between 0 and ${crit.maxMarks} marks.`;
          }
        }
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw ApiError.badRequest("Some marks are outside the allowed range.", fieldErrors);
  }

  const teamTotalMarks = incomingTeamMarks.reduce((sum, m) => sum + Number(m.marksAwarded || 0), 0);
  const maxTotal = criteria.reduce((sum, c) => sum + c.maxMarks, 0);
  const faculty = await facultyOf(req.user);

  const result = await prisma.$transaction(async (tx) => {
    // 1. Upsert project-level evaluation
    const evalRecord = await tx.evaluation.upsert({
      where: { projectId },
      create: {
        projectId,
        facultyId: faculty?.id ?? project.facultyId,
        totalMarks: teamTotalMarks,
        grade: gradeFor(maxTotal > 0 ? (teamTotalMarks / maxTotal) * 100 : 0),
        facultyRemarks: facultyRemarks || null,
        mentorRemarks: mentorRemarks || null,
        isPublished: shouldPublish,
        publishedAt: shouldPublish ? new Date() : null,
        publishedById: shouldPublish ? req.user.id : null,
        completedAt: shouldPublish ? new Date() : null,
      },
      update: {
        totalMarks: teamTotalMarks,
        grade: gradeFor(maxTotal > 0 ? (teamTotalMarks / maxTotal) * 100 : 0),
        ...(facultyRemarks !== undefined && { facultyRemarks }),
        ...(mentorRemarks !== undefined && { mentorRemarks }),
        ...(shouldPublish && {
          isPublished: true,
          publishedAt: new Date(),
          publishedById: req.user.id,
          completedAt: new Date(),
        }),
      },
    });

    // 2. Replace team marks
    await tx.evaluationMark.deleteMany({ where: { evaluationId: evalRecord.id } });
    if (incomingTeamMarks.length > 0) {
      await tx.evaluationMark.createMany({
        data: incomingTeamMarks.map((m) => ({
          evaluationId: evalRecord.id,
          criteriaId: m.criteriaId,
          marksAwarded: Number(m.marksAwarded || 0),
        })),
      });
    }

    // 3. Process each team member's individual evaluation
    for (const member of project.members) {
      const studentData = incomingStudentEvals.find((se) => se.studentId === member.studentId);
      const viva = Number(studentData?.vivaMarks || 0);
      const contrib = Number(studentData?.contributionMarks || 0);
      const indMarksList = studentData?.marks || [];

      const indCriteriaTotal = indMarksList.reduce((s, m) => s + Number(m.marksAwarded || 0), 0);
      // Student Total combines team score + individual viva/contrib/criteria
      const studentTotal = Math.min(maxTotal, teamTotalMarks + viva + contrib + indCriteriaTotal);
      const studentPct = maxTotal > 0 ? (studentTotal / maxTotal) * 100 : 0;
      const studentGrade = gradeFor(studentPct);

      const seRecord = await tx.studentEvaluation.upsert({
        where: {
          evaluationId_studentId: {
            evaluationId: evalRecord.id,
            studentId: member.studentId,
          },
        },
        create: {
          evaluationId: evalRecord.id,
          studentId: member.studentId,
          vivaMarks: viva,
          contributionMarks: contrib,
          totalMarks: studentTotal,
          percentage: Math.round(studentPct * 10) / 10,
          grade: studentGrade,
          feedback: studentData?.feedback || null,
          isPublished: shouldPublish,
          publishedAt: shouldPublish ? new Date() : null,
        },
        update: {
          vivaMarks: viva,
          contributionMarks: contrib,
          totalMarks: studentTotal,
          percentage: Math.round(studentPct * 10) / 10,
          grade: studentGrade,
          feedback: studentData?.feedback || null,
          ...(shouldPublish && { isPublished: true, publishedAt: new Date() }),
        },
      });

      // Individual rubric marks
      await tx.studentEvaluationMark.deleteMany({ where: { studentEvaluationId: seRecord.id } });
      if (indMarksList.length > 0) {
        await tx.studentEvaluationMark.createMany({
          data: indMarksList.map((m) => ({
            studentEvaluationId: seRecord.id,
            criteriaId: m.criteriaId,
            marksAwarded: Number(m.marksAwarded || 0),
          })),
        });
      }
    }

    // 4. If published, mark project COMPLETED
    if (shouldPublish) {
      await tx.project.update({
        where: { id: projectId },
        data: { status: "COMPLETED", progress: 100 },
      });
    }

    return tx.evaluation.findUnique({
      where: { id: evalRecord.id },
      include: evaluationInclude,
    });
  });

  // 5. If published, dispatch multi-channel notification to each student
  if (shouldPublish) {
    for (const member of project.members) {
      const se = result.studentEvaluations.find((s) => s.studentId === member.studentId);
      const student = member.student;

      const messageText = `Your final project evaluation for "${project.title}" has been published. Score: ${se?.totalMarks || 0}/${maxTotal} (${se?.grade || "Pass"}).`;

      await dispatchMultiChannel({
        dedupKey: `evaluation-published-${result.id}-${student.id}`,
        channels: ["IN_APP", "EMAIL", "WHATSAPP"],
        recipient: {
          id: student.id,
          studentId: student.id,
          name: student.name,
          email: student.email,
          mobile: student.mobile,
          isStudent: true,
        },
        title: "Project Results Published",
        body: messageText,
        link: `/student/projects/${projectId}`,
        metadata: {
          notificationType: "MARKS_PUBLISHED",
          projectId,
          totalMarks: se?.totalMarks,
          maxTotal,
          grade: se?.grade,
        },
      });
    }

    await logActivity({
      userId: req.user.id,
      projectId,
      action: "MARKS_PUBLISHED",
      entityType: "Evaluation",
      entityId: result.id,
      metadata: { totalMarks: teamTotalMarks, maxTotal, publishedAt: new Date() },
    });
  } else {
    await logActivity({
      userId: req.user.id,
      projectId,
      action: "EVALUATION_DRAFT_SAVED",
      entityType: "Evaluation",
      entityId: result.id,
    });
  }

  res.json({
    ...result,
    maxTotal,
    isPublished: result.isPublished,
  });
});

/**
 * Preview & Download Individual Student Evaluation PDF Report.
 */
const getStudentEvaluationPdf = asyncHandler(async (req, res) => {
  const { projectId, studentId } = req.params;

  // Authorization: Student can only view their own PDF report, and only after publication
  if (req.user.role === "STUDENT" && req.user.id !== studentId) {
    throw ApiError.forbidden("You are only authorized to access your own evaluation report.");
  }

  const scope = await scopeProjectWhere(req.user);
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    include: {
      subject: true,
      faculty: { include: { user: true } },
      mentor: { include: { user: true } },
    },
  });
  if (!project) throw ApiError.notFound("Project not accessible.");

  const [student, evaluation, criteria] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId } }),
    prisma.evaluation.findUnique({
      where: { projectId },
      include: {
        marks: { include: { criteria: true } },
        studentEvaluations: {
          where: { studentId },
          include: { marks: { include: { criteria: true } } },
        },
      },
    }),
    prisma.evaluationCriteria.findMany({
      where: { subjectId: project.subjectId, isActive: true },
    }),
  ]);

  if (!student) throw ApiError.notFound("Student not found.");
  if (!evaluation) throw ApiError.notFound("Evaluation not found for this project.");

  if (req.user.role === "STUDENT" && !evaluation.isPublished) {
    throw ApiError.forbidden("Evaluation results have not been published yet.");
  }

  const studentEval = evaluation.studentEvaluations[0];
  const maxTotal = criteria.reduce((s, c) => s + c.maxMarks, 0);

  // Merge marks into criteria list
  const criteriaList = criteria.map((c) => {
    let awarded = 0;
    if (c.scope === "TEAM") {
      const m = evaluation.marks.find((em) => em.criteriaId === c.id);
      awarded = m ? m.marksAwarded : 0;
    } else {
      const sm = studentEval?.marks?.find((em) => em.criteriaId === c.id);
      awarded = sm ? sm.marksAwarded : 0;
    }
    return { ...c, marksAwarded: awarded };
  });

  const pdfBuffer = await generateStudentEvaluationPdf({
    student,
    project,
    evaluation,
    studentEval,
    criteria: criteriaList,
    maxTotal,
    isPublished: evaluation.isPublished,
    facultyRemarks: evaluation.facultyRemarks,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="evaluation-${student.enrollmentNumber || student.id}.pdf"`
  );
  res.send(pdfBuffer);
});

/**
 * Preview & Download Team/Project Evaluation PDF Report.
 */
const getProjectEvaluationPdf = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const scope = await scopeProjectWhere(req.user);
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    include: {
      subject: true,
      faculty: { include: { user: true } },
      mentor: { include: { user: true } },
      members: { include: { student: true } },
    },
  });
  if (!project) throw ApiError.notFound("Project not accessible.");

  const [evaluation, criteria] = await Promise.all([
    prisma.evaluation.findUnique({
      where: { projectId },
      include: {
        marks: { include: { criteria: true } },
        studentEvaluations: { include: { student: true } },
      },
    }),
    prisma.evaluationCriteria.findMany({
      where: { subjectId: project.subjectId, isActive: true },
    }),
  ]);

  if (!evaluation) throw ApiError.notFound("Evaluation not yet created for this project.");
  if (req.user.role === "STUDENT" && !evaluation.isPublished) {
    throw ApiError.forbidden("Results have not been published yet.");
  }

  const maxTotal = criteria.reduce((s, c) => s + c.maxMarks, 0);

  const criteriaList = criteria.map((c) => {
    const m = evaluation.marks.find((em) => em.criteriaId === c.id);
    return { ...c, marksAwarded: m ? m.marksAwarded : 0 };
  });

  const membersSummary = project.members.map((m) => {
    const se = evaluation.studentEvaluations.find((s) => s.studentId === m.studentId);
    return {
      name: m.student.name,
      enrollmentNumber: m.student.enrollmentNumber,
      vivaMarks: se?.vivaMarks || 0,
      contributionMarks: se?.contributionMarks || 0,
      totalMarks: se?.totalMarks || 0,
      percentage: se?.percentage || 0,
      grade: se?.grade || "—",
    };
  });

  const pdfBuffer = await generateProjectEvaluationPdf({
    project,
    evaluation,
    criteria: criteriaList,
    members: membersSummary,
    maxTotal,
    isPublished: evaluation.isPublished,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="project-evaluation-${project.id}.pdf"`);
  res.send(pdfBuffer);
});

/**
 * Share student evaluation result via Email & provide fallback manual WhatsApp link.
 */
const shareStudentResult = asyncHandler(async (req, res) => {
  const { projectId, studentId } = req.params;
  const { channel } = req.body; // 'email' | 'whatsapp'

  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) throw ApiError.notFound("Student not found.");

  const evaluation = await prisma.evaluation.findUnique({
    where: { projectId },
    include: {
      project: true,
      studentEvaluations: { where: { studentId } },
    },
  });
  if (!evaluation || !evaluation.isPublished) {
    throw ApiError.badRequest("Cannot share unpublished evaluation results.");
  }

  const se = evaluation.studentEvaluations[0];
  const shareMessage = `Dear ${student.name}, your official result for "${evaluation.project.title}" is published: Total: ${se?.totalMarks || 0} marks (${se?.percentage || 0}%, Grade: ${se?.grade || "—"}). Reviewer feedback: ${se?.feedback || "Completed successfully."}`;

  if (channel === "email" || !channel) {
    await dispatchMultiChannel({
      dedupKey: `manual-share-email-${projectId}-${studentId}-${Date.now()}`,
      channels: ["EMAIL", "IN_APP"],
      recipient: {
        id: student.id,
        studentId: student.id,
        name: student.name,
        email: student.email,
        mobile: student.mobile,
        isStudent: true,
      },
      title: "Your Project Evaluation Result",
      body: shareMessage,
      link: `/student/projects/${projectId}`,
    });
  }

  // Generate fallback WhatsApp link
  const whatsAppUrl = getManualWhatsAppShareUrl({
    phone: student.mobile,
    message: shareMessage,
  });

  await logActivity({
    userId: req.user.id,
    projectId,
    action: "EVALUATION_SHARED",
    entityType: "Evaluation",
    entityId: evaluation.id,
    metadata: { studentId, channel: channel || "email" },
  });

  res.json({
    message: "Evaluation shared successfully.",
    whatsAppUrl,
  });
});

// ── Criteria configuration (Admin) ──────────────────────────────

const getCriteria = asyncHandler(async (req, res) => {
  const criteria = await prisma.evaluationCriteria.findMany({
    where: { subjectId: req.params.subjectId },
    orderBy: [{ scope: "asc" }, { name: "asc" }],
  });
  res.json({
    criteria,
    totalMarks: criteria.filter((c) => c.isActive).reduce((s, c) => s + c.maxMarks, 0),
  });
});

const upsertCriteria = asyncHandler(async (req, res) => {
  const { subjectId } = req.params;
  const { criteria } = req.body;

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw ApiError.notFound("Subject not found.");

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.evaluationCriteria.findMany({
      where: { subjectId },
      include: { _count: { select: { marks: true } } },
    });

    const incomingNames = new Set(criteria.map((c) => c.name.trim()));

    for (const old of existing) {
      if (incomingNames.has(old.name)) continue;
      if (old._count.marks > 0) {
        await tx.evaluationCriteria.update({ where: { id: old.id }, data: { isActive: false } });
      } else {
        await tx.evaluationCriteria.delete({ where: { id: old.id } });
      }
    }

    for (const c of criteria) {
      await tx.evaluationCriteria.upsert({
        where: { subjectId_name: { subjectId, name: c.name.trim() } },
        create: {
          subjectId,
          name: c.name.trim(),
          description: c.description || null,
          maxMarks: Number(c.maxMarks),
          scope: c.scope === "INDIVIDUAL" ? "INDIVIDUAL" : "TEAM",
          isActive: true,
        },
        update: {
          description: c.description || null,
          maxMarks: Number(c.maxMarks),
          scope: c.scope === "INDIVIDUAL" ? "INDIVIDUAL" : "TEAM",
          isActive: true,
        },
      });
    }

    return tx.evaluationCriteria.findMany({
      where: { subjectId },
      orderBy: [{ scope: "asc" }, { name: "asc" }],
    });
  });

  await logActivity({
    userId: req.user.id,
    action: "EVALUATION_CRITERIA_UPDATED",
    entityType: "Subject",
    entityId: subjectId,
  });

  res.json({
    criteria: result,
    totalMarks: result.filter((c) => c.isActive).reduce((s, c) => s + c.maxMarks, 0),
  });
});

module.exports = {
  getEvaluations,
  getProjectEvaluation,
  submitEvaluation,
  getCriteria,
  upsertCriteria,
  getStudentEvaluationPdf,
  getProjectEvaluationPdf,
  shareStudentResult,
  gradeFor,
};
