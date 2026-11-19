const test = require("node:test");
const assert = require("node:assert/strict");
const { SAFE_USER_SELECT, STUDENT_SUMMARY_SELECT } = require("../src/utils/safeFields");
const prisma = require("../src/config/prisma");
const { deleteProject, getStudentProjects } = require("../src/controllers/project.controller");

// Helper to create mock Express response object
function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  return res;
}

test("Security: SAFE_USER_SELECT strictly excludes passwordHash", () => {
  assert.equal(SAFE_USER_SELECT.passwordHash, undefined, "passwordHash must not exist in SAFE_USER_SELECT");
  assert.equal(SAFE_USER_SELECT.name, true);
  assert.equal(SAFE_USER_SELECT.email, true);
  assert.equal(SAFE_USER_SELECT.role, true);
});

test("Security: STUDENT_SUMMARY_SELECT strictly excludes passwordHash and activationToken", () => {
  assert.equal(STUDENT_SUMMARY_SELECT.passwordHash, undefined, "passwordHash must not exist in STUDENT_SUMMARY_SELECT");
  assert.equal(STUDENT_SUMMARY_SELECT.activationToken, undefined, "activationToken must not exist in STUDENT_SUMMARY_SELECT");
  assert.equal(STUDENT_SUMMARY_SELECT.enrollmentNumber, true);
});

test("Regression: getStudentProjects query uses safe field selectors to prevent secret leakage", async () => {
  // Test by mocking prisma.student.findUnique and prisma.project.findMany
  const originalStudentFindUnique = prisma.student.findUnique;
  const originalProjectFindMany = prisma.project.findMany;

  let queryIncludeArg = null;

  prisma.student.findUnique = async () => ({ id: "mock-student-id" });
  prisma.project.findMany = async (args) => {
    queryIncludeArg = args.include;
    return [
      {
        id: "mock-project-1",
        title: "Test Project",
        faculty: {
          id: "fac-1",
          user: { id: "u-1", name: "Faculty Name", email: "fac@test.com", role: "FACULTY" },
        },
        mentor: {
          id: "men-1",
          user: { id: "u-2", name: "Mentor Name", email: "men@test.com", role: "MENTOR" },
        },
        members: [
          {
            id: "pm-1",
            student: { id: "mock-student-id", name: "Student Name", enrollmentNumber: "123456" },
          },
        ],
      },
    ];
  };

  try {
    const req = { user: { id: "mock-student-id", role: "STUDENT" } };
    const res = createMockRes();

    await getStudentProjects(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.ok(Array.isArray(res.data));
    assert.equal(res.data[0].title, "Test Project");

    // Verify the Prisma query included SAFE_USER_SELECT and STUDENT_SUMMARY_SELECT
    assert.deepEqual(queryIncludeArg.faculty.include.user.select, SAFE_USER_SELECT);
    assert.deepEqual(queryIncludeArg.mentor.include.user.select, SAFE_USER_SELECT);
    assert.deepEqual(queryIncludeArg.members.include.student.select, STUDENT_SUMMARY_SELECT);

    // Verify output has no passwordHash or activationToken anywhere
    const jsonOutput = JSON.stringify(res.data);
    assert.equal(jsonOutput.includes("passwordHash"), false, "passwordHash must never be exposed in getStudentProjects response");
    assert.equal(jsonOutput.includes("activationToken"), false, "activationToken must never be exposed in getStudentProjects response");
  } finally {
    prisma.student.findUnique = originalStudentFindUnique;
    prisma.project.findMany = originalProjectFindMany;
  }
});

test("Authorization: deleteProject rejects STUDENT with 403 Forbidden", async () => {
  const req = {
    params: { id: "proj-123" },
    user: { id: "student-1", role: "STUDENT" },
  };
  const res = createMockRes();

  await deleteProject(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.data.message, "You are not authorized to delete projects.");
});

test("Authorization: deleteProject rejects MENTOR with 403 Forbidden", async () => {
  const req = {
    params: { id: "proj-123" },
    user: { id: "mentor-1", role: "MENTOR" },
  };
  const res = createMockRes();

  await deleteProject(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.equal(res.data.message, "You are not authorized to delete projects.");
});

test("Authorization: deleteProject returns 404 when project does not exist", async () => {
  const originalFindUnique = prisma.project.findUnique;
  prisma.project.findUnique = async () => null;

  try {
    const req = {
      params: { id: "non-existent-proj" },
      user: { id: "admin-1", role: "ADMIN" },
    };
    const res = createMockRes();

    await deleteProject(req, res, () => {});

    assert.equal(res.statusCode, 404);
    assert.equal(res.data.message, "Project not found.");
  } finally {
    prisma.project.findUnique = originalFindUnique;
  }
});

test("Authorization: deleteProject allows ADMIN to delete existing project", async () => {
  const originalFindUnique = prisma.project.findUnique;
  const originalDelete = prisma.project.delete;
  const originalLogActivity = prisma.activityLog.create;

  let deletedProjectId = null;
  prisma.project.findUnique = async ({ where }) => ({ id: where.id, title: "Test Project" });
  prisma.project.delete = async ({ where }) => {
    deletedProjectId = where.id;
    return { id: where.id };
  };
  prisma.activityLog.create = async () => ({ id: "log-1" });

  try {
    const req = {
      params: { id: "proj-to-delete" },
      user: { id: "admin-1", role: "ADMIN" },
    };
    const res = createMockRes();

    await deleteProject(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.message, "Project deleted.");
    assert.equal(deletedProjectId, "proj-to-delete");
  } finally {
    prisma.project.findUnique = originalFindUnique;
    prisma.project.delete = originalDelete;
    prisma.activityLog.create = originalLogActivity;
  }
});

test("Authorization: deleteProject rejects FACULTY when project is not assigned to them (403)", async () => {
  const originalFindUnique = prisma.project.findUnique;
  const originalFindFirst = prisma.project.findFirst;
  const originalFacultyFindUnique = prisma.faculty.findUnique;

  prisma.project.findUnique = async () => ({ id: "proj-other-fac", facultyId: "other-faculty-id" });
  prisma.faculty.findUnique = async () => ({ id: "my-faculty-id" });
  // getAccessibleProject will use scopeProjectWhere and findFirst:
  prisma.project.findFirst = async () => null; // Not found under this faculty's scope

  try {
    const req = {
      params: { id: "proj-other-fac" },
      user: { id: "fac-user-1", role: "FACULTY" },
    };
    const res = createMockRes();

    await deleteProject(req, res, () => {});

    assert.equal(res.statusCode, 403);
    assert.equal(res.data.message, "You are not authorized to delete this project.");
  } finally {
    prisma.project.findUnique = originalFindUnique;
    prisma.project.findFirst = originalFindFirst;
    prisma.faculty.findUnique = originalFacultyFindUnique;
  }
});

test("Authorization: deleteProject allows FACULTY to delete their own project", async () => {
  const originalFindUnique = prisma.project.findUnique;
  const originalFindFirst = prisma.project.findFirst;
  const originalDelete = prisma.project.delete;
  const originalFacultyFindUnique = prisma.faculty.findUnique;
  const originalLogActivity = prisma.activityLog.create;

  let deletedProjectId = null;
  prisma.project.findUnique = async () => ({ id: "proj-my-own", facultyId: "my-faculty-id" });
  prisma.faculty.findUnique = async () => ({ id: "my-faculty-id" });
  prisma.project.findFirst = async () => ({ id: "proj-my-own", facultyId: "my-faculty-id" }); // Found under scope
  prisma.project.delete = async ({ where }) => {
    deletedProjectId = where.id;
    return { id: where.id };
  };
  prisma.activityLog.create = async () => ({ id: "log-1" });

  try {
    const req = {
      params: { id: "proj-my-own" },
      user: { id: "fac-user-1", role: "FACULTY" },
    };
    const res = createMockRes();

    await deleteProject(req, res, () => {});

    assert.equal(res.statusCode, 200);
    assert.equal(res.data.message, "Project deleted.");
    assert.equal(deletedProjectId, "proj-my-own");
  } finally {
    prisma.project.findUnique = originalFindUnique;
    prisma.project.findFirst = originalFindFirst;
    prisma.project.delete = originalDelete;
    prisma.faculty.findUnique = originalFacultyFindUnique;
    prisma.activityLog.create = originalLogActivity;
  }
});
