const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { uploadFiles } = require("../services/storage.service");
const { getAccessibleProject } = require("../services/access.service");

/**
 * Upload weekly-progress evidence (screenshots and files) and return their
 * stored URLs. The progress record itself stores URLs, so the client uploads
 * here first and submits the returned links with the form (spec §36/§37).
 */
const uploadEvidence = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  // Confirm the caller belongs to this project before accepting files.
  const project = await getAccessibleProject(req.user, projectId);
  if (!project) throw ApiError.notFound("Project not found or not accessible.");

  if (!req.files?.length) throw ApiError.badRequest("No files uploaded.");

  const stored = await uploadFiles(req.files, "evidence");

  res.status(201).json(
    stored.map((f) => ({
      url: f.fileUrl,
      name: f.fileName,
      size: f.fileSize,
      mimeType: f.mimeType,
      isImage: f.mimeType?.startsWith("image/") ?? false,
    }))
  );
});

module.exports = { uploadEvidence };
