const multer = require("multer");

const ALLOWED_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ALLOWED_EXTENSIONS = [".xlsx", ".csv"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage(); // never write untrusted files to disk

function fileFilter(req, file, cb) {
  const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error("Only .xlsx and .csv files are supported."));
  }
  /**
   * The extension check above is the meaningful gate. Browsers and OSes are
   * inconsistent about spreadsheet MIME types — a .xlsx can arrive as
   * application/octet-stream depending on the client — so rejecting on MIME
   * alone produced false "Unrecognized file type" failures on valid files.
   */
  const TOLERATED = [...ALLOWED_MIME_TYPES, "application/octet-stream", "text/plain"];
  if (!TOLERATED.includes(file.mimetype)) {
    return cb(new Error(`Unrecognized file type: ${file.mimetype}. Upload a .xlsx or .csv file.`));
  }
  cb(null, true);
}

const uploadStudentFile = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
}).single("file");

function handleUpload(req, res, next) {
  uploadStudentFile(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File exceeds the 5MB limit." });
      }
      return res.status(400).json({ message: err.message });
    }
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "No file uploaded." });
    next();
  });
}

module.exports = { handleUpload, MAX_FILE_SIZE_BYTES };
