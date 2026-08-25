const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;
const { env } = require("../config/env");
const { extensionOf } = require("../middleware/fileUpload.middleware");

if (env.cloudinary.enabled) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
}

const LOCAL_UPLOAD_DIR = path.join(__dirname, "../../uploads");

/**
 * Generate a storage key that never reuses the client-supplied filename, so
 * a hostile name cannot escape the upload directory or shadow another file.
 * The original name is kept separately in the database for display.
 */
function safeKey(originalName) {
  return `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extensionOf(originalName)}`;
}

/**
 * Persist an in-memory upload and return the metadata we store in Postgres.
 * Uses Cloudinary when configured, otherwise falls back to local disk so the
 * app stays fully runnable without third-party credentials.
 *
 * @param {{buffer: Buffer, originalname: string, mimetype: string, size: number}} file
 * @param {string} folder logical folder, e.g. "documents" or "evidence"
 */
async function uploadFile(file, folder = "misc") {
  if (!file?.buffer) throw new Error("No file buffer to upload.");

  const common = {
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
  };

  if (env.cloudinary.enabled) {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: `sapms/${folder}`,
            resource_type: "auto",
            public_id: path.parse(safeKey(file.originalname)).name,
          },
          (err, res) => (err ? reject(err) : resolve(res))
        )
        .end(file.buffer);
    });

    return { ...common, fileUrl: result.secure_url, storageKey: result.public_id, provider: "cloudinary" };
  }

  // Local disk fallback
  const dir = path.join(LOCAL_UPLOAD_DIR, folder);
  await fs.mkdir(dir, { recursive: true });

  const key = safeKey(file.originalname);
  await fs.writeFile(path.join(dir, key), file.buffer);

  return {
    ...common,
    fileUrl: `/uploads/${folder}/${key}`,
    storageKey: `${folder}/${key}`,
    provider: "local",
  };
}

/** Upload several files, preserving order. */
async function uploadFiles(files = [], folder = "misc") {
  return Promise.all(files.map((f) => uploadFile(f, folder)));
}

/**
 * Best-effort delete. Storage cleanup must never break the request that
 * triggered it, so failures are logged rather than thrown.
 */
async function deleteFile({ storageKey, provider }) {
  try {
    if (provider === "cloudinary") {
      await cloudinary.uploader.destroy(storageKey, { resource_type: "auto" });
    } else if (storageKey) {
      await fs.unlink(path.join(LOCAL_UPLOAD_DIR, storageKey));
    }
  } catch (err) {
    console.error("Storage delete failed:", err.message);
  }
}

module.exports = { uploadFile, uploadFiles, deleteFile, LOCAL_UPLOAD_DIR };
