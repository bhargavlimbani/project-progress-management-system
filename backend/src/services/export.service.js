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

module.exports = { toXlsx, toCsv, toPdf, rowsToXlsx, CONTENT_TYPES };
