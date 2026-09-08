/**
 * Hidden (owner / break-glass) accounts.
 *
 * A user with `isHidden = true` behaves exactly like any other account when
 * signing in and using the system, but must never appear in the interface:
 * not in the staff directory, not in search, not in an activity feed, not in
 * a report. These filters are the single place that rule is expressed, so a
 * new listing endpoint only has to compose one of them.
 */

/** Prisma `where` fragment for User queries. */
const VISIBLE_USER = { isHidden: false };

/** Prisma `where` fragment for rows that join to a User (ActivityLog, etc.). */
const VISIBLE_USER_RELATION = {
  OR: [
    { user: { isHidden: false } },
    { user: null }, // system-generated rows have no actor
  ],
};

/**
 * Drop rows whose joined user is hidden. Use after a query that could not
 * express the filter itself (e.g. a merged feed built from two tables).
 */
function withoutHiddenActors(rows = [], pick = (row) => row.user) {
  return rows.filter((row) => {
    const user = pick(row);
    return !user || user.isHidden !== true;
  });
}

module.exports = { VISIBLE_USER, VISIBLE_USER_RELATION, withoutHiddenActors };
