const { poolPromise, sql } = require('../config/db');
const { getScopedUserIds, buildUserIdFilter } = require('../utils/goalScope');

/**
 * ============================================================
 * This file was 0 bytes — completely empty. dashboardController.js
 * required it and called six functions on it, so every single dashboard
 * route (summary, statistics, goal-progress, pending-approvals,
 * recent-activities, charts) crashed on every request with
 * "dashboardService.getX is not a function".
 *
 * dashboardController.js ALSO assumed a `req.user.companyId` /
 * `req.user.employeeId` / `req.user.roleId` shape that doesn't exist
 * anywhere in the real JWT payload — authController.js only ever signs
 * { userId, username, role, isPasswordChanged }. There is no multi-tenant
 * "company" concept anywhere else in this schema either (no CompanyID
 * column on Users, Goals, or anywhere). I updated dashboardController.js
 * to pass { userId, role } instead, matching every function below.
 *
 * Scoping ("Employee sees own, HOD sees team, CFO/Admin sees
 * company-wide") is implemented via the same shared helper used by
 * analyticsController.js (src/utils/goalScope.js) so the two don't
 * define "my team" two different ways.
 * ============================================================
 */

// Get Dashboard Summary — total goals, pending approvals, completed goals,
// average rating, and quarterly completion trend, scoped by role.
const getDashboardSummary = async ({ userId, role }) => {
    const pool = await poolPromise;
    const scopedUserIds = await getScopedUserIds(pool, userId, role);

    const statsRequest = pool.request();
    const statsFilter = buildUserIdFilter(statsRequest, scopedUserIds, 'UserID');

    const statsResult = await statsRequest.query(`
        SELECT
            COUNT(*) AS TotalGoals,
            SUM(CASE WHEN GoalStatus = 'Submitted' THEN 1 ELSE 0 END) AS PendingApproval,
            SUM(CASE WHEN GoalStatus = 'Completed' THEN 1 ELSE 0 END) AS CompletedGoals
        FROM dbo.Goals
        WHERE ${statsFilter}
    `);

    const ratingRequest = pool.request();
    const ratingFilter = buildUserIdFilter(ratingRequest, scopedUserIds, 'g.UserID');

    const ratingResult = await ratingRequest.query(`
        SELECT CAST(AVG(CAST(hr.Rating AS FLOAT)) AS DECIMAL(3,2)) AS AverageRating
        FROM dbo.HODRatings hr
        INNER JOIN dbo.Goals g ON g.GoalID = hr.GoalID
        WHERE ${ratingFilter} AND hr.Rating IS NOT NULL
    `);

    const trendRequest = pool.request();
    const trendFilter = buildUserIdFilter(trendRequest, scopedUserIds, 'g.UserID');

    // Sourced from QuarterlyUpdates — dbo.Goals has no Quarter column (see
    // the flag in analyticsController.js for the same finding).
    const trendResult = await trendRequest.query(`
        SELECT
            qu.Quarter AS quarter,
            COUNT(DISTINCT qu.GoalId) AS goalsReporting,
            CAST(AVG(CAST(qu.ProgressPercentage AS FLOAT)) AS DECIMAL(5,2)) AS avgProgress
        FROM QuarterlyUpdates qu
        JOIN dbo.Goals g ON qu.GoalId = g.GoalID
        WHERE ${trendFilter}
        GROUP BY qu.Quarter
        ORDER BY qu.Quarter ASC
    `);

    const stats = statsResult.recordset[0] || {};

    return {
        totalGoals: stats.TotalGoals || 0,
        pendingApproval: stats.PendingApproval || 0,
        completedGoals: stats.CompletedGoals || 0,
        averageRating: ratingResult.recordset[0]?.AverageRating || 0,
        quarterlyCompletionTrend: trendResult.recordset
    };
};

// Recent goal-history activity, scoped by role.
const getRecentActivities = async ({ userId, role }, top = 10) => {
    const pool = await poolPromise;
    const scopedUserIds = await getScopedUserIds(pool, userId, role);

    const request = pool.request();
    request.input('Top', sql.Int, top);
    const filter = buildUserIdFilter(request, scopedUserIds, 'g.UserID');

    const result = await request.query(`
        SELECT TOP (@Top)
            h.GoalID,
            g.GoalTitle,
            h.Action,
            h.OldValue,
            h.NewValue,
            h.Remarks,
            h.PerformedBy,
            u.FirstName AS PerformedByFirstName,
            u.LastName AS PerformedByLastName,
            h.PerformedDate
        FROM dbo.GoalHistory h
        JOIN dbo.Goals g ON h.GoalID = g.GoalID
        LEFT JOIN dbo.Users u ON h.PerformedBy = u.UserID
        WHERE ${filter}
        ORDER BY h.PerformedDate DESC
    `);

    return result.recordset;
};

// Goals awaiting approval, scoped by role. For an Employee this is
// informational (their own goals sitting in 'Submitted'); for HOD/
// BusinessHead/Admin it's the actionable list.
const getPendingApprovals = async ({ userId, role }) => {
    const pool = await poolPromise;
    const scopedUserIds = await getScopedUserIds(pool, userId, role);

    const request = pool.request();
    const filter = buildUserIdFilter(request, scopedUserIds, 'g.UserID');

    const result = await request.query(`
        SELECT
            g.GoalID, g.GoalTitle, g.GoalStatus, g.Weightage, g.Timeline,
            g.SubmittedDate, u.FirstName, u.LastName, u.UserID AS OwnerID
        FROM dbo.Goals g
        JOIN dbo.Users u ON g.UserID = u.UserID
        WHERE ${filter} AND g.GoalStatus = 'Submitted'
        ORDER BY g.SubmittedDate ASC
    `);

    return result.recordset;
};

// Goal status breakdown (counts per GoalStatus), scoped by role — good for
// a pie/bar chart of where goals sit in the pipeline.
const getGoalProgress = async ({ userId, role }) => {
    const pool = await poolPromise;
    const scopedUserIds = await getScopedUserIds(pool, userId, role);

    const request = pool.request();
    const filter = buildUserIdFilter(request, scopedUserIds, 'UserID');

    const result = await request.query(`
        SELECT GoalStatus, COUNT(*) AS TotalGoals
        FROM dbo.Goals
        WHERE ${filter}
        GROUP BY GoalStatus
        ORDER BY GoalStatus
    `);

    return result.recordset;
};

// Alias — dashboardController.js's getStatistics route wants the same
// shape as getDashboardSummary. Kept as a separate exported name (rather
// than collapsing the routes) since that's what the controller already
// expects, but there's no reason for these to compute anything different.
const getStatistics = async ({ userId, role }) => {
    return getDashboardSummary({ userId, role });
};

// Combined payload for a generic "charts" endpoint — goal status
// breakdown + quarterly trend in one call, scoped by role.
const getCharts = async ({ userId, role }) => {
    const [goalProgress, summary] = await Promise.all([
        getGoalProgress({ userId, role }),
        getDashboardSummary({ userId, role })
    ]);

    return {
        goalStatusBreakdown: goalProgress,
        quarterlyCompletionTrend: summary.quarterlyCompletionTrend
    };
};

module.exports = {
    getDashboardSummary,
    getRecentActivities,
    getPendingApprovals,
    getGoalProgress,
    getStatistics,
    getCharts
};
