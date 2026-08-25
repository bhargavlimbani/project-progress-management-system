const prisma = require("../config/prisma");

async function getSubjects(req, res, next) {
  try {
    const { semesterId, academicYearId, isActive } = req.query;
    const where = {};
    if (semesterId) where.semesterId = semesterId;
    if (academicYearId) where.academicYearId = academicYearId;
    if (isActive !== undefined) where.isActive = isActive === "true";

    const subjects = await prisma.subject.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        semester: true,
        academicYear: true,
        faculty: { include: { faculty: { include: { user: true } } } },
        _count: { select: { projects: true } },
      },
    });
    res.json(subjects);
  } catch (err) { next(err); }
}

async function getSubjectById(req, res, next) {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: req.params.id },
      include: {
        semester: true,
        academicYear: true,
        faculty: { include: { faculty: { include: { user: true } } } },
        evaluationCriteria: true,
        milestoneTemplates: { orderBy: { weekNumber: "asc" } },
        _count: { select: { projects: true } },
      },
    });
    if (!subject) return res.status(404).json({ message: "Subject not found." });
    res.json(subject);
  } catch (err) { next(err); }
}

async function createSubject(req, res, next) {
  try {
    const { name, code, semesterId, academicYearId, description, durationWeeks, facultyIds } = req.body;
    if (!name || !code || !semesterId || !academicYearId) {
      return res.status(400).json({ message: "Name, code, semesterId, academicYearId are required." });
    }

    const subject = await prisma.$transaction(async (tx) => {
      const s = await tx.subject.create({
        data: {
          name, code, semesterId, academicYearId, description,
          durationWeeks: durationWeeks ? parseInt(durationWeeks) : 12,
        },
      });
      if (facultyIds?.length) {
        await tx.facultySubject.createMany({
          data: facultyIds.map((fid) => ({ facultyId: fid, subjectId: s.id })),
          skipDuplicates: true,
        });
      }
      return s;
    });
    res.status(201).json(subject);
  } catch (err) { next(err); }
}

async function updateSubject(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, durationWeeks, isActive, facultyIds } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.subject.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(durationWeeks && { durationWeeks: parseInt(durationWeeks) }),
          ...(isActive !== undefined && { isActive }),
        },
      });
      if (facultyIds !== undefined) {
        await tx.facultySubject.deleteMany({ where: { subjectId: id } });
        if (facultyIds.length) {
          await tx.facultySubject.createMany({
            data: facultyIds.map((fid) => ({ facultyId: fid, subjectId: id })),
            skipDuplicates: true,
          });
        }
      }
    });

    const updated = await prisma.subject.findUnique({
      where: { id },
      include: { semester: true, academicYear: true, faculty: { include: { faculty: { include: { user: true } } } } },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

async function deleteSubject(req, res, next) {
  try {
    await prisma.subject.delete({ where: { id: req.params.id } });
    res.json({ message: "Subject deleted." });
  } catch (err) { next(err); }
}

// Evaluation criteria management
async function getEvaluationCriteria(req, res, next) {
  try {
    const { subjectId } = req.params;
    const criteria = await prisma.evaluationCriteria.findMany({
      where: { subjectId },
      orderBy: { name: "asc" },
    });
    res.json(criteria);
  } catch (err) { next(err); }
}

async function upsertEvaluationCriteria(req, res, next) {
  try {
    const { subjectId } = req.params;
    const { criteria } = req.body; // array of { name, description, maxMarks }
    if (!Array.isArray(criteria)) return res.status(400).json({ message: "Criteria must be an array." });

    await prisma.$transaction(async (tx) => {
      await tx.evaluationCriteria.deleteMany({ where: { subjectId } });
      await tx.evaluationCriteria.createMany({
        data: criteria.map((c) => ({ subjectId, name: c.name, description: c.description, maxMarks: parseFloat(c.maxMarks) || 0 })),
      });
    });
    const result = await prisma.evaluationCriteria.findMany({ where: { subjectId } });
    res.json(result);
  } catch (err) { next(err); }
}

// Milestone templates
async function getMilestoneTemplates(req, res, next) {
  try {
    const { subjectId } = req.params;
    const templates = await prisma.milestoneTemplate.findMany({
      where: { subjectId },
      orderBy: { weekNumber: "asc" },
    });
    res.json(templates);
  } catch (err) { next(err); }
}

async function upsertMilestoneTemplates(req, res, next) {
  try {
    const { subjectId } = req.params;
    const { templates } = req.body;
    if (!Array.isArray(templates)) return res.status(400).json({ message: "Templates must be an array." });

    await prisma.$transaction(async (tx) => {
      await tx.milestoneTemplate.deleteMany({ where: { subjectId } });
      await tx.milestoneTemplate.createMany({
        data: templates.map((t) => ({
          subjectId,
          weekNumber: parseInt(t.weekNumber),
          title: t.title,
          description: t.description,
          weight: parseFloat(t.weight) || 0,
          isRequired: t.isRequired !== false,
        })),
      });
    });
    const result = await prisma.milestoneTemplate.findMany({ where: { subjectId }, orderBy: { weekNumber: "asc" } });
    res.json(result);
  } catch (err) { next(err); }
}

module.exports = {
  getSubjects, getSubjectById, createSubject, updateSubject, deleteSubject,
  getEvaluationCriteria, upsertEvaluationCriteria,
  getMilestoneTemplates, upsertMilestoneTemplates,
};
