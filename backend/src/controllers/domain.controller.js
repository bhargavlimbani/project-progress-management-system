const prisma = require("../config/prisma");

async function getDomains(req, res, next) {
  try {
    const domains = await prisma.domain.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { mentors: true, projects: true } },
        mentors: { include: { mentor: { include: { user: true } } } },
      },
    });
    res.json(domains);
  } catch (err) { next(err); }
}

async function createDomain(req, res, next) {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ message: "Domain name is required." });
    const domain = await prisma.domain.create({ data: { name, description } });
    res.status(201).json(domain);
  } catch (err) { next(err); }
}

async function updateDomain(req, res, next) {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const domain = await prisma.domain.update({
      where: { id },
      data: { ...(name && { name }), ...(description !== undefined && { description }), ...(isActive !== undefined && { isActive }) },
    });
    res.json(domain);
  } catch (err) { next(err); }
}

async function deleteDomain(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.domain.delete({ where: { id } });
    res.json({ message: "Domain deleted." });
  } catch (err) { next(err); }
}

module.exports = { getDomains, createDomain, updateDomain, deleteDomain };
