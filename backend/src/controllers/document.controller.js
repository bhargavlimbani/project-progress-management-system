const prisma = require("../config/prisma");
const { notifyStudent, notifyUser } = require("../services/notification.service");
const { logActivity } = require("../services/activityLog.service");
const { uploadFile } = require("../services/storage.service");

async function getDocuments(req, res, next) {
  try {
    const { projectId } = req.params;
    const docs = await prisma.document.findMany({
      where: { projectId },
      include: {
        student: true,
        versions: {
          orderBy: { version: "desc" },
          include: {
            faculty: { include: { user: true } },
            mentor: { include: { user: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(docs);
  } catch (err) { next(err); }
}

async function uploadDocument(req, res, next) {
  try {
    const { projectId } = req.params;
    const { type } = req.body;
    const { id: studentId } = req.user;
    const file = req.file;

    if (!type) return res.status(400).json({ message: "Document type is required." });
    if (!file) return res.status(400).json({ message: "File is required." });

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) return res.status(404).json({ message: "Student not found." });

    // Check if document of this type already exists
    const existingDoc = await prisma.document.findFirst({
      where: { projectId, type },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });

    // Stored under a generated key — the client's filename is kept for display
    // only, never used as a path.
    const stored = await uploadFile(file, "documents");
    const nextVersion = existingDoc ? (existingDoc.versions[0]?.version || 0) + 1 : 1;

    await prisma.$transaction(async (tx) => {
      let doc = existingDoc;
      if (!doc) {
        doc = await tx.document.create({ data: { projectId, studentId: student.id, type } });
      }
      await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          version: nextVersion,
          fileUrl: stored.fileUrl,
          fileName: stored.fileName,
          fileSize: stored.fileSize,
          mimeType: stored.mimeType,
          status: "PENDING",
        },
      });
    });

    // Notify faculty and mentor for review
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { faculty: { include: { user: true } }, mentor: { include: { user: true } } },
    });

    if (project?.faculty) {
      await notifyUser({
        userId: project.faculty.userId,
        type: "GENERAL",
        title: "Document Uploaded",
        body: `New ${type} document (v${nextVersion}) uploaded for review in "${project.title}".`,
        link: `/faculty/projects/${projectId}/documents`,
      });
    }
    if (project?.mentor) {
      await notifyUser({
        userId: project.mentor.userId,
        type: "GENERAL",
        title: "Document Uploaded",
        body: `New ${type} document (v${nextVersion}) uploaded for review in "${project.title}".`,
        link: `/mentor/projects/${projectId}/documents`,
      });
    }

    await logActivity({ studentId: student.id, action: "UPLOAD_DOCUMENT", entityType: "Document", entityId: projectId, projectId });
    res.status(201).json({ message: "Document uploaded successfully.", version: nextVersion });
  } catch (err) { next(err); }
}

async function reviewDocumentVersion(req, res, next) {
  try {
    const { versionId } = req.params;
    const { status, comments } = req.body;
    const { id: userId, role } = req.user;

    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: { document: { include: { project: { include: { members: true } } } } },
    });
    if (!version) return res.status(404).json({ message: "Document version not found." });

    let data = { status, comments, reviewedAt: new Date() };
    if (role === "FACULTY") {
      const faculty = await prisma.faculty.findUnique({ where: { userId } });
      data.facultyId = faculty?.id;
    } else if (role === "MENTOR") {
      const mentor = await prisma.mentor.findUnique({ where: { userId } });
      data.mentorId = mentor?.id;
    }

    await prisma.documentVersion.update({ where: { id: versionId }, data });

    // Notify students
    const notifType = status === "APPROVED" ? "DOCUMENT_APPROVED" : status === "REJECTED" ? "DOCUMENT_REJECTED" : "DOCUMENT_CHANGES_REQUIRED";
    for (const m of version.document.project.members) {
      await notifyStudent({
        studentId: m.studentId,
        type: notifType,
        title: `Document ${status.replace("_", " ")}`,
        body: comments || `Your document has been ${status.toLowerCase().replace("_", " ")}.`,
        link: `/student/projects/${version.document.projectId}/documents`,
      });
    }

    res.json({ message: "Review submitted." });
  } catch (err) { next(err); }
}

module.exports = { getDocuments, uploadDocument, reviewDocumentVersion };
