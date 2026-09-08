const prisma = require("../config/prisma");
const { scopeProjectWhere } = require("./access.service");
const { VISIBLE_USER } = require("../utils/visibility");
const { SAFE_USER_SELECT, STUDENT_SUMMARY_SELECT } = require("../utils/safeFields");

/**
 * Who a given caller is allowed to start a direct conversation with.
 *
 * The rule follows the same principle as everything else: an admin can reach
 * anyone, while everyone else can only reach people they already share a
 * project with (spec §48 pairs Student↔Mentor and Student↔Faculty). Hidden
 * owner accounts never appear.
 *
 * Returns { staff: [...], students: [...] } with a `kind` on each entry so the
 * client can address the right table without guessing.
 */
async function listContactsFor(user) {
  const isAdmin = user.role === "ADMIN";

  // ── Admin: the whole directory ─────────────────────────────────────────
  if (isAdmin) {
    const [staff, students] = await Promise.all([
      prisma.user.findMany({
        where: { ...VISIBLE_USER, isActive: true, id: { not: user.id } },
        select: {
          ...SAFE_USER_SELECT,
          faculty: { select: { facultyId: true, designation: true } },
          mentor: { select: { mentorId: true, expertise: true } },
        },
        orderBy: [{ role: "asc" }, { name: "asc" }],
      }),
      prisma.student.findMany({
        where: { isActive: true },
        select: { ...STUDENT_SUMMARY_SELECT, semester: { select: { number: true } } },
        orderBy: { name: "asc" },
      }),
    ]);
    return { staff: staff.map(shapeStaff), students: students.map(shapeStudent) };
  }

  // ── Everyone else: people on the projects they can already see ─────────
  const scope = await scopeProjectWhere(user);
  const projects = await prisma.project.findMany({
    where: scope,
    select: {
      faculty: { select: { userId: true } },
      mentor: { select: { userId: true } },
      members: { select: { studentId: true } },
    },
  });

  const staffIds = new Set();
  const studentIds = new Set();
  for (const p of projects) {
    if (p.faculty?.userId) staffIds.add(p.faculty.userId);
    if (p.mentor?.userId) staffIds.add(p.mentor.userId);
    for (const m of p.members) studentIds.add(m.studentId);
  }

  // Never list yourself.
  staffIds.delete(user.id);
  if (user.role === "STUDENT") studentIds.delete(user.id);

  // Admins are always reachable so anyone can raise an issue.
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN", ...VISIBLE_USER, isActive: true },
    select: { id: true },
  });
  for (const a of admins) staffIds.add(a.id);

  const [staff, students] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: [...staffIds] }, ...VISIBLE_USER, isActive: true },
      select: {
        ...SAFE_USER_SELECT,
        faculty: { select: { facultyId: true, designation: true } },
        mentor: { select: { mentorId: true, expertise: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.student.findMany({
      where: { id: { in: [...studentIds] }, isActive: true },
      select: { ...STUDENT_SUMMARY_SELECT, semester: { select: { number: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return { staff: staff.map(shapeStaff), students: students.map(shapeStudent) };
}

/** True when `user` may open a direct thread with the given counterpart. */
async function canMessage(user, { kind, id }) {
  if (kind === "STUDENT" && user.role === "STUDENT" && id === user.id) return false;
  if (kind === "USER" && user.role !== "STUDENT" && id === user.id) return false;

  const { staff, students } = await listContactsFor(user);
  const pool = kind === "STUDENT" ? students : staff;
  return pool.some((c) => c.id === id);
}

function shapeStaff(u) {
  return {
    kind: "USER",
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    profilePhoto: u.profilePhoto,
    subtitle:
      u.faculty?.designation ||
      u.mentor?.expertise ||
      (u.role === "ADMIN" ? "Administrator" : ""),
    code: u.faculty?.facultyId || u.mentor?.mentorId || null,
  };
}

function shapeStudent(s) {
  return {
    kind: "STUDENT",
    id: s.id,
    name: s.name,
    email: s.email,
    role: "STUDENT",
    profilePhoto: s.profilePhoto,
    subtitle: s.semester ? `Semester ${s.semester.number}` : "Student",
    code: s.enrollmentNumber,
  };
}

module.exports = { listContactsFor, canMessage };
