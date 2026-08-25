const prisma = require("../config/prisma");

/**
 * Recommend the best available mentor for a given domain.
 * Strategy: find mentors in the domain, sort by current project count (ascending),
 * return the one with the least workload.
 */
async function recommendMentor(domainId) {
  const mentorDomains = await prisma.mentorDomain.findMany({
    where: { domainId },
    include: {
      mentor: {
        include: {
          user: true,
          projects: {
            where: {
              status: {
                notIn: ["COMPLETED", "REJECTED", "ARCHIVED"],
              },
            },
          },
        },
      },
    },
  });

  if (!mentorDomains.length) return null;

  // Sort by project count ascending
  const sorted = mentorDomains
    .map((md) => ({
      mentor: md.mentor,
      activeProjects: md.mentor.projects.length,
    }))
    .sort((a, b) => a.activeProjects - b.activeProjects);

  return sorted[0]?.mentor || null;
}

/**
 * Get all available mentors for a domain with workload info
 */
async function getMentorsForDomain(domainId) {
  const mentorDomains = await prisma.mentorDomain.findMany({
    where: { domainId },
    include: {
      mentor: {
        include: {
          user: true,
          projects: {
            where: {
              status: {
                notIn: ["COMPLETED", "REJECTED", "ARCHIVED"],
              },
            },
          },
        },
      },
    },
  });

  return mentorDomains.map((md) => ({
    ...md.mentor,
    activeProjects: md.mentor.projects.length,
  }));
}

module.exports = { recommendMentor, getMentorsForDomain };
