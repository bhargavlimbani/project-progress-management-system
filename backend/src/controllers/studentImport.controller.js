const prisma = require("../config/prisma");
const service = require("../services/studentImport.service");
const { buildStudentImportTemplate } = require("../utils/generateTemplate");
const { buildActivationLink } = require("../utils/accountActivation");
const { queueActivationEmail } = require("../services/notifyImportedStudents.service");

async function downloadTemplate(req, res, next) {
  try {
    const buffer = buildStudentImportTemplate();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=student-import-template.xlsx");
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

async function validateImport(req, res, next) {
  try {
    const { academicYearId, semesterId } = req.body;
    if (!academicYearId || !semesterId) {
      return res.status(400).json({ message: "Academic year and semester are required." });
    }

    const [academicYear, semester] = await Promise.all([
      prisma.academicYear.findUnique({ where: { id: academicYearId } }),
      prisma.semester.findUnique({ where: { id: semesterId } }),
    ]);
    if (!academicYear || !semester) {
      return res.status(400).json({ message: "Invalid academic year or semester." });
    }

    const rows = service.parseFile(req.file.buffer, req.file.originalname);
    if (rows.length === 0) {
      return res.status(400).json({ message: "The file contains no readable rows." });
    }

    const { valid, duplicates, invalid } = await service.validateRows(rows, { academicYearId, semesterId });

    const batch = await service.createPendingBatch({
      fileName: req.file.originalname,
      uploadedById: req.user.id,
      academicYearId,
      semesterId,
      valid,
      duplicates,
      invalid,
      sendActivationEmails: req.body.sendActivationEmails !== "false",
    });

    res.json({
      batchId: batch.id,
      totalRows: batch.totalRows,
      validRows: batch.validRows,
      duplicateRows: batch.duplicateRows,
      invalidRows: batch.invalidRows,
      duplicates: duplicates.slice(0, 200),
      invalid: invalid.slice(0, 200),
      valid: valid.slice(0, 200).map((r) => ({
        rowNumber: r.rowNumber,
        enrollmentNumber: r.enrollmentNumber,
        name: r.name,
        email: r.email,
        mobile: r.mobile,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function confirmImport(req, res, next) {
  try {
    const { batchId } = req.body;
    if (!batchId) return res.status(400).json({ message: "batchId is required." });

    const { batch, students } = await service.confirmImport(batchId);

    if (batch.sendActivationEmails) {
      const baseUrl = process.env.APP_BASE_URL || "http://localhost:5173";
      for (const student of students) {
        queueActivationEmail({
          to: student.email,
          name: student.name,
          activationLink: buildActivationLink(baseUrl, student.activationToken),
        });
      }
    }

    res.json({
      message: `${students.length} students imported successfully.`,
      imported: students.length,
      batchId: batch.id,
    });
  } catch (err) {
    if (err.message.includes("expired") || err.message.includes("already")) {
      return res.status(409).json({ message: err.message });
    }
    next(err);
  }
}

async function downloadErrorReport(req, res, next) {
  try {
    const { batchId } = req.params;
    const batch = await prisma.importBatch.findUnique({ where: { id: batchId }, include: { errors: true } });
    if (!batch) return res.status(404).json({ message: "Import batch not found." });

    const csv = service.buildErrorReportCsv(batch.errors);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=import-errors-${batchId}.csv`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = { downloadTemplate, validateImport, confirmImport, downloadErrorReport };
