const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const { logActivity } = require("../services/activityLog.service");

async function getMentors(req, res, next) {
  try {
    const mentors = await prisma.mentor.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, isActive: true, profilePhoto: true } },
        domains: { include: { domain: true } },
        _count: { select: { projects: true } },
      },
      orderBy: { user: { name: "asc" } },
    });
    res.json(mentors);
  } catch (err) { next(err); }
}

async function getMentorById(req, res, next) {
  try {
    const mentor = await prisma.mentor.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
        domains: { include: { domain: true } },
        projects: { include: { subject: true, members: { include: { student: true } } }, take: 20 },
      },
    });
    if (!mentor) return res.status(404).json({ message: "Mentor not found." });
    res.json(mentor);
  } catch (err) { next(err); }
}

async function createMentor(req, res, next) {
  try {
    const { name, email, mentorId, mobile, expertise, password, domainIds } = req.body;
    if (!name || !email || !mentorId || !password) {
      return res.status(400).json({ message: "Name, email, mentorId, and password are required." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ message: "Email already in use." });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, passwordHash, role: "MENTOR" } });
      const mentor = await tx.mentor.create({ data: { userId: user.id, mentorId, mobile, expertise } });
      if (domainIds?.length) {
        await tx.mentorDomain.createMany({
          data: domainIds.map((did) => ({ mentorId: mentor.id, domainId: did })),
          skipDuplicates: true,
        });
      }
      return mentor;
    });

    await logActivity({ userId: req.user.id, action: "CREATE_MENTOR", entityType: "Mentor", entityId: result.id });
    res.status(201).json(result);
  } catch (err) { next(err); }
}

async function updateMentor(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, mobile, expertise, isActive, domainIds } = req.body;

    const mentor = await prisma.mentor.findUnique({ where: { id } });
    if (!mentor) return res.status(404).json({ message: "Mentor not found." });

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: mentor.userId },
        data: { ...(name && { name }), ...(email && { email }), ...(isActive !== undefined && { isActive }) },
      });
      await tx.mentor.update({
        where: { id },
        data: { ...(mobile !== undefined && { mobile }), ...(expertise !== undefined && { expertise }) },
      });
      if (domainIds !== undefined) {
        await tx.mentorDomain.deleteMany({ where: { mentorId: id } });
        if (domainIds.length) {
          await tx.mentorDomain.createMany({
            data: domainIds.map((did) => ({ mentorId: id, domainId: did })),
            skipDuplicates: true,
          });
        }
      }
    });

    const updated = await prisma.mentor.findUnique({
      where: { id },
      include: { user: true, domains: { include: { domain: true } } },
    });
    res.json(updated);
  } catch (err) { next(err); }
}

async function deleteMentor(req, res, next) {
  try {
    const { id } = req.params;
    const mentor = await prisma.mentor.findUnique({ where: { id } });
    if (!mentor) return res.status(404).json({ message: "Mentor not found." });
    await prisma.user.delete({ where: { id: mentor.userId } });
    res.json({ message: "Mentor deleted." });
  } catch (err) { next(err); }
}

async function resetMentorPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    const mentor = await prisma.mentor.findUnique({ where: { id } });
    if (!mentor) return res.status(404).json({ message: "Mentor not found." });
    const hash = await bcrypt.hash(password, 12);
    await prisma.user.update({ where: { id: mentor.userId }, data: { passwordHash: hash } });
    res.json({ message: "Password reset successfully." });
  } catch (err) { next(err); }
}

module.exports = { getMentors, getMentorById, createMentor, updateMentor, deleteMentor, resetMentorPassword };
