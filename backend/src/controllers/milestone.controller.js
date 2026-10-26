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

    let templates = project.subject.milestoneTemplates;
    if (!templates.length) {
      const duration = project.subject.durationWeeks || 8;

      const defaultTemplatesByDuration = {
        8: [
          { weekNumber: 1, title: "Project Idea & Scope", description: "Problem statement definition, scope clarification, and literature review", weight: 10 },
          { weekNumber: 2, title: "SRS & Requirements Analysis", description: "Detailed software requirements specification and use-case modeling", weight: 10 },
          { weekNumber: 3, title: "System Architecture & Design", description: "High-level architecture, module flow diagrams, and tech stack setup", weight: 15 },
          { weekNumber: 4, title: "Database & Core Prototype", description: "Database schema design, entity relationships, and mid-term prototype", weight: 15 },
          { weekNumber: 5, title: "Module Implementation", description: "Development of primary business logic, authentication, and core features", weight: 15 },
          { weekNumber: 6, title: "Integration & Testing", description: "API integration, end-to-end testing, bug fixing, and optimization", weight: 15 },
          { weekNumber: 7, title: "Documentation & Report", description: "Comprehensive project documentation, user guide, and report draft", weight: 10 },
          { weekNumber: 8, title: "Final Deployment & Viva", description: "Production build deployment, live project demo, and final viva voce", weight: 10 },
        ],
        12: [
          { weekNumber: 1, title: "Project Idea & Literature Survey", description: "Topic selection, literature survey, and feasibility study", weight: 5 },
          { weekNumber: 2, title: "Problem Definition & Objectives", description: "Formal problem statement, goals, and target users", weight: 5 },
          { weekNumber: 3, title: "Software Requirements Specification", description: "Functional and non-functional requirements specification", weight: 10 },
          { weekNumber: 4, title: "System Architecture & High-Level Design", description: "Architectural diagrams, component interaction, and design patterns", weight: 10 },
          { weekNumber: 5, title: "Database Design & Data Modeling", description: "ER diagrams, schema normalization, and data dictionary", weight: 8 },
          { weekNumber: 6, title: "Frontend Architecture & UI Mockups", description: "Responsive layouts, component library, and state management", weight: 12 },
          { weekNumber: 7, title: "Backend Core API Development", description: "REST/GraphQL endpoints, database access layers, and authentication", weight: 12 },
          { weekNumber: 8, title: "System Integration & Middleware", description: "Connecting frontend and backend, file storage, and third-party APIs", weight: 8 },
          { weekNumber: 9, title: "Testing & Quality Assurance", description: "Unit tests, integration tests, performance tuning, and security review", weight: 8 },
          { weekNumber: 10, title: "Bug Fixing & Code Refactoring", description: "Addressing review feedback, edge cases, and code cleanup", weight: 7 },
          { weekNumber: 11, title: "Project Report & Documentation", description: "Final report preparation, plagiarism check, and documentation", weight: 8 },
          { weekNumber: 12, title: "Final Deployment & Defense Viva", description: "Cloud/server deployment, live demonstration, and defense presentation", weight: 7 },
        ],
      };

      const selectedDefaults = defaultTemplatesByDuration[duration] || defaultTemplatesByDuration[8];

      // Auto-populate the subject's milestone templates so it is saved for future projects
      await prisma.milestoneTemplate.createMany({
        data: selectedDefaults.map((t) => ({
          subjectId: project.subjectId,
          weekNumber: t.weekNumber,
          title: t.title,
          description: t.description,
          weight: t.weight,
        })),
      });

      templates = await prisma.milestoneTemplate.findMany({
        where: { subjectId: project.subjectId },
        orderBy: { weekNumber: "asc" },
      });
    }

    // Delete existing milestones
    await prisma.milestone.deleteMany({ where: { projectId } });

    const baseDate = project.startDate ? new Date(project.startDate) : new Date();

    // Create from templates
    await prisma.milestone.createMany({
      data: templates.map((t, idx) => {
        const start = new Date(baseDate);
        start.setDate(start.getDate() + idx * 7);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);

        return {
          projectId,
          facultyId: project.facultyId || null,
          weekNumber: t.weekNumber,
          title: t.title,
          description: t.description,
          weight: t.weight,
          isRequired: t.isRequired ?? true,
          startDate: start,
          endDate: end,
        };
      }),
    });

    const milestones = await prisma.milestone.findMany({ where: { projectId }, orderBy: { weekNumber: "asc" } });
    res.json(milestones);
  } catch (err) { next(err); }
}

module.exports = { getMilestones, createMilestone, updateMilestone, deleteMilestone, createFromTemplate };
