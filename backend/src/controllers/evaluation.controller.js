const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { notifyProjectTeam } = require("../services/notification.service");
const { logActivity } = require("../services/activityLog.service");
const { scopeProjectWhere, facultyOf } = require("../services/access.service");

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
  faculty: { include: { user: { select: { name: true } } } },
  project: {
    include: {
      subject: { select: { id: true, name: true, code: true } },
      domain: { select: { name: true } },
      mentor: { include: { user: { select: { name: true } } } },
      members: { include: { student: { select: { id: true, name: true, enrollmentNumber: true } } } },
    },
  },
};

/** Evaluations across every project the caller can see. */
const getEvaluations = asyncHandler(async (req, res) => {
  const where = { project: await scopeProjectWhere(req.user) };
  if (req.query.subjectId) where.project = { ...where.project, subjectId: req.query.subjectId };

  const evaluations = await prisma.evaluation.findMany({
    where,
    include: evaluationInclude,
    orderBy: { updatedAt: "desc" },
  });

  res.json(evaluations);
});

/**
 * Evaluation sheet for one project: the subject's criteria plus whatever
 * marks have been awarded so far. Returns criteria even when no evaluation
 * exists yet, so the UI can render an empty mark sheet.
 */
const getProjectEvaluation = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const scope = await scopeProjectWhere(req.user);
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    include: { subject: true },
  });
  if (!project) throw ApiError.notFound("Project not found or not accessible.");

  const [criteria, evaluation] = await Promise.all([
    prisma.evaluationCriteria.findMany({
      where: { subjectId: project.subjectId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.evaluation.findUnique({
      where: { projectId },
      include: evaluationInclude,
    }),
  ]);

  const maxTotal = criteria.reduce((sum, c) => sum + c.maxMarks, 0);

  res.json({
    project: { id: project.id, title: project.title, subject: project.subject },
    criteria,
    maxTotal,
    evaluation,
  });
});

/**
 * Record or replace a project's marks. Runs in a transaction (spec §75) so a
 * partially-written mark sheet can never be observed, and re-validates every
 * awarded mark against its criterion's ceiling.
 */
const submitEvaluation = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { marks, facultyRemarks, mentorRemarks, complete } = req.body;

  const scope = await scopeProjectWhere(req.user);
  const project = await prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    include: { subject: true },
  });
  if (!project) throw ApiError.notFound("Project not found or not accessible.");

  const criteria = await prisma.evaluationCriteria.findMany({
    where: { subjectId: project.subjectId, isActive: true },
  });
  const criteriaById = new Map(criteria.map((c) => [c.id, c]));

  // Validate before opening the transaction so nothing partial is attempted.
  const fieldErrors = {};
  for (const m of marks) {
    const criterion = criteriaById.get(m.criteriaId);
    if (!criterion) {
      fieldErrors[m.criteriaId] = "Unknown criterion for this subject.";
      continue;
    }
    const awarded = Number(m.marksAwarded);
    if (awarded > criterion.maxMarks) {
      fieldErrors[m.criteriaId] = `${criterion.name} is out of ${criterion.maxMarks} marks.`;
    }
  }
  if (Object.keys(fieldErrors).length) {
    throw ApiError.badRequest("Some marks are outside the allowed range.", fieldErrors);
  }

  const totalMarks = marks.reduce((sum, m) => sum + Number(m.marksAwarded), 0);
  const maxTotal = criteria.reduce((sum, c) => sum + c.maxMarks, 0);
  const percentage = maxTotal > 0 ? (totalMarks / maxTotal) * 100 : 0;

  const faculty = await facultyOf(req.user);

  const evaluation = await prisma.$transaction(async (tx) => {
    const record = await tx.evaluation.upsert({
      where: { projectId },
      create: {
        projectId,
        facultyId: faculty?.id ?? project.facultyId,
        totalMarks,
        grade: gradeFor(percentage),
        facultyRemarks: facultyRemarks || null,
        mentorRemarks: mentorRemarks || null,
        completedAt: complete ? new Date() : null,
      },
      update: {
        totalMarks,
        grade: gradeFor(percentage),
        ...(facultyRemarks !== undefined && { facultyRemarks }),
        ...(mentorRemarks !== undefined && { mentorRemarks }),
        ...(complete && { completedAt: new Date() }),
      },
    });

    // Replace the whole mark sheet so removed criteria don't linger.
    await tx.evaluationMark.deleteMany({ where: { evaluationId: record.id } });
    await tx.evaluationMark.createMany({
      data: marks.map((m) => ({
        evaluationId: record.id,
        criteriaId: m.criteriaId,
        marksAwarded: Number(m.marksAwarded),
      })),
    });

    if (complete) {
      await tx.project.update({
        where: { id: projectId },
        data: { status: "COMPLETED", progress: 100 },
      });
    }

    return tx.evaluation.findUnique({ where: { id: record.id }, include: evaluationInclude });
  });

  if (complete) {
    await notifyProjectTeam({
      projectId,
      type: "MARKS_PUBLISHED",
      title: "Evaluation Completed",
      body: `Final marks for "${project.title}" have been published — ${totalMarks}/${maxTotal} (${evaluation.grade}).`,
      link: `/projects/${projectId}`,
    });
  }

  await logActivity({
    userId: req.user.id,
    projectId,
    action: "MARKS_UPDATED",
    entityType: "Evaluation",
    entityId: evaluation.id,
    metadata: { totalMarks, maxTotal, grade: evaluation.grade },
  });

  res.json({ ...evaluation, maxTotal, percentage: Math.round(percentage * 10) / 10 });
});

// ── Criteria configuration (Admin, spec §50) ──────────────────────────────

const getCriteria = asyncHandler(async (req, res) => {
  const criteria = await prisma.evaluationCriteria.findMany({
    where: { subjectId: req.params.subjectId },
    orderBy: { name: "asc" },
  });
  res.json({
    criteria,
    totalMarks: criteria.filter((c) => c.isActive).reduce((s, c) => s + c.maxMarks, 0),
  });
});

/**
 * Replace a subject's criteria set. Criteria already referenced by awarded
 * marks are deactivated rather than deleted, so historic mark sheets stay
 * readable instead of failing on a dangling foreign key.
 */
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
          isActive: true,
        },
        update: {
          description: c.description || null,
          maxMarks: Number(c.maxMarks),
          isActive: true,
        },
      });
    }

    return tx.evaluationCriteria.findMany({ where: { subjectId }, orderBy: { name: "asc" } });
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
  gradeFor,
};
