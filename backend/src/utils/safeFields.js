/**
 * Field selections that are safe to serialize to a client.
 *
 * Prisma's `include: { user: true }` returns EVERY scalar column, which means
 * `passwordHash` — and on Student, the single-use `activationToken` that lets
 * anyone holding it take the account over. Always reach for these instead of
 * `true` when nesting a User, Student, Faculty or Mentor into a response.
 */

/** Public User fields. Never includes passwordHash. */
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  profilePhoto: true,
  createdAt: true,
};

/** Public Student fields. Never includes passwordHash or activationToken. */
const SAFE_STUDENT_SELECT = {
  id: true,
  enrollmentNumber: true,
  grNumber: true,
  name: true,
  email: true,
  mobile: true,
  profilePhoto: true,
  isActive: true,
  isActivated: true,
  academicYearId: true,
  semesterId: true,
  createdAt: true,
  updatedAt: true,
};

/** Minimal Student shape for embedding in project/member listings. */
const STUDENT_SUMMARY_SELECT = {
  id: true,
  name: true,
  enrollmentNumber: true,
  email: true,
  profilePhoto: true,
};

/**
 * Strip secrets from an already-fetched row. Use when a query relies on
 * `include` (which cannot be mixed with `select` at the same level) and so
 * cannot restrict its own scalar fields.
 */
function stripStudentSecrets(student) {
  if (!student) return student;
  const { passwordHash, activationToken, ...safe } = student;
  return safe;
}

function stripUserSecrets(user) {
  if (!user) return user;
  const { passwordHash, ...safe } = user;
  return safe;
}

/** Apply stripStudentSecrets across a list. */
const stripStudentList = (students = []) => students.map(stripStudentSecrets);

module.exports = {
  SAFE_USER_SELECT,
  SAFE_STUDENT_SELECT,
  STUDENT_SUMMARY_SELECT,
  stripStudentSecrets,
  stripUserSecrets,
  stripStudentList,
};
