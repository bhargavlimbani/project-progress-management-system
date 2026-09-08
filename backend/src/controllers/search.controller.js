const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const { scopeProjectWhere } = require("../services/access.service");
const { VISIBLE_USER } = require("../utils/visibility");

const contains = (q) => ({ contains: q, mode: "insensitive" });

/**
 * Global search across students, projects, subjects, faculty, mentors and
 * domains (spec §58). Results are filtered by the caller's role: staff
 * directories and the student roster are admin-only, and projects are
 * limited to what the caller can already see.
 */
const globalSearch = asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return res.json({ query: q, groups: [], total: 0 });
  }

  const limit = Math.min(10, Number(req.query.limit) || 5);
  const { role } = req.user;
  const isAdmin = role === "ADMIN";
  const isStaff = role === "ADMIN" || role === "FACULTY" || role === "MENTOR";

  const projectScope = await scopeProjectWhere(req.user);

  const tasks = {
    projects: prisma.project.findMany({
      where: {
        AND: [
          projectScope,
          { OR: [{ title: contains(q) }, { idea: { abstract: contains(q) } }] },
        ],
      },
      include: {
        subject: { select: { name: true, code: true } },
        domain: { select: { name: true } },
        members: { include: { student: { select: { name: true } } } },
      },
      take: limit,
    }),

    subjects: prisma.subject.findMany({
      where: { OR: [{ name: contains(q) }, { code: contains(q) }] },
      include: { semester: true },
      take: limit,
    }),

    domains: prisma.domain.findMany({
      where: { name: contains(q) },
      take: limit,
    }),
  };

  // Students: admins search everyone; faculty and mentors are limited to
  // students on projects they already have access to.
  if (isAdmin) {
    tasks.students = prisma.student.findMany({
      where: {
        OR: [{ name: contains(q) }, { email: contains(q) }, { enrollmentNumber: contains(q) }],
      },
      include: { semester: true },
      take: limit,
    });
  } else if (isStaff) {
    tasks.students = prisma.student.findMany({
      where: {
        AND: [
          { OR: [{ name: contains(q) }, { enrollmentNumber: contains(q) }] },
          { projectMembers: { some: { project: projectScope } } },
        ],
      },
      include: { semester: true },
      take: limit,
    });
  }

  if (isAdmin) {
    tasks.faculty = prisma.faculty.findMany({
      where: {
        user: VISIBLE_USER,
        OR: [
          { facultyId: contains(q) },
          { user: { name: contains(q) } },
          { user: { email: contains(q) } },
        ],
      },
      include: { user: { select: { name: true, email: true } } },
      take: limit,
    });

    tasks.mentors = prisma.mentor.findMany({
      where: {
        user: VISIBLE_USER,
        OR: [
          { mentorId: contains(q) },
          { expertise: contains(q) },
          { user: { name: contains(q) } },
          { user: { email: contains(q) } },
        ],
      },
      include: { user: { select: { name: true, email: true } } },
      take: limit,
    });
  }

  const keys = Object.keys(tasks);
  const settled = await Promise.all(Object.values(tasks));
  const results = Object.fromEntries(keys.map((k, i) => [k, settled[i]]));

  const groups = [];

  if (results.projects?.length) {
    groups.push({
      type: "project",
      label: "Projects",
      items: results.projects.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: [p.subject?.name, p.domain?.name].filter(Boolean).join(" · "),
        meta: p.members.map((m) => m.student.name).join(", "),
        link: `/projects/${p.id}`,
      })),
    });
  }

  if (results.students?.length) {
    groups.push({
      type: "student",
      label: "Students",
      items: results.students.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: s.enrollmentNumber,
        meta: s.semester ? `Semester ${s.semester.number}` : "",
        link: `/admin/students?student=${s.id}`,
      })),
    });
  }

  if (results.subjects?.length) {
    groups.push({
      type: "subject",
      label: "Subjects",
      items: results.subjects.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: s.code,
        meta: s.semester ? `Semester ${s.semester.number}` : "",
        link: `/admin/subjects?subject=${s.id}`,
      })),
    });
  }

  if (results.faculty?.length) {
    groups.push({
      type: "faculty",
      label: "Faculty",
      items: results.faculty.map((f) => ({
        id: f.id,
        title: f.user.name,
        subtitle: f.facultyId,
        meta: f.designation,
        link: `/admin/faculty?faculty=${f.id}`,
      })),
    });
  }

  if (results.mentors?.length) {
    groups.push({
      type: "mentor",
      label: "Mentors",
      items: results.mentors.map((m) => ({
        id: m.id,
        title: m.user.name,
        subtitle: m.mentorId,
        meta: m.expertise || "",
        link: `/admin/mentors?mentor=${m.id}`,
      })),
    });
  }

  if (results.domains?.length) {
    groups.push({
      type: "domain",
      label: "Domains",
      items: results.domains.map((d) => ({
        id: d.id,
        title: d.name,
        subtitle: d.isActive ? "Active" : "Inactive",
        meta: "",
        link: `/admin/domains?domain=${d.id}`,
      })),
    });
  }

  res.json({
    query: q,
    groups,
    total: groups.reduce((sum, g) => sum + g.items.length, 0),
  });
});

module.exports = { globalSearch };
