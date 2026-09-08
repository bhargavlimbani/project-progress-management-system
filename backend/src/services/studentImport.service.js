const XLSX = require("xlsx");
const Papa = require("papaparse");
const prisma = require("../config/prisma");
const { validateRowShape } = require("../validators/studentImport.validator");
const { generateActivationToken } = require("../utils/accountActivation");

const BATCH_TTL_MS = 24 * 60 * 60 * 1000; // unconfirmed batches expire in 24h

const HEADER_ALIASES = {
  "enrollment number": "enrollmentNumber",
  "enrollment no": "enrollmentNumber",
  "student name": "name",
  name: "name",
  email: "email",
  mobile: "mobile",
  "mobile number": "mobile",
  "gr number": "grNumber",
  "gr no": "grNumber",
  grno: "grNumber",
  // Older sheets used "Roll Number" for the same column — keep importing them.
  "roll number": "grNumber",
  "roll no": "grNumber",
  semester: "semester",
  "academic year": "academicYear",
};

function normalizeHeader(header) {
  const key = header.trim().toLowerCase();
  return HEADER_ALIASES[key] || null;
}

/**
 * Coerce every cell to a trimmed string.
 *
 * Excel stores a bare enrollment number like 121771 as a NUMBER, so without
 * this the parser hands Prisma a mixed array and the query dies with
 * "Argument `in`: Invalid value provided. Expected String ... provided (String, Int)".
 * Every column we import maps to a String in the database, so normalising here
 * is both correct and the narrowest place to fix it.
 */
function cellToString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") {
    // Avoid 1.21771e+5 style output on large values.
    return Number.isInteger(value) ? String(value) : String(value).trim();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizeRawRows(rawRows) {
  return rawRows.map((raw) => {
    const row = {};
    for (const [header, value] of Object.entries(raw)) {
      const key = normalizeHeader(header);
      if (key) row[key] = cellToString(value);
    }
    return row;
  });
}

function parseFile(buffer, originalName) {
  const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();

  if (ext === ".csv") {
    const text = buffer.toString("utf-8");
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
    return normalizeRawRows(data);
  }

  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  // raw:false yields the cell's DISPLAYED text, which keeps long numeric
  // enrollment numbers intact instead of surfacing float artifacts.
  const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: "", raw: false });
  return normalizeRawRows(rawRows);
}

async function validateRows(rows, { academicYearId, semesterId }) {
  const seenEnrollments = new Set();
  const seenEmails = new Set();

  const enrollmentNumbers = rows.map((r) => r.enrollmentNumber).filter(Boolean);
  const emails = rows.map((r) => r.email).filter(Boolean);

  const existing = await prisma.student.findMany({
    where: {
      OR: [
        { enrollmentNumber: { in: enrollmentNumbers } },
        { email: { in: emails } },
      ],
    },
    select: { enrollmentNumber: true, email: true },
  });
  const existingEnrollments = new Set(existing.map((s) => s.enrollmentNumber));
  const existingEmails = new Set(existing.map((s) => s.email));

  const valid = [];
  const duplicates = [];
  const invalid = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    const shape = validateRowShape(row);
    if (!shape.valid) {
      // Surface the identifying fields at the top level too — the Review step
      // needs to show WHICH row failed, not just that one did.
      invalid.push({
        rowNumber,
        enrollmentNumber: row.enrollmentNumber || "",
        name: row.name || "",
        email: row.email || "",
        mobile: row.mobile || "",
        row,
        reason: shape.reason,
      });
      return;
    }

    const isDuplicateInFile = seenEnrollments.has(row.enrollmentNumber) || seenEmails.has(row.email);
    const isDuplicateInDb = existingEnrollments.has(row.enrollmentNumber) || existingEmails.has(row.email);

    if (isDuplicateInFile || isDuplicateInDb) {
      duplicates.push({
        rowNumber,
        enrollmentNumber: row.enrollmentNumber || "",
        name: row.name || "",
        email: row.email || "",
        mobile: row.mobile || "",
        row,
        reason: isDuplicateInDb
          ? "Enrollment number or email already exists in the system"
          : "Duplicate enrollment number or email within the uploaded file",
      });
      return;
    }

    seenEnrollments.add(row.enrollmentNumber);
    seenEmails.add(row.email);
    valid.push({
      rowNumber,
      enrollmentNumber: row.enrollmentNumber,
      name: row.name,
      email: row.email,
      mobile: row.mobile,
      grNumber: row.grNumber || null,
      academicYearId,
      semesterId,
    });
  });

  return { valid, duplicates, invalid };
}

async function createPendingBatch({
  fileName,
  uploadedById,
  academicYearId,
  semesterId,
  valid,
  duplicates,
  invalid,
  sendActivationEmails,
}) {
  return prisma.importBatch.create({
    data: {
      fileName,
      uploadedById,
      academicYearId,
      semesterId,
      totalRows: valid.length + duplicates.length + invalid.length,
      validRows: valid.length,
      duplicateRows: duplicates.length,
      invalidRows: invalid.length,
      status: "PENDING",
      validRowsJson: valid,
      sendActivationEmails,
      expiresAt: new Date(Date.now() + BATCH_TTL_MS),
      errors: {
        create: [...duplicates, ...invalid].map((e) => ({
          rowNumber: e.rowNumber,
          rawData: e.row,
          reason: e.reason,
        })),
      },
    },
    include: { errors: true },
  });
}

async function confirmImport(batchId) {
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });

  if (!batch) throw new Error("Import batch not found.");
  if (batch.status !== "PENDING") throw new Error(`Batch already ${batch.status.toLowerCase()}.`);
  if (batch.expiresAt < new Date()) throw new Error("This import batch has expired. Please re-upload the file.");

  const validRows = batch.validRowsJson;

  const created = await prisma.$transaction(async (tx) => {
    const insertedStudents = [];
    for (const row of validRows) {
      const student = await tx.student.create({
        data: {
          enrollmentNumber: row.enrollmentNumber,
          name: row.name,
          email: row.email,
          mobile: row.mobile,
          grNumber: row.grNumber,
          academicYearId: row.academicYearId,
          semesterId: row.semesterId,
          activationToken: generateActivationToken(),
          isActivated: false,
          importBatchId: batch.id,
        },
      });
      insertedStudents.push(student);
    }

    await tx.importBatch.update({
      where: { id: batch.id },
      data: { status: "COMPLETED" },
    });

    return insertedStudents;
  });

  return { batch, students: created };
}

function buildErrorReportCsv(errors) {
  const header = "Row Number,Enrollment Number,Name,Email,Mobile,Reason\n";
  const lines = errors.map((e) => {
    const r = e.rawData || {};
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [e.rowNumber, cell(r.enrollmentNumber), cell(r.name), cell(r.email), cell(r.mobile), cell(e.reason)].join(",");
  });
  return header + lines.join("\n");
}

module.exports = {
  parseFile,
  validateRows,
  createPendingBatch,
  confirmImport,
  buildErrorReportCsv,
};
