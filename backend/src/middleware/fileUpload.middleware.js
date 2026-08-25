const multer = require("multer");
const path = require("path");
const { env } = require("../config/env");

/**
 * Extensions accepted for project documents, weekly evidence and avatars.
 * Executables and scripts are deliberately absent — see DANGEROUS_EXTENSIONS.
 */
const ALLOWED_EXTENSIONS = [
  // documents
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".txt", ".md", ".csv",
  // images
  ".png", ".jpg", ".jpeg", ".gif", ".webp",
  // source bundles
  ".zip",
  // mobile / media
  ".apk", ".mp4", ".webm",
];

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "text/", "application/"];

/**
 * Never accepted regardless of the declared MIME type, because a browser or
 * OS may execute them. `.svg` and `.html` are included since both can carry
 * inline script and would run from our own origin when served back.
 */
const DANGEROUS_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".ps1", ".sh", ".jar",
  ".js", ".mjs", ".php", ".py", ".rb", ".pl", ".dll", ".so", ".vbs",
  ".html", ".htm", ".svg", ".xhtml",
];

function extensionOf(filename = "") {
  return path.extname(filename).toLowerCase();
}

function fileFilter(req, file, cb) {
  const ext = extensionOf(file.originalname);

  if (!ext) return cb(new Error("File must have an extension."));
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    return cb(new Error(`Executable and script files (${ext}) are not allowed.`));
  }
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(`File type ${ext} is not supported.`));
  }
  if (!ALLOWED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p))) {
    return cb(new Error(`Unrecognised content type: ${file.mimetype}.`));
  }
  cb(null, true);
}

// Files are held in memory and handed to the storage service, so nothing
// untrusted is ever written to disk under its original name.
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: env.maxFileSizeMb * 1024 * 1024 },
});

/** Wrap a multer handler so its errors become clean 400 responses. */
function withUploadErrors(handler) {
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res
            .status(400)
            .json({ message: `File exceeds the ${env.maxFileSizeMb}MB limit.` });
        }
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({ message: "Too many files uploaded." });
        }
        return res.status(400).json({ message: err.message });
      }
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
}

const uploadSingle = (field = "file") => withUploadErrors(memoryUpload.single(field));
const uploadMany = (field = "files", maxCount = 10) =>
  withUploadErrors(memoryUpload.array(field, maxCount));

module.exports = {
  uploadSingle,
  uploadMany,
  ALLOWED_EXTENSIONS,
  DANGEROUS_EXTENSIONS,
  extensionOf,
};
