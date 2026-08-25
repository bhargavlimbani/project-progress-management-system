const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { logActivity } = require("../services/activityLog.service");

// ── Academic Years ─────────────────────────────────────────────────────────

async function getAcademicYears(req, res, next) {
  try {
    const years = await prisma.academicYear.findMany({
      orderBy: { label: "desc" },
      include: { _count: { select: { semesters: true, students: true, projects: true } } },
    });
    res.json(years);
  } catch (err) { next(err); }
}

async function createAcademicYear(req, res, next) {
  try {
    const { label, startDate, endDate } = req.body;
    if (!label) return res.status(400).json({ message: "Label is required." });
    const year = await prisma.academicYear.create({
      data: { label, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null },
    });
    await logActivity({ userId: req.user.id, action: "CREATE_ACADEMIC_YEAR", entityType: "AcademicYear", entityId: year.id });
    res.status(201).json(year);
  } catch (err) { next(err); }
}

async function updateAcademicYear(req, res, next) {
  try {
    const { id } = req.params;
    const { label, startDate, endDate } = req.body;
    const year = await prisma.academicYear.update({
      where: { id },
      data: { label, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined },
    });
    res.json(year);
  } catch (err) { next(err); }
}

async function activateAcademicYear(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.$transaction([
      prisma.academicYear.updateMany({ where: {}, data: { isActive: false } }),
      prisma.academicYear.update({ where: { id }, data: { isActive: true } }),
    ]);
    res.json({ message: "Academic year activated." });
  } catch (err) { next(err); }
}

async function deleteAcademicYear(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.academicYear.delete({ where: { id } });
    res.json({ message: "Academic year deleted." });
  } catch (err) { next(err); }
}

// ── Semesters ──────────────────────────────────────────────────────────────

async function getSemesters(req, res, next) {
  try {
    const { academicYearId } = req.query;
    const where = academicYearId ? { academicYearId } : {};
    const semesters = await prisma.semester.findMany({
      where,
      orderBy: { number: "asc" },
      include: {
        academicYear: true,
        _count: { select: { students: true, subjects: true } },
      },
    });
    res.json(semesters);
  } catch (err) { next(err); }
}

async function createSemester(req, res, next) {
  try {
    const { number, academicYearId } = req.body;
    if (!number || !academicYearId) return res.status(400).json({ message: "Number and academicYearId required." });
    const sem = await prisma.semester.create({ data: { number: parseInt(number), academicYearId } });
    res.status(201).json(sem);
  } catch (err) { next(err); }
}

async function deleteSemester(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.semester.delete({ where: { id } });
    res.json({ message: "Semester deleted." });
  } catch (err) { next(err); }
}

module.exports = {
  getAcademicYears, createAcademicYear, updateAcademicYear, activateAcademicYear, deleteAcademicYear,
  getSemesters, createSemester, deleteSemester,
};
