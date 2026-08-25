const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const prisma = require("../config/prisma");
const { logActivity } = require("../services/activityLog.service");
const { toCsv, rowsToXlsx, CONTENT_TYPES } = require("../services/export.service");

async function getStudents(req, res, next) {
  try {
    const { academicYearId, semesterId, isActive, search, page = 1, limit = 20 } = req.query;
    const where = {};
    if (academicYearId) where.academicYearId = academicYearId;
    if (semesterId) where.semesterId = semesterId;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { enrollmentNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          academicYear: true,
          semester: true,
          projectMembers: { include: { project: { select: { title: true, status: true, progress: true } } } },
        },
        orderBy: { name: "asc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.student.count({ where }),
    ]);

    res.json({ students, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { next(err); }
}

async function getStudentById(req, res, next) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        academicYear: true,
        semester: true,
        projectMembers: {
          include: {
            project: {
              include: { subject: true, faculty: { include: { user: true } }, mentor: { include: { user: true } }, domain: true },
            },
          },
        },
      },
    });
    if (!student) return res.status(404).json({ message: "Student not found." });
    // Remove password hash from response
    const { passwordHash, activationToken, ...safe } = student;
    res.json(safe);
  } catch (err) { next(err); }
}

async function createStudent(req, res, next) {
  try {
    const { enrollmentNumber, name, email, mobile, rollNumber, academicYearId, semesterId, password } = req.body;
    if (!enrollmentNumber || !name || !email || !mobile || !academicYearId || !semesterId) {
      return res.status(400).json({ message: "enrollmentNumber, name, email, mobile, academicYearId, semesterId are required." });
    }

    const existing = await prisma.student.findFirst({
      where: { OR: [{ enrollmentNumber }, { email }] },
    });
    if (existing) return res.status(409).json({ message: "Enrollment number or email already exists." });

    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const activationToken = !password ? crypto.randomBytes(32).toString("hex") : null;

    const student = await prisma.student.create({
      data: {
        enrollmentNumber, name, email, mobile, rollNumber,
        academicYearId, semesterId, passwordHash,
        activationToken, isActivated: !!password,
      },
    });

    await logActivity({ userId: req.user.id, action: "CREATE_STUDENT", entityType: "Student", entityId: student.id });
    const { passwordHash: _, activationToken: __, ...safe } = student;
    res.status(201).json(safe);
  } catch (err) { next(err); }
}

async function updateStudent(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, mobile, rollNumber, isActive, academicYearId, semesterId } = req.body;
    const student = await prisma.student.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(mobile && { mobile }),
        ...(rollNumber !== undefined && { rollNumber }),
        ...(isActive !== undefined && { isActive }),
        ...(academicYearId && { academicYearId }),
        ...(semesterId && { semesterId }),
      },
    });
    const { passwordHash, activationToken, ...safe } = student;
    res.json(safe);
  } catch (err) { next(err); }
}

async function deleteStudent(req, res, next) {
  try {
    await prisma.student.delete({ where: { id: req.params.id } });
    res.json({ message: "Student deleted." });
  } catch (err) { next(err); }
}

async function resetStudentPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    const hash = await bcrypt.hash(password, 12);
    await prisma.student.update({ where: { id }, data: { passwordHash: hash, isActivated: true } });
    res.json({ message: "Password reset successfully." });
  } catch (err) { next(err); }
}

async function activateStudentAccount(req, res, next) {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

    const student = await prisma.student.findUnique({ where: { activationToken: token } });
    if (!student) return res.status(404).json({ message: "Invalid activation token." });

    const hash = await bcrypt.hash(password, 12);
    await prisma.student.update({
      where: { id: student.id },
      data: { passwordHash: hash, isActivated: true, activationToken: null },
    });
    res.json({ message: "Account activated successfully. You can now log in." });
  } catch (err) { next(err); }
}

/**
 * Export the filtered student roster as .xlsx or .csv (spec §79).
 * Uses the same filters as getStudents so what you see is what you export.
 */
async function exportStudents(req, res, next) {
  try {
    const { academicYearId, semesterId, isActive, search } = req.query;
    const format = String(req.query.format || "xlsx").toLowerCase();
    if (!["xlsx", "csv"].includes(format)) {
      return res.status(400).json({ message: "Format must be xlsx or csv." });
    }

    const where = {};
    if (academicYearId) where.academicYearId = academicYearId;
    if (semesterId) where.semesterId = semesterId;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { enrollmentNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        academicYear: true,
        semester: true,
        projectMembers: { include: { project: { select: { progress: true } } } },
      },
      orderBy: { enrollmentNumber: "asc" },
    });

    const rows = students.map((s) => {
      const projects = s.projectMembers.map((pm) => pm.project);
      const avg = projects.length
        ? projects.reduce((sum, p) => sum + p.progress, 0) / projects.length
        : 0;
      return {
        "Enrollment Number": s.enrollmentNumber,
        "Roll Number": s.rollNumber || "",
        "Student Name": s.name,
        Email: s.email,
        Mobile: s.mobile,
        Semester: s.semester?.number ?? "",
        "Academic Year": s.academicYear?.label ?? "",
        Projects: projects.length,
        "Overall Progress": `${Math.round(avg * 10) / 10}%`,
        Activated: s.isActivated ? "Yes" : "No",
        Status: s.isActive ? "Active" : "Inactive",
      };
    });

    const buffer =
      format === "csv"
        ? toCsv({
            columns: Object.keys(rows[0] || { "Enrollment Number": "" }).map((k) => ({
              key: k,
              label: k,
            })),
            rows,
          })
        : rowsToXlsx(rows, "Students");

    const filename = `SAPMS-students-${new Date().toISOString().slice(0, 10)}.${format}`;
    res.setHeader("Content-Type", CONTENT_TYPES[format]);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) { next(err); }
}

module.exports = { getStudents, getStudentById, createStudent, updateStudent, deleteStudent, resetStudentPassword, activateStudentAccount, exportStudents };
