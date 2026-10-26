const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");

/**
 * Turn a report dataset (see report.service.js) into a downloadable buffer.
 * Keeping the dataset shape uniform means every report gets all three
 * formats for free.
 */

// ── Excel ─────────────────────────────────────────────────────────────────
function toXlsx(report) {
  const header = report.columns.map((c) => c.label);
  const body = report.rows.map((row) => report.columns.map((c) => row[c.key] ?? ""));

  const sheetData = [
    [report.title],
    [report.subtitle || ""],
    [],
    header,
    ...body,
  ];

  if (report.summary?.length) {
    sheetData.push([], ["Summary"]);
    report.summary.forEach((s) => sheetData.push([s.label, s.value]));
  }

  const sheet = XLSX.utils.aoa_to_sheet(sheetData);
  sheet["!cols"] = report.columns.map((c) => ({ wch: c.width || 18 }));
  // Let the title span the table width.
  sheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, report.columns.length - 1) } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, report.columns.length - 1) } },
  ];

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Report");
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}

// ── CSV ───────────────────────────────────────────────────────────────────
function toCsv(report) {
  const header = report.columns.map((c) => c.label);
  const body = report.rows.map((row) => report.columns.map((c) => row[c.key] ?? ""));
  const sheet = XLSX.utils.aoa_to_sheet([header, ...body]);
  return Buffer.from(XLSX.utils.sheet_to_csv(sheet), "utf8");
}

// ── PDF ───────────────────────────────────────────────────────────────────

const NAVY = "#0a1628";
const PURPLE = "#7c3aed";
const SLATE = "#64748b";
const LIGHT = "#f1f5f9";

/**
 * Render a landscape PDF with a repeating table header. Column widths come
 * from the dataset's relative `width` values, normalised to the page.
 */
function toPdf(report) {
  return new Promise((resolve, reject) => {
    // bufferPages keeps every page in memory so the footer pass below can
    // switch back and stamp "Page x of y" once the total is known.
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
      bufferPages: true,
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const totalWidth = report.columns.reduce((s, c) => s + (c.width || 18), 0);
    const colWidths = report.columns.map((c) => ((c.width || 18) / totalWidth) * pageWidth);

    // ── Header band
    doc.rect(0, 0, doc.page.width, 62).fill(NAVY);
    doc.fillColor("#ffffff").fontSize(17).font("Helvetica-Bold").text("SAPMS", 36, 16);
    doc
      .fillColor("#a78bfa")
      .fontSize(8)
      .font("Helvetica")
      .text("Smart Academic Project Management System  ·  ICT Department", 36, 37);
    doc
      .fillColor("#ffffff")
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(report.title, 36, 16, { width: pageWidth, align: "right" });
    doc
      .fillColor("#94a3b8")
      .fontSize(7.5)
      .font("Helvetica")
      .text(report.subtitle || "", 36, 37, { width: pageWidth, align: "right" });

    doc.y = 78;

    const drawTableHeader = () => {
      const y = doc.y;
      doc.rect(36, y, pageWidth, 20).fill(PURPLE);
      let x = 36;
      doc.fillColor("#ffffff").fontSize(7.5).font("Helvetica-Bold");
      report.columns.forEach((col, i) => {
        doc.text(col.label, x + 4, y + 6, { width: colWidths[i] - 8, ellipsis: true });
        x += colWidths[i];
      });
      doc.y = y + 20;
    };

    drawTableHeader();

    doc.font("Helvetica").fontSize(7);
    report.rows.forEach((row, rowIndex) => {
      // Measure the tallest cell so wrapped text never overlaps the next row.
      const heights = report.columns.map((col, i) =>
        doc.heightOfString(String(row[col.key] ?? ""), { width: colWidths[i] - 8 })
      );
      const rowHeight = Math.max(16, Math.max(...heights) + 8);

      if (doc.y + rowHeight > doc.page.height - 48) {
        doc.addPage();
        doc.y = 40;
        drawTableHeader();
        doc.font("Helvetica").fontSize(7);
      }

      const y = doc.y;
      if (rowIndex % 2 === 1) doc.rect(36, y, pageWidth, rowHeight).fill(LIGHT);

      let x = 36;
      doc.fillColor("#1e293b");
      report.columns.forEach((col, i) => {
        doc.text(String(row[col.key] ?? ""), x + 4, y + 4, {
          width: colWidths[i] - 8,
          height: rowHeight - 6,
          ellipsis: true,
        });
        x += colWidths[i];
      });
      doc.y = y + rowHeight;
    });

    if (!report.rows.length) {
      doc.fillColor(SLATE).fontSize(9).text("No records matched the selected filters.", 36, doc.y + 12);
    }

    // ── Summary
    if (report.summary?.length) {
      if (doc.y + 70 > doc.page.height - 48) {
        doc.addPage();
        doc.y = 40;
      }
      doc.moveDown(1.2);
      doc.fillColor(NAVY).fontSize(10).font("Helvetica-Bold").text("Summary");
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(8.5).fillColor("#334155");
      report.summary.forEach((s) => doc.text(`${s.label}:  ${s.value}`));
    }

    // ── Page numbers
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc
        .fillColor(SLATE)
        .fontSize(7)
        .text(
          `Page ${i - range.start + 1} of ${range.count}   ·   Track Every Project. Every Week. Every Milestone.`,
          36,
          doc.page.height - 30,
          { width: pageWidth, align: "center" }
        );
    }

    doc.end();
  });
}

/**
 * Generate a formal Individual Student Evaluation PDF Sheet.
 */
function generateStudentEvaluationPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 80;

    // Header Band
    doc.rect(0, 0, doc.page.width, 70).fill(NAVY);
    doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text("SAPMS", 40, 18);
    doc.fillColor("#a78bfa").fontSize(9).font("Helvetica").text("Smart Academic Project Management System · ICT Department", 40, 42);
    doc.fillColor("#ffffff").fontSize(12).font("Helvetica-Bold").text("INDIVIDUAL EVALUATION REPORT", 40, 24, { width: pageWidth, align: "right" });
    doc.fillColor("#94a3b8").fontSize(8).font("Helvetica").text(data.isPublished ? "Official Published Result" : "Provisional Draft Assessment", 40, 42, { width: pageWidth, align: "right" });

    doc.y = 90;

    // Student & Project Information Box
    doc.rect(40, doc.y, pageWidth, 90).fillAndStroke("#f8fafc", "#e2e8f0");
    const infoY = doc.y + 10;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY);
    doc.text("Student Name:", 52, infoY);
    doc.font("Helvetica").text(data.student.name, 140, infoY);

    doc.font("Helvetica-Bold").text("Enrollment No:", 340, infoY);
    doc.font("Helvetica").text(data.student.enrollmentNumber || "—", 430, infoY);

    doc.font("Helvetica-Bold").text("Project Title:", 52, infoY + 20);
    doc.font("Helvetica").text(data.project.title, 140, infoY + 20, { width: 380, ellipsis: true });

    doc.font("Helvetica-Bold").text("Subject:", 52, infoY + 40);
    doc.font("Helvetica").text(`${data.project.subject.name} (${data.project.subject.code})`, 140, infoY + 40);

    doc.font("Helvetica-Bold").text("Faculty Guide:", 52, infoY + 60);
    doc.font("Helvetica").text(data.project.faculty?.user?.name || "—", 140, infoY + 60);

    doc.font("Helvetica-Bold").text("Mentor:", 340, infoY + 60);
    doc.font("Helvetica").text(data.project.mentor?.user?.name || "—", 430, infoY + 60);

    doc.y = infoY + 100;

    // Rubric Breakdown Table
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text("Rubric Criteria Assessment", 40, doc.y);
    doc.y += 14;

    const tableY = doc.y;
    doc.rect(40, tableY, pageWidth, 22).fill(PURPLE);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
    doc.text("Criterion / Assessment Parameter", 50, tableY + 6, { width: 260 });
    doc.text("Scope", 320, tableY + 6, { width: 70, align: "center" });
    doc.text("Max Marks", 400, tableY + 6, { width: 60, align: "center" });
    doc.text("Marks Awarded", 470, tableY + 6, { width: 70, align: "right" });

    doc.y = tableY + 22;

    const allCriteria = data.criteria || [];
    allCriteria.forEach((crit, idx) => {
      const rowY = doc.y;
      if (idx % 2 === 1) doc.rect(40, rowY, pageWidth, 20).fill("#f1f5f9");
      doc.font("Helvetica").fontSize(8.5).fillColor("#1e293b");
      doc.text(crit.name, 50, rowY + 5, { width: 260, ellipsis: true });
      doc.text(crit.scope || "TEAM", 320, rowY + 5, { width: 70, align: "center" });
      doc.text(String(crit.maxMarks), 400, rowY + 5, { width: 60, align: "center" });

      const awarded = crit.marksAwarded !== undefined ? crit.marksAwarded : "—";
      doc.font("Helvetica-Bold").text(String(awarded), 470, rowY + 5, { width: 70, align: "right" });
      doc.y = rowY + 20;
    });

    // Individual Viva and Contribution rows
    const vivaY = doc.y;
    doc.rect(40, vivaY, pageWidth, 20).fill("#faf5ff");
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(PURPLE);
    doc.text("Individual Viva & Oral Defense", 50, vivaY + 5, { width: 260 });
    doc.text("INDIVIDUAL", 320, vivaY + 5, { width: 70, align: "center" });
    doc.text("—", 400, vivaY + 5, { width: 60, align: "center" });
    doc.text(String(data.studentEval?.vivaMarks || 0), 470, vivaY + 5, { width: 70, align: "right" });
    doc.y = vivaY + 20;

    const contribY = doc.y;
    doc.rect(40, contribY, pageWidth, 20).fill("#faf5ff");
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(PURPLE);
    doc.text("Individual Contribution & Effort", 50, contribY + 5, { width: 260 });
    doc.text("INDIVIDUAL", 320, contribY + 5, { width: 70, align: "center" });
    doc.text("—", 400, contribY + 5, { width: 60, align: "center" });
    doc.text(String(data.studentEval?.contributionMarks || 0), 470, contribY + 5, { width: 70, align: "right" });
    doc.y = contribY + 26;

    // Summary Score Card
    const scoreBoxY = doc.y;
    doc.rect(40, scoreBoxY, pageWidth, 60).fillAndStroke("#f0fdf4", "#86efac");
    doc.fillColor("#166534").font("Helvetica-Bold").fontSize(10);
    doc.text("FINAL EVALUATION RESULT", 55, scoreBoxY + 12);

    doc.fontSize(22).text(`${data.studentEval?.totalMarks || 0} / ${data.maxTotal || 100}`, 55, scoreBoxY + 28);

    doc.fontSize(11).text(`Percentage: ${data.studentEval?.percentage ? data.studentEval.percentage.toFixed(1) : 0}%`, 300, scoreBoxY + 16);
    doc.fontSize(14).fillColor("#15803d").text(`Grade: ${data.studentEval?.grade || "—"}`, 300, scoreBoxY + 34);

    doc.y = scoreBoxY + 74;

    // Remarks
    if (data.facultyRemarks || data.studentEval?.feedback) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY).text("Feedback & Remarks:", 40, doc.y);
      doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(data.studentEval?.feedback || data.facultyRemarks || "Satisfactory work.", 40, doc.y + 12, { width: pageWidth });
      doc.y += 35;
    }

    // Signatures
    const sigY = Math.max(doc.y + 20, doc.page.height - 110);
    doc.strokeColor("#cbd5e1").lineWidth(1);
    doc.moveTo(40, sigY).lineTo(160, sigY).stroke();
    doc.moveTo(230, sigY).lineTo(360, sigY).stroke();
    doc.moveTo(420, sigY).lineTo(doc.page.width - 40, sigY).stroke();

    doc.font("Helvetica").fontSize(8).fillColor(SLATE);
    doc.text("Student Signature", 40, sigY + 5, { width: 120, align: "center" });
    doc.text("Faculty Guide", 230, sigY + 5, { width: 130, align: "center" });
    doc.text("Head of Department", 420, sigY + 5, { width: 130, align: "center" });

    // Footer
    doc.fontSize(7).text(`Report generated on ${new Date().toLocaleString()} · SAPMS ICT`, 40, doc.page.height - 30, { width: pageWidth, align: "center" });

    doc.end();
  });
}

/**
 * Generate a Project-Level Team Evaluation PDF Report.
 */
function generateProjectEvaluationPdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - 80;

    // Header Band
    doc.rect(0, 0, doc.page.width, 70).fill(NAVY);
    doc.fillColor("#ffffff").fontSize(18).font("Helvetica-Bold").text("SAPMS", 40, 18);
    doc.fillColor("#a78bfa").fontSize(9).font("Helvetica").text("Smart Academic Project Management System · ICT Department", 40, 42);
    doc.fillColor("#ffffff").fontSize(12).font("Helvetica-Bold").text("PROJECT EVALUATION REPORT", 40, 24, { width: pageWidth, align: "right" });
    doc.fillColor("#94a3b8").fontSize(8).font("Helvetica").text(data.isPublished ? "Official Final Evaluation" : "Draft Evaluation", 40, 42, { width: pageWidth, align: "right" });

    doc.y = 85;

    // Project Info
    doc.rect(40, doc.y, pageWidth, 65).fillAndStroke("#f8fafc", "#e2e8f0");
    const pY = doc.y + 10;
    doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY);
    doc.text("Project Title:", 52, pY);
    doc.font("Helvetica").text(data.project.title, 140, pY, { width: 380, ellipsis: true });

    doc.font("Helvetica-Bold").text("Subject:", 52, pY + 20);
    doc.font("Helvetica").text(`${data.project.subject.name} (${data.project.subject.code})`, 140, pY + 20);

    doc.font("Helvetica-Bold").text("Faculty Guide:", 52, pY + 40);
    doc.font("Helvetica").text(data.project.faculty?.user?.name || "—", 140, pY + 40);

    doc.font("Helvetica-Bold").text("Mentor:", 340, pY + 40);
    doc.font("Helvetica").text(data.project.mentor?.user?.name || "—", 430, pY + 40);

    doc.y = pY + 70;

    // Common Team Marks Summary
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text("Common Team Marks", 40, doc.y);
    doc.y += 12;

    const teamTableY = doc.y;
    doc.rect(40, teamTableY, pageWidth, 20).fill(PURPLE);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5);
    doc.text("Team Rubric Criterion", 50, teamTableY + 5, { width: 320 });
    doc.text("Max Marks", 380, teamTableY + 5, { width: 70, align: "center" });
    doc.text("Marks Awarded", 460, teamTableY + 5, { width: 80, align: "right" });

    doc.y = teamTableY + 20;

    const teamCriteria = (data.criteria || []).filter((c) => c.scope === "TEAM" || !c.scope);
    teamCriteria.forEach((crit, idx) => {
      const rowY = doc.y;
      if (idx % 2 === 1) doc.rect(40, rowY, pageWidth, 18).fill("#f1f5f9");
      doc.font("Helvetica").fontSize(8.5).fillColor("#1e293b");
      doc.text(crit.name, 50, rowY + 4, { width: 320, ellipsis: true });
      doc.text(String(crit.maxMarks), 380, rowY + 4, { width: 70, align: "center" });
      const awarded = crit.marksAwarded !== undefined ? crit.marksAwarded : "—";
      doc.font("Helvetica-Bold").text(String(awarded), 460, rowY + 4, { width: 80, align: "right" });
      doc.y = rowY + 18;
    });

    doc.y += 14;

    // Team Members Individual Assessment Table
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text("Team Members & Individual Assessment", 40, doc.y);
    doc.y += 12;

    const memTableY = doc.y;
    doc.rect(40, memTableY, pageWidth, 20).fill(NAVY);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8);
    doc.text("Student Name", 50, memTableY + 5, { width: 140 });
    doc.text("Enrollment", 195, memTableY + 5, { width: 80 });
    doc.text("Viva", 280, memTableY + 5, { width: 45, align: "center" });
    doc.text("Contrib", 330, memTableY + 5, { width: 45, align: "center" });
    doc.text("Total", 380, memTableY + 5, { width: 50, align: "center" });
    doc.text("%", 435, memTableY + 5, { width: 45, align: "center" });
    doc.text("Grade", 485, memTableY + 5, { width: 55, align: "right" });

    doc.y = memTableY + 20;

    const members = data.members || [];
    members.forEach((m, idx) => {
      const rowY = doc.y;
      if (idx % 2 === 1) doc.rect(40, rowY, pageWidth, 20).fill("#f1f5f9");
      doc.font("Helvetica").fontSize(8).fillColor("#1e293b");
      doc.text(m.name, 50, rowY + 5, { width: 140, ellipsis: true });
      doc.text(m.enrollmentNumber || "—", 195, rowY + 5, { width: 80 });
      doc.text(String(m.vivaMarks || 0), 280, rowY + 5, { width: 45, align: "center" });
      doc.text(String(m.contributionMarks || 0), 330, rowY + 5, { width: 45, align: "center" });
      doc.font("Helvetica-Bold").text(String(m.totalMarks || 0), 380, rowY + 5, { width: 50, align: "center" });
      doc.text(`${m.percentage ? m.percentage.toFixed(1) : 0}%`, 435, rowY + 5, { width: 45, align: "center" });
      doc.text(m.grade || "—", 485, rowY + 5, { width: 55, align: "right" });
      doc.y = rowY + 20;
    });

    doc.y += 18;

    // Faculty Remarks
    if (data.evaluation?.facultyRemarks || data.evaluation?.mentorRemarks) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(NAVY).text("Overall Remarks:", 40, doc.y);
      doc.font("Helvetica").fontSize(8.5).fillColor("#334155");
      if (data.evaluation?.facultyRemarks) {
        doc.text(`Faculty: ${data.evaluation.facultyRemarks}`, 40, doc.y + 12, { width: pageWidth });
        doc.y += 24;
      }
      if (data.evaluation?.mentorRemarks) {
        doc.text(`Mentor: ${data.evaluation.mentorRemarks}`, 40, doc.y + 6, { width: pageWidth });
        doc.y += 24;
      }
    }

    // Signatures
    const sigY = Math.max(doc.y + 25, doc.page.height - 100);
    doc.strokeColor("#cbd5e1").lineWidth(1);
    doc.moveTo(60, sigY).lineTo(200, sigY).stroke();
    doc.moveTo(380, sigY).lineTo(doc.page.width - 60, sigY).stroke();

    doc.font("Helvetica").fontSize(8).fillColor(SLATE);
    doc.text("Faculty Guide Signature", 60, sigY + 5, { width: 140, align: "center" });
    doc.text("Head of Department / Examiner", 380, sigY + 5, { width: 140, align: "center" });

    // Footer
    doc.fontSize(7).text(`Project Report generated on ${new Date().toLocaleString()} · SAPMS ICT`, 40, doc.page.height - 30, { width: pageWidth, align: "center" });

    doc.end();
  });
}

/** Turn an arbitrary array of objects into an xlsx buffer (used for exports). */
function rowsToXlsx(rows, sheetName = "Export") {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" });
}

const CONTENT_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  pdf: "application/pdf",
};

module.exports = {
  toXlsx,
  toCsv,
  toPdf,
  rowsToXlsx,
  generateStudentEvaluationPdf,
  generateProjectEvaluationPdf,
  CONTENT_TYPES,
};
