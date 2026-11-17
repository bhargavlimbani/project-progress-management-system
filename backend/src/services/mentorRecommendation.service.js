const prisma = require("../config/prisma");
const { SAFE_USER_SELECT } = require("../utils/safeFields");

/**
 * Recommend the best available mentor for a given domain or overall.
 */
async function recommendMentor(domainId) {
  const { recommended } = await getAllMentorsWithWorkload(domainId);
  return recommended;
}

/**
 * Get mentors for domain
 */
async function getMentorsForDomain(domainId) {
  const { allMentors } = await getAllMentorsWithWorkload(domainId);
  if (!domainId) return allMentors;
  return allMentors.filter((m) => m.matchesDomain);
}

/**
 * Get all active mentors in the system with their active project load,
 * marked whether they match the project's domain, and recommended mentor selected.
 */
async function getAllMentorsWithWorkload(domainId = null) {
  const mentors = await prisma.mentor.findMany({
    where: {
      user: {
        isActive: true,
      },
    },
    include: {
      user: { select: SAFE_USER_SELECT },
      domains: {
        include: {
          domain: true,
        },
      },
      projects: {
        where: {
          status: {
            notIn: ["COMPLETED", "REJECTED", "ARCHIVED"],
          },
        },
        select: { id: true, title: true, status: true },
      },
    },
  });

  const formatted = mentors.map((m) => {
    const activeProjects = m.projects?.length || 0;
    const matchesDomain = domainId
      ? m.domains.some((d) => d.domainId === domainId || d.domain?.id === domainId)
      : false;

    return {
      id: m.id,
      mentorId: m.mentorId,
      mobile: m.mobile,
      expertise: m.expertise,
      user: m.user,
      domains: m.domains.map((d) => d.domain),
      activeProjects,
      matchesDomain,
    };
  });

  // Sort: domain specialists first (sorted by active workload asc),
  // followed by other mentors (sorted by active workload asc)
  formatted.sort((a, b) => {
    if (a.matchesDomain && !b.matchesDomain) return -1;
    if (!a.matchesDomain && b.matchesDomain) return 1;
    return a.activeProjects - b.activeProjects;
  });

  const domainMatches = formatted.filter((m) => m.matchesDomain);
  const recommended = domainMatches.length > 0 ? domainMatches[0] : formatted[0] || null;

  return {
    recommended,
    allMentors: formatted,
    domainMatchesCount: domainMatches.length,
  };
}

module.exports = {
  recommendMentor,
  getMentorsForDomain,
  getAllMentorsWithWorkload,
};

