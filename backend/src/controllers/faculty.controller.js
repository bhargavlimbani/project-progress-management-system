const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { logActivity } = require("../services/activityLog.service");
const { SAFE_USER_SELECT, STUDENT_SUMMARY_SELECT } = require("../utils/safeFields");

async function getFaculty(req, res, next) {
  try {
    const faculty = await prisma.faculty.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true, profilePhoto: true, createdAt: true } },
        subjects: { include: { subject: true } },
        _count: { select: { projects: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    res.json(faculty);
  } catch (err) { next(err); }
}

async function getFacultyById(req, res, next) {
  try {
    const faculty = await prisma.faculty.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: SAFE_USER_SELECT },
        subjects: { include: { subject: { include: { semester: true, academicYear: true } } } },
        projects: {
          include: {
            subject: true,
            members: { include: { student: { select: STUDENT_SUMMARY_SELECT } } },
          },
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!faculty) return res.status(404).json({ message: "Faculty not found." });
    res.json(faculty);
  } catch (err) { next(err); }
}

async function createFaculty(req, res, next) {
  try {
    const { name, email, facultyId, designation, mobile, password, subjectIds } = req.body;
    if (!name || !email || !facultyId || !designation || !password) {
      return res.status(400).json({ message: "Name, email, facultyId, designation, and password are required." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already in use." });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, role: "FACULTY" },
      });
      const faculty = await tx.faculty.create({
        data: { userId: user.id, facultyId, designation, mobile },
      });
      if (subjectIds?.length) {
        await tx.facultySubject.createMany({
          data: subjectIds.map((sid) => ({ facultyId: faculty.id, subjectId: sid })),
          skipDuplicates: true,
        });
      }
      return faculty;
    });

    await logActivity({ userId: req.user.id, action: "CREATE_FACULTY", entityType: "Faculty", entityId: result.id });
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function updateFaculty(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, designation, mobile, isActive, subjectIds } = req.body;

    const faculty = await prisma.faculty.findUnique({ where: { id }, include: { user: true } });
    if (!faculty) return res.status(404).json({ message: "Faculty not found." });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: faculty.userId },
        data: { ...(name && { name }), ...(email && { email }), ...(isActive !== undefined && { isActive }) },
      });
      await tx.faculty.update({
        where: { id },
        data: { ...(designation && { designation }), ...(mobile !== undefined && { mobile }) },
      });
      if (subjectIds !== undefined) {
        await tx.facultySubject.deleteMany({ where: { facultyId: id } });
        if (subjectIds.length) {
          await tx.facultySubject.createMany({
            data: subjectIds.map((sid) => ({ facultyId: id, subjectId: sid })),
            skipDuplicates: true,
          });
        }
      }
    });

    const updated = await prisma.faculty.findUnique({
      where: { id },
      include: { user: true, subjects: { include: { subject: true } } },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

async function deleteFaculty(req, res, next) {
  try {
    const { id } = req.params;
    const faculty = await prisma.faculty.findUnique({ where: { id } });
    if (!faculty) return res.status(404).json({ message: "Faculty not found." });
    await prisma.user.delete({ where: { id: faculty.userId } });
    res.json({ message: "Faculty deleted." });
  } catch (err) { next(err); }
}

async function resetFacultyPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    const faculty = await prisma.faculty.findUnique({ where: { id } });
    if (!faculty) return res.status(404).json({ message: "Faculty not found." });
    const hash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: faculty.userId }, data: { passwordHash: hash } });
    res.json({ message: "Password reset successfully." });
  } catch (err) { next(err); }
}

module.exports = { getFaculty, getFacultyById, createFaculty, updateFaculty, deleteFaculty, resetFacultyPassword };
