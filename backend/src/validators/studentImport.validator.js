const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_REGEX = /^(\+?\d{1,3}[-\s]?)?\d{10}$/;
const ACADEMIC_YEAR_REGEX = /^\d{4}-\d{4}$/;

const REQUIRED_FIELDS = ["enrollmentNumber", "name", "email", "mobile"];

function validateRowShape(row) {
  for (const field of REQUIRED_FIELDS) {
    if (!row[field] || String(row[field]).trim() === "") {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }
  if (!EMAIL_REGEX.test(row.email.trim())) {
    return { valid: false, reason: `Invalid email format: "${row.email}"` };
  }
  if (!MOBILE_REGEX.test(String(row.mobile).trim())) {
    return { valid: false, reason: `Invalid mobile number: "${row.mobile}"` };
  }
  if (row.academicYear && !ACADEMIC_YEAR_REGEX.test(row.academicYear.trim())) {
    return { valid: false, reason: `Invalid academic year format: "${row.academicYear}" (expected e.g. 2026-2027)` };
  }
  if (row.semester !== undefined && row.semester !== "") {
    const semesterNum = Number(row.semester);
    if (!Number.isInteger(semesterNum) || semesterNum < 1 || semesterNum > 8) {
      return { valid: false, reason: `Invalid semester: "${row.semester}" (expected 1-8)` };
    }
  }
  return { valid: true, reason: null };
}

module.exports = { validateRowShape, EMAIL_REGEX, MOBILE_REGEX, ACADEMIC_YEAR_REGEX };
