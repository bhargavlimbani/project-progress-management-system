const prisma = require("../config/prisma");
const { gradeFor } = require("../controllers/evaluation.controller");

/**
 * Every report resolves to the same shape:
 *   { title, subtitle, columns: [{key,label,width}], rows: [...], summary: [{label,value}] }
 * so a single set of exporters (xlsx / csv / pdf) can render any of them.
 */

const pct = (n) => `${Math.round((n || 0) * 10) / 10}%`;
const dateStr = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

const studentNames = (project) =>
  project.members?.map((m) => m.student.name).join(", ") || "—";
const enrollments = (project) =>
  project.members?.map((m) => m.student.enrollmentNumber).join(", ") || "—";

/** Expected progress at the project's current week (spec §41). */
function expectedProgress(project) {
  const weeks = project.subject?.durationWeeks || 12;
  if (!weeks) return 0;
  return Math.min(100, (project.currentWeek / weeks) * 100);
}

const fullProjectInclude = {
  subject: true,
  domain: true,
  academicYear: true,
  faculty: { include: { user: true } },
  mentor: { include: { user: true } },
  members: { include: { student: true } },
};

// ── 1. Overall project report ─────────────────────────────────────────────
async function overallProjectReport(filters = {}) {
  const where = buildProjectWhere(filters);
  const projects = await prisma.project.findMany({
    where,
    include: fullProjectInclude,
    orderBy: [{ subject: { name: "asc" } }, { title: "asc" }],
  });

  const rows = projects.map((p) => ({
    title: p.title,
    subject: p.subject?.name || "—",
    students: studentNames(p),
    enrollment: enrollments(p),
    domain: p.domain?.name || "—",
    faculty: p.faculty?.user?.name || "—",
    mentor: p.mentor?.user?.name || "Unassigned",
    week: p.currentWeek,
    expected: pct(expectedProgress(p)),
    progress: pct(p.progress),
    status: p.status.replace(/_/g, " "),
  }));

  return {
    title: "Overall Project Report",
    subtitle: filterSubtitle(filters),
    columns: [
      { key: "title", label: "Project", width: 34 },
      { key: "subject", label: "Subject", width: 22 },
      { key: "students", label: "Student(s)", width: 26 },
      { key: "enrollment", label: "Enrollment", width: 18 },
      { key: "domain", label: "Domain", width: 18 },
      { key: "faculty", label: "Faculty", width: 20 },
      { key: "mentor", label: "Mentor", width: 20 },
      { key: "week", label: "Week", width: 8 },
      { key: "expected", label: "Expected", width: 11 },
      { key: "progress", label: "Actual", width: 10 },
      { key: "status", label: "Status", width: 20 },
    ],
    rows,
    summary: [
      { label: "Total projects", value: projects.length },
      { label: "Completed", value: projects.filter((p) => p.status === "COMPLETED").length },
      { label: "At risk", value: projects.filter((p) => p.status === "AT_RISK").length },
      { label: "Delayed", value: projects.filter((p) => p.status === "DELAYED").length },
      {
        label: "Average progress",
        value: pct(
          projects.length ? projects.reduce((s, p) => s + p.progress, 0) / projects.length : 0
        ),
      },
    ],
  };
}

// ── 2. Student progress report ────────────────────────────────────────────
async function studentProgressReport(filters = {}) {
  const where = {};
  if (filters.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters.semesterId) where.semesterId = filters.semesterId;

  const students = await prisma.student.findMany({
    where,
    include: {
      academicYear: true,
      semester: true,
      projectMembers: { include: { project: { include: { subject: true } } } },
      weeklyProgress: { include: { reviews: true } },
    },
    orderBy: { enrollmentNumber: "asc" },
  });

  const rows = students.map((s) => {
    const projects = s.projectMembers.map((pm) => pm.project);
    const avg = projects.length
      ? projects.reduce((sum, p) => sum + p.progress, 0) / projects.length
      : 0;
    const approved = s.weeklyProgress.filter((wp) =>
      wp.reviews.some((r) => r.status === "APPROVED")
    ).length;

    return {
      enrollment: s.enrollmentNumber,
      name: s.name,
      email: s.email,
      semester: s.semester?.number ?? "—",
      projects: projects.length,
      submissions: s.weeklyProgress.length,
      approved,
      progress: pct(avg),
      atRisk: projects.filter((p) => ["AT_RISK", "DELAYED"].includes(p.status)).length,
    };
  });

  return {
    title: "Student Progress Report",
    subtitle: filterSubtitle(filters),
    columns: [
      { key: "enrollment", label: "Enrollment", width: 16 },
      { key: "name", label: "Student", width: 26 },
      { key: "email", label: "Email", width: 32 },
      { key: "semester", label: "Sem", width: 7 },
      { key: "projects", label: "Projects", width: 10 },
      { key: "submissions", label: "Submitted", width: 11 },
      { key: "approved", label: "Approved", width: 11 },
      { key: "progress", label: "Avg Progress", width: 14 },
      { key: "atRisk", label: "At Risk", width: 9 },
    ],
    rows,
    summary: [
      { label: "Students", value: students.length },
      { label: "Total submissions", value: rows.reduce((s, r) => s + r.submissions, 0) },
      { label: "Approved submissions", value: rows.reduce((s, r) => s + r.approved, 0) },
    ],
  };
}

// ── 3. Subject-wise report ────────────────────────────────────────────────
async function subjectReport(filters = {}) {
  const where = {};
  if (filters.academicYearId) where.academicYearId = filters.academicYearId;

  const subjects = await prisma.subject.findMany({
    where,
    include: {
      semester: true,
      faculty: { include: { faculty: { include: { user: true } } } },
      projects: true,
    },
    orderBy: { name: "asc" },
  });

  const rows = subjects.map((s) => {
    const total = s.projects.length;
    const avg = total ? s.projects.reduce((sum, p) => sum + p.progress, 0) / total : 0;
    return {
      code: s.code,
      name: s.name,
      semester: s.semester?.number ?? "—",
      weeks: s.durationWeeks,
      faculty: s.faculty.map((fs) => fs.faculty.user.name).join(", ") || "Unassigned",
      projects: total,
      completed: s.projects.filter((p) => p.status === "COMPLETED").length,
      atRisk: s.projects.filter((p) => ["AT_RISK", "DELAYED"].includes(p.status)).length,
      progress: pct(avg),
    };
  });

  return {
    title: "Subject-wise Report",
    subtitle: filterSubtitle(filters),
    columns: [
      { key: "code", label: "Code", width: 12 },
      { key: "name", label: "Subject", width: 28 },
      { key: "semester", label: "Sem", width: 7 },
      { key: "weeks", label: "Weeks", width: 8 },
      { key: "faculty", label: "Faculty", width: 28 },
      { key: "projects", label: "Projects", width: 10 },
      { key: "completed", label: "Completed", width: 11 },
      { key: "atRisk", label: "At Risk", width: 9 },
      { key: "progress", label: "Avg Progress", width: 14 },
    ],
    rows,
    summary: [
      { label: "Subjects", value: subjects.length },
      { label: "Total projects", value: rows.reduce((s, r) => s + r.projects, 0) },
    ],
  };
}

// ── 4. Faculty report ─────────────────────────────────────────────────────
async function facultyReport() {
  const faculty = await prisma.faculty.findMany({
    include: {
      user: true,
      subjects: { include: { subject: true } },
      projects: true,
    },
    orderBy: { facultyId: "asc" },
  });

  const rows = faculty.map((f) => {
    const total = f.projects.length;
    const avg = total ? f.projects.reduce((s, p) => s + p.progress, 0) / total : 0;
    return {
      facultyId: f.facultyId,
      name: f.user.name,
      email: f.user.email,
      designation: f.designation,
      subjects: f.subjects.map((s) => s.subject.code).join(", ") || "—",
      projects: total,
      pending: f.projects.filter((p) =>
        ["IDEA_SUBMITTED", "FACULTY_REVIEW"].includes(p.status)
      ).length,
      atRisk: f.projects.filter((p) => ["AT_RISK", "DELAYED"].includes(p.status)).length,
      progress: pct(avg),
    };
  });

  return {
    title: "Faculty Report",
    subtitle: "Workload and project outcomes per faculty member",
    columns: [
      { key: "facultyId", label: "Faculty ID", width: 13 },
      { key: "name", label: "Name", width: 26 },
      { key: "email", label: "Email", width: 32 },
      { key: "designation", label: "Designation", width: 22 },
      { key: "subjects", label: "Subjects", width: 22 },
      { key: "projects", label: "Projects", width: 10 },
      { key: "pending", label: "Pending", width: 9 },
      { key: "atRisk", label: "At Risk", width: 9 },
      { key: "progress", label: "Avg Progress", width: 14 },
    ],
    rows,
    summary: [
      { label: "Faculty members", value: faculty.length },
      { label: "Projects supervised", value: rows.reduce((s, r) => s + r.projects, 0) },
    ],
  };
}

// ── 5. Mentor report ──────────────────────────────────────────────────────
async function mentorReport() {
  const mentors = await prisma.mentor.findMany({
    include: {
      user: true,
      domains: { include: { domain: true } },
      projects: true,
      weeklyReviews: true,
    },
    orderBy: { mentorId: "asc" },
  });

  const rows = mentors.map((m) => {
    const active = m.projects.filter(
      (p) => !["COMPLETED", "REJECTED", "ARCHIVED"].includes(p.status)
    );
    const avg = m.projects.length
      ? m.projects.reduce((s, p) => s + p.progress, 0) / m.projects.length
      : 0;
    return {
      mentorId: m.mentorId,
      name: m.user.name,
      email: m.user.email,
      expertise: m.expertise || "—",
      domains: m.domains.map((d) => d.domain.name).join(", ") || "—",
      total: m.projects.length,
      active: active.length,
      reviews: m.weeklyReviews.length,
      progress: pct(avg),
    };
  });

  return {
    title: "Mentor Report",
    subtitle: "Domain coverage, workload and review activity",
    columns: [
      { key: "mentorId", label: "Mentor ID", width: 12 },
      { key: "name", label: "Name", width: 24 },
      { key: "email", label: "Email", width: 30 },
      { key: "expertise", label: "Expertise", width: 26 },
      { key: "domains", label: "Domains", width: 26 },
      { key: "total", label: "Projects", width: 10 },
      { key: "active", label: "Active", width: 9 },
      { key: "reviews", label: "Reviews", width: 9 },
      { key: "progress", label: "Avg Progress", width: 14 },
    ],
    rows,
    summary: [
      { label: "Mentors", value: mentors.length },
      { label: "Active assignments", value: rows.reduce((s, r) => s + r.active, 0) },
      { label: "Reviews completed", value: rows.reduce((s, r) => s + r.reviews, 0) },
    ],
  };
}

// ── 6. Domain report ──────────────────────────────────────────────────────
async function domainReport() {
  const domains = await prisma.domain.findMany({
    include: { projects: true, mentors: true },
    orderBy: { name: "asc" },
  });

  const rows = domains.map((d) => {
    const avg = d.projects.length
      ? d.projects.reduce((s, p) => s + p.progress, 0) / d.projects.length
      : 0;
    return {
      name: d.name,
      mentors: d.mentors.length,
      projects: d.projects.length,
      completed: d.projects.filter((p) => p.status === "COMPLETED").length,
      atRisk: d.projects.filter((p) => ["AT_RISK", "DELAYED"].includes(p.status)).length,
      progress: pct(avg),
      status: d.isActive ? "Active" : "Inactive",
    };
  });

  return {
    title: "Domain Report",
    subtitle: "Project distribution and mentor coverage per domain",
    columns: [
      { key: "name", label: "Domain", width: 26 },
      { key: "mentors", label: "Mentors", width: 10 },
      { key: "projects", label: "Projects", width: 10 },
      { key: "completed", label: "Completed", width: 11 },
      { key: "atRisk", label: "At Risk", width: 9 },
      { key: "progress", label: "Avg Progress", width: 14 },
      { key: "status", label: "Status", width: 10 },
    ],
    rows,
    summary: [
      { label: "Domains", value: domains.length },
      { label: "Projects assigned", value: rows.reduce((s, r) => s + r.projects, 0) },
    ],
  };
}

// ── 7. Weekly submission report ───────────────────────────────────────────
async function weeklySubmissionReport(filters = {}) {
  const where = {};
  if (filters.projectId) where.projectId = filters.projectId;

  const submissions = await prisma.weeklyProgress.findMany({
    where,
    include: {
      student: true,
      project: { include: { subject: true, mentor: { include: { user: true } } } },
      reviews: { include: { mentor: { include: { user: true } } } },
    },
    orderBy: [{ weekNumber: "asc" }, { submittedAt: "desc" }],
  });

  const rows = submissions.map((wp) => {
    const mentorReview = wp.reviews.find((r) => r.mentorId);
    const facultyReview = wp.reviews.find((r) => r.facultyId);
    return {
      week: wp.weekNumber,
      student: wp.student.name,
      enrollment: wp.student.enrollmentNumber,
      project: wp.project.title,
      subject: wp.project.subject?.name || "—",
      task: wp.taskTitle,
      submitted: dateStr(wp.submittedAt),
      evidence: [
        wp.githubUrl && "GitHub",
        wp.demoUrl && "Demo",
        wp.screenshots?.length && `${wp.screenshots.length} shot(s)`,
        wp.files?.length && `${wp.files.length} file(s)`,
      ]
        .filter(Boolean)
        .join(", ") || "None",
      mentorReview: mentorReview ? mentorReview.status.replace(/_/g, " ") : "Pending",
      facultyReview: facultyReview ? facultyReview.status.replace(/_/g, " ") : "Pending",
    };
  });

  return {
    title: "Weekly Submission Report",
    subtitle: filterSubtitle(filters),
    columns: [
      { key: "week", label: "Week", width: 7 },
      { key: "student", label: "Student", width: 24 },
      { key: "enrollment", label: "Enrollment", width: 16 },
      { key: "project", label: "Project", width: 30 },
      { key: "subject", label: "Subject", width: 22 },
      { key: "task", label: "Task", width: 26 },
      { key: "submitted", label: "Submitted", width: 12 },
      { key: "evidence", label: "Evidence", width: 24 },
      { key: "mentorReview", label: "Mentor", width: 16 },
      { key: "facultyReview", label: "Faculty", width: 16 },
    ],
    rows,
    summary: [
      { label: "Submissions", value: submissions.length },
      {
        label: "Awaiting mentor review",
        value: rows.filter((r) => r.mentorReview === "Pending").length,
      },
      {
        label: "Awaiting faculty verification",
        value: rows.filter((r) => r.facultyReview === "Pending").length,
      },
    ],
  };
}

// ── 8. Delayed project report ─────────────────────────────────────────────
async function delayedProjectReport(filters = {}) {
  const where = {
    ...buildProjectWhere(filters),
    status: { in: ["AT_RISK", "DELAYED"] },
  };

  const projects = await prisma.project.findMany({
    where,
    include: { ...fullProjectInclude, weeklyProgress: { orderBy: { submittedAt: "desc" }, take: 1 } },
    orderBy: { progress: "asc" },
  });

  const rows = projects.map((p) => {
    const expected = expectedProgress(p);
    return {
      title: p.title,
      subject: p.subject?.name || "—",
      students: studentNames(p),
      mentor: p.mentor?.user?.name || "Unassigned",
      faculty: p.faculty?.user?.name || "—",
      week: p.currentWeek,
      expected: pct(expected),
      actual: pct(p.progress),
      gap: pct(expected - p.progress),
      lastSubmission: dateStr(p.weeklyProgress[0]?.submittedAt),
      status: p.status.replace(/_/g, " "),
    };
  });

  return {
    title: "Delayed & At-Risk Project Report",
    subtitle: filterSubtitle(filters),
    columns: [
      { key: "title", label: "Project", width: 30 },
      { key: "subject", label: "Subject", width: 22 },
      { key: "students", label: "Student(s)", width: 26 },
      { key: "mentor", label: "Mentor", width: 20 },
      { key: "faculty", label: "Faculty", width: 20 },
      { key: "week", label: "Week", width: 7 },
      { key: "expected", label: "Expected", width: 11 },
      { key: "actual", label: "Actual", width: 10 },
      { key: "gap", label: "Gap", width: 9 },
      { key: "lastSubmission", label: "Last Submission", width: 16 },
      { key: "status", label: "Status", width: 12 },
    ],
    rows,
    summary: [
      { label: "At risk", value: projects.filter((p) => p.status === "AT_RISK").length },
      { label: "Delayed", value: projects.filter((p) => p.status === "DELAYED").length },
    ],
  };
}

// ── 9. Final evaluation report ────────────────────────────────────────────
async function evaluationReport(filters = {}) {
  const where = {};
  if (filters.subjectId) where.project = { subjectId: filters.subjectId };

  const evaluations = await prisma.evaluation.findMany({
    where,
    include: {
      marks: { include: { criteria: true } },
      faculty: { include: { user: true } },
      project: { include: fullProjectInclude },
    },
    orderBy: { totalMarks: "desc" },
  });

  const rows = evaluations.map((e) => {
    const maxTotal = e.marks.reduce((s, m) => s + m.criteria.maxMarks, 0);
    const percentage = maxTotal ? (e.totalMarks / maxTotal) * 100 : 0;
    return {
      project: e.project.title,
      subject: e.project.subject?.name || "—",
      students: studentNames(e.project),
      enrollment: enrollments(e.project),
      mentor: e.project.mentor?.user?.name || "—",
      obtained: e.totalMarks ?? 0,
      max: maxTotal,
      percentage: pct(percentage),
      grade: e.grade || gradeFor(percentage),
      completed: dateStr(e.completedAt),
    };
  });

  return {
    title: "Final Evaluation Report",
    subtitle: filterSubtitle(filters),
    columns: [
      { key: "project", label: "Project", width: 30 },
      { key: "subject", label: "Subject", width: 22 },
      { key: "students", label: "Student(s)", width: 26 },
      { key: "enrollment", label: "Enrollment", width: 18 },
      { key: "mentor", label: "Mentor", width: 20 },
      { key: "obtained", label: "Marks", width: 9 },
      { key: "max", label: "Out Of", width: 9 },
      { key: "percentage", label: "Percentage", width: 12 },
      { key: "grade", label: "Grade", width: 8 },
      { key: "completed", label: "Completed", width: 12 },
    ],
    rows,
    summary: [
      { label: "Evaluations", value: evaluations.length },
      {
        label: "Average marks",
        value: evaluations.length
          ? Math.round(
              (evaluations.reduce((s, e) => s + (e.totalMarks || 0), 0) / evaluations.length) * 10
            ) / 10
          : 0,
      },
    ],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────

function buildProjectWhere(filters = {}) {
  const where = {};
  if (filters.academicYearId) where.academicYearId = filters.academicYearId;
  if (filters.subjectId) where.subjectId = filters.subjectId;
  if (filters.domainId) where.domainId = filters.domainId;
  if (filters.facultyId) where.facultyId = filters.facultyId;
  if (filters.mentorId) where.mentorId = filters.mentorId;
  if (filters.status) where.status = filters.status;
  // Caller-derived scope, merged by the controller.
  if (filters.scope) Object.assign(where, filters.scope);
  return where;
}

function filterSubtitle(filters = {}) {
  const parts = [];
  if (filters.academicYearLabel) parts.push(filters.academicYearLabel);
  if (filters.subjectName) parts.push(filters.subjectName);
  if (filters.status) parts.push(filters.status.replace(/_/g, " "));
  parts.push(`Generated ${new Date().toLocaleString("en-GB")}`);
  return parts.join("  ·  ");
}

const REPORTS = {
  "overall-projects": overallProjectReport,
  "student-progress": studentProgressReport,
  subjects: subjectReport,
  faculty: facultyReport,
  mentors: mentorReport,
  domains: domainReport,
  "weekly-submissions": weeklySubmissionReport,
  delayed: delayedProjectReport,
  evaluations: evaluationReport,
};

const REPORT_LIST = [
  { key: "overall-projects", name: "Overall Project Report", description: "Every project with expected vs actual progress." },
  { key: "student-progress", name: "Student Progress Report", description: "Per-student submissions, approvals and average progress." },
  { key: "subjects", name: "Subject-wise Report", description: "Project counts and completion rates per subject." },
  { key: "faculty", name: "Faculty Report", description: "Workload, pending approvals and outcomes per faculty." },
  { key: "mentors", name: "Mentor Report", description: "Domain coverage, assignments and review activity." },
  { key: "domains", name: "Domain Report", description: "Project distribution and mentor coverage per domain." },
  { key: "weekly-submissions", name: "Weekly Submission Report", description: "Every weekly submission with its evidence and review state." },
  { key: "delayed", name: "Delayed & At-Risk Report", description: "Projects whose actual progress trails the expected pace." },
  { key: "evaluations", name: "Final Evaluation Report", description: "Marks, percentages and grades for evaluated projects." },
];

async function buildReport(key, filters) {
  const builder = REPORTS[key];
  if (!builder) return null;
  return builder(filters);
}

module.exports = { buildReport, REPORT_LIST, REPORTS, expectedProgress };
