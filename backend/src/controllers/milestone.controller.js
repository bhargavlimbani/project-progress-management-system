const prisma = require("../config/prisma");

async function getMilestones(req, res, next) {
  try {
    const { projectId } = req.params;
    const milestones = await prisma.milestone.findMany({
      where: { projectId },
      orderBy: { weekNumber: "asc" },
      include: { faculty: { include: { user: true } } },
    });
    res.json(milestones);
  } catch (err) { next(err); }
}

async function createMilestone(req, res, next) {
  try {
    const { projectId } = req.params;
    const { weekNumber, title, description, weight, requiredEvidence, startDate, endDate, isRequired } = req.body;
    const { id: userId } = req.user;

    if (!weekNumber || !title) return res.status(400).json({ message: "Week number and title required." });

    const faculty = await prisma.faculty.findUnique({ where: { userId } });

    const milestone = await prisma.milestone.create({
      data: {
        projectId,
        facultyId: faculty?.id,
        weekNumber: parseInt(weekNumber),
        title, description,
        weight: parseFloat(weight) || 0,
        requiredEvidence, isRequired: isRequired !== false,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    });
    res.status(201).json(milestone);
  } catch (err) { next(err); }
}

async function updateMilestone(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, weight, requiredEvidence, startDate, endDate, status, isRequired } = req.body;
    const milestone = await prisma.milestone.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(weight !== undefined && { weight: parseFloat(weight) }),
        ...(requiredEvidence !== undefined && { requiredEvidence }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(status && { status, completedAt: status === "APPROVED" ? new Date() : null }),
        ...(isRequired !== undefined && { isRequired }),
      },
    });
    res.json(milestone);
  } catch (err) { next(err); }
}

async function deleteMilestone(req, res, next) {
  try {
    await prisma.milestone.delete({ where: { id: req.params.id } });
    res.json({ message: "Milestone deleted." });
  } catch (err) { next(err); }
}

// Auto-create milestones from subject template
async function createFromTemplate(req, res, next) {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { subject: { include: { milestoneTemplates: { orderBy: { weekNumber: "asc" } } } } },
    });
    if (!project) return res.status(404).json({ message: "Project not found." });

    const templates = project.subject.milestoneTemplates;
    if (!templates.length) return res.status(400).json({ message: "No milestone templates defined for this subject." });

    // Delete existing milestones
    await prisma.milestone.deleteMany({ where: { projectId } });

    // Create from templates
    await prisma.milestone.createMany({
      data: templates.map((t) => ({
        projectId,
        weekNumber: t.weekNumber,
        title: t.title,
        description: t.description,
        weight: t.weight,
        isRequired: t.isRequired,
      })),
    });

    const milestones = await prisma.milestone.findMany({ where: { projectId }, orderBy: { weekNumber: "asc" } });
    res.json(milestones);
  } catch (err) { next(err); }
}

module.exports = { getMilestones, createMilestone, updateMilestone, deleteMilestone, createFromTemplate };
