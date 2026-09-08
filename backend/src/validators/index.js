const { checker } = require("./common.validator");

// ── Auth ──────────────────────────────────────────────────────────────────
const login = (d) =>
  checker()
    .required("email", d.email, "Email or enrollment number")
    .required("password", d.password, "Password")
    .result();

const changePassword = (d) =>
  checker()
    .required("currentPassword", d.currentPassword, "Current password")
    .required("newPassword", d.newPassword, "New password")
    .minLength("newPassword", d.newPassword, 8, "New password")
    .custom(
      "newPassword",
      d.newPassword && d.newPassword === d.currentPassword,
      "New password must differ from the current one."
    )
    .result();

// ── Academic ──────────────────────────────────────────────────────────────
const academicYear = (d) =>
  checker()
    .required("label", d.label, "Academic year")
    .custom(
      "label",
      d.label && !/^\d{4}\s*[–-]\s*\d{4}$/.test(String(d.label).trim()),
      "Academic year must look like 2026-2027."
    )
    .isoDate("startDate", d.startDate, "Start date")
    .isoDate("endDate", d.endDate, "End date")
    .custom(
      "endDate",
      d.startDate && d.endDate && new Date(d.endDate) <= new Date(d.startDate),
      "End date must be after the start date."
    )
    .result();

const semester = (d) =>
  checker()
    .required("number", d.number, "Semester number")
    .intRange("number", d.number, 1, 8, "Semester number")
    .required("academicYearId", d.academicYearId, "Academic year")
    .uuid("academicYearId", d.academicYearId, "Academic year")
    .result();

// ── Subject ───────────────────────────────────────────────────────────────
const subject = (d) =>
  checker()
    .required("name", d.name, "Subject name")
    .maxLength("name", d.name, 120, "Subject name")
    .required("code", d.code, "Subject code")
    .maxLength("code", d.code, 20, "Subject code")
    .required("semesterId", d.semesterId, "Semester")
    .required("academicYearId", d.academicYearId, "Academic year")
    .intRange("durationWeeks", d.durationWeeks, 1, 52, "Project duration (weeks)")
    .result();

// ── Faculty / Mentor ──────────────────────────────────────────────────────
const faculty = (d) =>
  checker()
    .required("name", d.name, "Name")
    .required("email", d.email, "Email")
    .email("email", d.email, "Email")
    .required("facultyId", d.facultyId, "Faculty ID")
    .required("designation", d.designation, "Designation")
    .mobile("mobile", d.mobile, "Mobile number")
    .minLength("password", d.password, 8, "Password")
    .result();

const mentor = (d) =>
  checker()
    .required("name", d.name, "Name")
    .required("email", d.email, "Email")
    .email("email", d.email, "Email")
    .required("mentorId", d.mentorId, "Mentor ID")
    .mobile("mobile", d.mobile, "Mobile number")
    .minLength("password", d.password, 8, "Password")
    .result();

const domain = (d) =>
  checker()
    .required("name", d.name, "Domain name")
    .maxLength("name", d.name, 80, "Domain name")
    .result();

// ── Student ───────────────────────────────────────────────────────────────
const student = (d) =>
  checker()
    .required("name", d.name, "Student name")
    .required("enrollmentNumber", d.enrollmentNumber, "Enrollment number")
    .maxLength("enrollmentNumber", d.enrollmentNumber, 30, "Enrollment number")
    .required("email", d.email, "Email")
    .email("email", d.email, "Email")
    .required("mobile", d.mobile, "Mobile number")
    .mobile("mobile", d.mobile, "Mobile number")
    .required("academicYearId", d.academicYearId, "Academic year")
    .required("semesterId", d.semesterId, "Semester")
    .result();

/**
 * Partial update: only the fields actually supplied are checked, but they are
 * held to the same rules as on create. Without this, PUT could set a malformed
 * email or a 5-digit mobile that POST would have rejected.
 */
const studentUpdate = (d) =>
  checker()
    .custom("name", d.name !== undefined && String(d.name).trim() === "", "Student name cannot be empty.")
    .email("email", d.email, "Email")
    .mobile("mobile", d.mobile, "Mobile number")
    .maxLength("grNumber", d.grNumber, 30, "GR number")
    .result();

// ── Project & idea ────────────────────────────────────────────────────────
const project = (d) =>
  checker()
    .required("title", d.title, "Project title")
    .minLength("title", d.title, 5, "Project title")
    .maxLength("title", d.title, 200, "Project title")
    .required("subjectId", d.subjectId, "Subject")
    .result();

const projectIdea = (d) =>
  checker()
    .required("title", d.title, "Project title")
    .minLength("title", d.title, 5, "Project title")
    .required("abstract", d.abstract, "Abstract")
    .minLength("abstract", d.abstract, 50, "Abstract")
    .required("problemStatement", d.problemStatement, "Problem statement")
    .minLength("problemStatement", d.problemStatement, 50, "Problem statement")
    .required("objectives", d.objectives, "Objectives")
    .required("scope", d.scope, "Scope")
    .required("technologies", d.technologies, "Technologies")
    .required("expectedOutcome", d.expectedOutcome, "Expected outcome")
    .required("domainId", d.domainId, "Domain")
    .result();

const ideaReview = (d) =>
  checker()
    .required("status", d.status, "Decision")
    .oneOf("status", d.status, ["APPROVED", "REJECTED", "CHANGES_REQUIRED"], "Decision")
    // Spec §30: comments are mandatory when rejecting or requesting changes.
    .custom(
      "comments",
      ["REJECTED", "CHANGES_REQUIRED"].includes(d.status) &&
        (!d.comments || String(d.comments).trim().length < 10),
      "Please explain your decision in at least 10 characters."
    )
    .result();

// ── Milestone ─────────────────────────────────────────────────────────────
const milestone = (d) =>
  checker()
    .required("title", d.title, "Milestone title")
    .required("weekNumber", d.weekNumber, "Week number")
    .intRange("weekNumber", d.weekNumber, 1, 52, "Week number")
    .numberRange("weight", d.weight, 0, 100, "Weight")
    .isoDate("startDate", d.startDate, "Start date")
    .isoDate("endDate", d.endDate, "End date")
    .custom(
      "endDate",
      d.startDate && d.endDate && new Date(d.endDate) < new Date(d.startDate),
      "End date cannot be before the start date."
    )
    .result();

// ── Weekly progress ───────────────────────────────────────────────────────
const weeklyProgress = (d) => {
  const c = checker()
    .required("weekNumber", d.weekNumber, "Week number")
    .intRange("weekNumber", d.weekNumber, 1, 52, "Week number")
    .required("taskTitle", d.taskTitle, "Task title")
    .required("description", d.description, "Description")
    .minLength("description", d.description, 20, "Description")
    .required("completedWork", d.completedWork, "Completed work")
    .minLength("completedWork", d.completedWork, 20, "Completed work")
    .url("githubUrl", d.githubUrl, "GitHub URL")
    .url("demoUrl", d.demoUrl, "Demo URL");

  // Spec §37: progress claims must carry verifiable evidence.
  const hasEvidence =
    (Array.isArray(d.screenshots) && d.screenshots.length > 0) ||
    (Array.isArray(d.files) && d.files.length > 0) ||
    Boolean(d.githubUrl) ||
    Boolean(d.demoUrl);

  return c
    .custom(
      "evidence",
      !hasEvidence,
      "Attach at least one piece of evidence — a screenshot, file, GitHub link or demo URL."
    )
    .result();
};

const progressReview = (d) =>
  checker()
    .required("status", d.status, "Decision")
    .oneOf("status", d.status, ["APPROVED", "REJECTED", "CHANGES_REQUIRED"], "Decision")
    .custom(
      "feedback",
      ["REJECTED", "CHANGES_REQUIRED"].includes(d.status) &&
        (!d.feedback || String(d.feedback).trim().length < 10),
      "Please give the student at least 10 characters of feedback."
    )
    .result();

// ── Documents ─────────────────────────────────────────────────────────────
const documentUpload = (d) =>
  checker()
    .required("type", d.type, "Document type")
    .oneOf(
      "type",
      d.type,
      [
        "PROJECT_PROPOSAL", "PROBLEM_STATEMENT", "SRS", "UML", "DFD", "ER_DIAGRAM",
        "ARCHITECTURE", "PPT", "FINAL_REPORT", "SOURCE_CODE", "APK", "DEMO_VIDEO", "OTHER",
      ],
      "Document type"
    )
    .result();

const documentReview = (d) =>
  checker()
    .required("status", d.status, "Decision")
    .oneOf("status", d.status, ["APPROVED", "REJECTED", "CHANGES_REQUIRED"], "Decision")
    .custom(
      "comments",
      ["REJECTED", "CHANGES_REQUIRED"].includes(d.status) &&
        (!d.comments || String(d.comments).trim().length < 10),
      "Please explain your decision in at least 10 characters."
    )
    .result();

// ── Meetings & presentations ──────────────────────────────────────────────
const meeting = (d) =>
  checker()
    .required("projectId", d.projectId, "Project")
    .required("title", d.title, "Meeting title")
    .required("scheduledAt", d.scheduledAt, "Date and time")
    .isoDate("scheduledAt", d.scheduledAt, "Date and time")
    .oneOf("type", d.type, ["IN_PERSON", "ONLINE", "HYBRID"], "Meeting type")
    .intRange("duration", d.duration, 5, 600, "Duration (minutes)")
    .url("meetLink", d.meetLink, "Meeting link")
    .custom(
      "meetLink",
      (d.type === "ONLINE" || d.type === "HYBRID") && !d.meetLink,
      "An online meeting needs a joining link."
    )
    .custom("venue", d.type === "IN_PERSON" && !d.venue, "An in-person meeting needs a venue.")
    .result();

const presentation = (d) =>
  checker()
    .required("projectId", d.projectId, "Project")
    .required("title", d.title, "Presentation title")
    .required("scheduledAt", d.scheduledAt, "Date and time")
    .isoDate("scheduledAt", d.scheduledAt, "Date and time")
    .oneOf("type", d.type, ["INTERNAL", "EXTERNAL", "VIVA", "DEMO", "FINAL"], "Presentation type")
    .result();

// ── Evaluation ────────────────────────────────────────────────────────────
const evaluationCriteria = (d) => {
  const list = Array.isArray(d.criteria) ? d.criteria : [];
  const c = checker().custom("criteria", list.length === 0, "Add at least one criterion.");

  list.forEach((item, i) => {
    if (!item?.name || String(item.name).trim() === "") {
      c.custom(`criteria[${i}].name`, true, "Criterion name is required.");
    }
    const marks = Number(item?.maxMarks);
    if (Number.isNaN(marks) || marks <= 0) {
      c.custom(`criteria[${i}].maxMarks`, true, "Max marks must be greater than 0.");
    }
  });

  return c.result();
};

const evaluationMarks = (d) => {
  const list = Array.isArray(d.marks) ? d.marks : [];
  const c = checker().custom("marks", list.length === 0, "Award marks for at least one criterion.");

  list.forEach((m, i) => {
    if (!m?.criteriaId) c.custom(`marks[${i}].criteriaId`, true, "Criterion is required.");
    const awarded = Number(m?.marksAwarded);
    if (Number.isNaN(awarded) || awarded < 0) {
      c.custom(`marks[${i}].marksAwarded`, true, "Marks must be zero or more.");
    }
  });

  return c.result();
};

// ── Chat ──────────────────────────────────────────────────────────────────
const message = (d) =>
  checker()
    .custom(
      "body",
      (!d.body || String(d.body).trim() === "") && !d.fileUrl,
      "A message needs text or an attachment."
    )
    .maxLength("body", d.body, 4000, "Message")
    .result();

module.exports = {
  login,
  changePassword,
  academicYear,
  semester,
  subject,
  faculty,
  mentor,
  domain,
  student,
  studentUpdate,
  project,
  projectIdea,
  ideaReview,
  milestone,
  weeklyProgress,
  progressReview,
  documentUpload,
  documentReview,
  meeting,
  presentation,
  evaluationCriteria,
  evaluationMarks,
  message,
};
