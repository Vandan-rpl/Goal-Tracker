const { sql } = require('../config/db');

/**
 * Shared "who can this user see goals for" logic, used by both
 * analyticsController.js and dashboardService.js so the two don't drift
 * into two different definitions of "my team" like other parts of this
 * codebase have (see teamController.js vs ratingController.js hierarchy
 * checks, which already duplicate this same HODID/ReportingManagerID/
 * BusinessHeadID logic three separate times).
 *
 * Returns:
 *   - an array of UserIDs the requester may see goals for, OR
 *   - `null` as a sentinel meaning "no filter — see everything" (Admin).
 *
 * Role names match Users.Role values exactly (see constants/roles.js):
 * 'Employee', 'HOD', 'BusinessHead', 'Admin'.
 */
// GoalScope.js
const getScopedUserIds = async (pool, userId, role, { forApproval = false } = {}) => {
    const normalizedRole = (role || '').trim().toUpperCase();

    if (normalizedRole === 'EMPLOYEE') {
        return [userId];
    }

    if (normalizedRole === 'HOD') {
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT UserID FROM dbo.Users
                WHERE ReportingManagerID = @UserID OR HODID = @UserID OR UserID = @UserID
            `);
        return result.recordset.map((r) => r.UserID);
    }

    if (normalizedRole === 'BUSINESSHEAD') {
        if (!forApproval) {
            // Viewing: business head sees everyone, no scoping.
            return null;
        }
        // Approving: restrict to direct hierarchy only.
        const result = await pool.request()
            .input('UserID', sql.Int, userId)
            .query(`
                SELECT UserID FROM dbo.Users
                WHERE (BusinessHeadID = @UserID OR UserID = @UserID)
                  AND (
                      (ReportingManagerID IS NULL AND HODID IS NULL)
                      OR ReportingManagerID = @UserID
                      OR HODID = @UserID
                  )
            `);
        return result.recordset.map((r) => r.UserID);
    }

    // Admin (or any unrecognized role) — company-wide, no scoping.
    return null;
};

/**
 * Binds a parameterized `columnExpr IN (...)` (or 1=1 / 1=0) filter onto
 * `request` and returns the SQL fragment to splice into a query's WHERE
 * clause. Always parameterized — never string-concatenates raw IDs.
 */
const buildUserIdFilter = (request, userIds, columnExpr = 'UserID') => {
    if (userIds === null) {
        return '1=1';
    }
    if (userIds.length === 0) {
        return '1=0';
    }

    const paramNames = userIds.map((id, i) => {
        request.input(`ScopeUID${i}`, sql.Int, id);
        return `@ScopeUID${i}`;
    });

    return `${columnExpr} IN (${paramNames.join(', ')})`;
};

module.exports = {
    getScopedUserIds,
    buildUserIdFilter
};
