const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { logActivity } = require("../services/activityLog.service");

const getAttendance = asyncHandler(async (req, res) => {
  const { subjectId, studentId, date } = req.query;

  const where = {};
  if (subjectId) where.subjectId = subjectId;
  if (studentId) where.studentId = studentId;
  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const nextD = new Date(d);
    nextD.setDate(d.getDate() + 1);
    where.date = { gte: d, lt: nextD };
  }

  // If student caller, restrict to their own records
  if (req.user.role === "STUDENT") {
    where.studentId = req.user.id;
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: {
      student: { select: { id: true, name: true, enrollmentNumber: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: { date: "desc" },
  });

  res.json(records);
});

const recordAttendance = asyncHandler(async (req, res) => {
  const { subjectId, date, records } = req.body;
  // records: [{ studentId, isPresent, remarks }]

  if (!subjectId || !date || !Array.isArray(records)) {
    throw ApiError.badRequest("subjectId, date, and records array are required.");
  }

  const attendanceDate = new Date(date);
  attendanceDate.setHours(0, 0, 0, 0);

  const saved = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const r of records) {
      const rec = await tx.attendanceRecord.upsert({
        where: {
          studentId_subjectId_date: {
            studentId: r.studentId,
            subjectId,
            date: attendanceDate,
          },
        },
        create: {
          studentId: r.studentId,
          subjectId,
          date: attendanceDate,
          isPresent: r.isPresent !== false,
          remarks: r.remarks || null,
        },
        update: {
          isPresent: r.isPresent !== false,
          remarks: r.remarks || null,
        },
      });
      results.push(rec);
    }
    return results;
  });

  await logActivity({
    userId: req.user.id,
    action: "ATTENDANCE_RECORDED",
    entityType: "AttendanceRecord",
    metadata: { subjectId, date: attendanceDate, count: records.length },
  });

  res.status(201).json({ message: "Attendance recorded successfully.", count: saved.length });
});

const getAttendanceSummary = asyncHandler(async (req, res) => {
  const { subjectId } = req.params;

  const records = await prisma.attendanceRecord.findMany({
    where: { subjectId },
    include: {
      student: { select: { id: true, name: true, enrollmentNumber: true } },
    },
  });

  const byStudent = new Map();
  for (const r of records) {
    if (!byStudent.has(r.studentId)) {
      byStudent.set(r.studentId, {
        student: r.student,
        totalSessions: 0,
        presentSessions: 0,
      });
    }
    const stat = byStudent.get(r.studentId);
    stat.totalSessions++;
    if (r.isPresent) stat.presentSessions++;
  }

  const summary = Array.from(byStudent.values()).map((s) => ({
    ...s,
    percentage: s.totalSessions > 0 ? Math.round((s.presentSessions / s.totalSessions) * 1000) / 10 : 100,
  }));

  res.json(summary);
});

const getSubjectStudents = asyncHandler(async (req, res) => {
  const { subjectId } = req.params;
  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) throw ApiError.notFound("Subject not found.");

  const students = await prisma.student.findMany({
    where: {
      semesterId: subject.semesterId,
      academicYearId: subject.academicYearId,
      isActive: true,
    },
    select: { id: true, name: true, enrollmentNumber: true, email: true },
    orderBy: { enrollmentNumber: "asc" },
  });

  res.json(students);
});

module.exports = {
  getAttendance,
  recordAttendance,
  getAttendanceSummary,
  getSubjectStudents,
};
