const prisma = require("../config/prisma");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { buildReport, REPORT_LIST } = require("../services/report.service");
const { toXlsx, toCsv, toPdf, CONTENT_TYPES } = require("../services/export.service");
const { scopeProjectWhere } = require("../services/access.service");
const { logActivity } = require("../services/activityLog.service");

/** Reports whose rows are projects, and therefore need caller scoping. */
const PROJECT_SCOPED = new Set(["overall-projects", "delayed", "weekly-submissions"]);

/** Reports only an admin may run, because they span the whole department. */
const ADMIN_ONLY = new Set(["faculty", "mentors", "domains", "student-progress", "subjects"]);

const listReports = asyncHandler(async (req, res) => {
  const available =
    req.user.role === "ADMIN" ? REPORT_LIST : REPORT_LIST.filter((r) => !ADMIN_ONLY.has(r.key));
  res.json(available);
});

/** Resolve query filters plus any scope the caller's role implies. */
async function resolveFilters(req, key) {
  const { academicYearId, subjectId, domainId, facultyId, mentorId, status, projectId } = req.query;

  const filters = {
    ...(academicYearId && { academicYearId }),
    ...(subjectId && { subjectId }),
    ...(domainId && { domainId }),
    ...(facultyId && { facultyId }),
    ...(mentorId && { mentorId }),
    ...(status && { status }),
    ...(projectId && { projectId }),
  };

  if (PROJECT_SCOPED.has(key) && req.user.role !== "ADMIN") {
    filters.scope = await scopeProjectWhere(req.user);
  }

  // Decorate the subtitle with human-readable filter labels.
  if (academicYearId) {
    const year = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
    filters.academicYearLabel = year?.label;
  }
  if (subjectId) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    filters.subjectName = subject?.name;
  }

  return filters;
}

function assertAllowed(user, key) {
  if (ADMIN_ONLY.has(key) && user.role !== "ADMIN") {
    throw ApiError.forbidden("This report is available to administrators only.");
  }
}

/** JSON preview, so the UI can render the report before anyone downloads it. */
const previewReport = asyncHandler(async (req, res) => {
  const { key } = req.params;
  assertAllowed(req.user, key);

  const report = await buildReport(key, await resolveFilters(req, key));
  if (!report) throw ApiError.notFound(`Unknown report "${key}".`);

  res.json(report);
});

/** Download as pdf | xlsx | csv. */
const downloadReport = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const format = String(req.query.format || "pdf").toLowerCase();

  assertAllowed(req.user, key);
  if (!CONTENT_TYPES[format]) {
    throw ApiError.badRequest("Format must be one of: pdf, xlsx, csv.");
  }

  const report = await buildReport(key, await resolveFilters(req, key));
  if (!report) throw ApiError.notFound(`Unknown report "${key}".`);

  let buffer;
  if (format === "pdf") buffer = await toPdf(report);
  else if (format === "xlsx") buffer = toXlsx(report);
  else buffer = toCsv(report);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `SAPMS-${key}-${stamp}.${format}`;

  await logActivity({
    userId: req.user.role === "STUDENT" ? undefined : req.user.id,
    studentId: req.user.role === "STUDENT" ? req.user.id : undefined,
    action: "REPORT_EXPORTED",
    entityType: "Report",
    entityId: key,
    metadata: { format },
  });

  res.setHeader("Content-Type", CONTENT_TYPES[format]);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
});

module.exports = { listReports, previewReport, downloadReport };
