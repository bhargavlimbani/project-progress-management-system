const MAX_PAGE_SIZE = 100;

/**
 * Parse ?page= and ?limit= into Prisma skip/take, clamped to sane bounds.
 */
function parsePagination(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/** Shape a paginated payload consistently across every list endpoint. */
function paginated(data, total, { page, limit }) {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
}

/**
 * Build a Prisma `orderBy` from ?sortBy= / ?sortOrder=, restricted to an
 * allow-list so a client can't sort by an arbitrary column.
 */
function parseSort(query = {}, allowedFields = [], fallback = { createdAt: "desc" }) {
  const { sortBy, sortOrder } = query;
  if (!sortBy || !allowedFields.includes(sortBy)) return fallback;
  return { [sortBy]: sortOrder === "asc" ? "asc" : "desc" };
}

module.exports = { parsePagination, paginated, parseSort, MAX_PAGE_SIZE };
