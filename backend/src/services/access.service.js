const prisma = require("../config/prisma");

/**
 * Build the Prisma `where` fragment that limits Project rows to what a given
 * caller is allowed to see. Every list/detail endpoint composes this instead
 * of trusting a role or id sent by the client (spec §56).
 *
 *  - ADMIN   → everything
 *  - FACULTY → projects in subjects assigned to them
 *  - MENTOR  → projects they mentor
 *  - STUDENT → projects they are a member of
 */
async function scopeProjectWhere(user) {
  if (!user) return { id: "__none__" };

  switch (user.role) {
    case "ADMIN":
      return {};

    case "FACULTY": {
      const faculty = await prisma.faculty.findUnique({
        where: { userId: user.id },
        include: { subjects: true },
      });
      if (!faculty) return { id: "__none__" };
      const subjectIds = faculty.subjects.map((s) => s.subjectId);
      // Own projects, plus anything in a subject they are assigned to.
      return {
        OR: [{ facultyId: faculty.id }, { subjectId: { in: subjectIds } }],
      };
    }

    case "MENTOR": {
      const mentor = await prisma.mentor.findUnique({ where: { userId: user.id } });
      if (!mentor) return { id: "__none__" };
      return { mentorId: mentor.id };
    }

    case "STUDENT":
      return { members: { some: { studentId: user.id } } };

    default:
      return { id: "__none__" };
  }
}

/**
 * Throw-free check that a caller may act on one specific project.
 * Returns the project (with the caller's role context) or null.
 */
async function getAccessibleProject(user, projectId, include = {}) {
  const scope = await scopeProjectWhere(user);
  return prisma.project.findFirst({
    where: { AND: [{ id: projectId }, scope] },
    include,
  });
}

/** Resolve the Faculty row for a staff user, or null. */
async function facultyOf(user) {
  if (user?.role !== "FACULTY") return null;
  return prisma.faculty.findUnique({ where: { userId: user.id } });
}

/** Resolve the Mentor row for a staff user, or null. */
async function mentorOf(user) {
  if (user?.role !== "MENTOR") return null;
  return prisma.mentor.findUnique({ where: { userId: user.id } });
}

module.exports = { scopeProjectWhere, getAccessibleProject, facultyOf, mentorOf };
