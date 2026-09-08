const XLSX = require("xlsx");

const HEADERS = [
  "Enrollment Number",
  "Student Name",
  "Email",
  "Mobile",
  "GR Number",
  "Semester",
  "Academic Year",
];

const EXAMPLE_ROW = [
  "22CE001",
  "Bhargav Limbani",
  "bhargav.limbani@example.edu",
  "9876543210",
  "45",
  "7",
  "2026-2027",
];

function buildStudentImportTemplate() {
  const worksheetData = [HEADERS, EXAMPLE_ROW];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  worksheet["!cols"] = HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = { buildStudentImportTemplate, HEADERS };
