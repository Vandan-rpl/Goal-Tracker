const { poolPromise, sql } = require('../config/db');
const { getScopedUserIds, buildUserIdFilter } = require('../utils/goalScope');

/**
 * ============================================================
 * SCHEMA FIXES — see the full list in the chat response for context.
 * In short, every query in this file previously referenced a schema
 * that doesn't exist anywhere else in this codebase:
 *   - `Goals` (no `dbo.` prefix)         -> dbo.Goals
 *   - `Status`                           -> GoalStatus
 *   - `GoalId` (as a Goals column)       -> GoalID
 *   - `UserId` (as a Goals column)       -> UserID
 *   - `req.user.roleId` (numeric 1/2/3)  -> req.user.role (string:
 *     'Employee' | 'HOD' | 'BusinessHead' | 'Admin' — see constants/roles.js
 *     and authController.js's JWT payload, which never included a roleId)
 *   - `Departments.DepartmentId` / join `Goals.DepartmentId` -> Goals has
 *     NO DepartmentId column at all; Departments' real PK is
 *     `DepartmentID`, and it only relates to Goals indirectly via
 *     Users.DepartmentID (see adminController.js, the one place this
 *     table is actually queried correctly).
 *   - `Goals.Quarter`                    -> does not exist. There is no
 *     per-goal "Quarter" column anywhere on dbo.Goals. The only real
 *     "quarter" concept in this schema lives in the QuarterlyUpdates
 *     table (Quarter, ProgressPercentage, GoalId — see
 *     ratingController.js's submitQuarterlyUpdate, which is the live,
 *     working writer of that table).
 *   - Ratings are stored in `dbo.HODRatings.Rating` and linked to goals by
 *     `GoalID`; they are not columns on `dbo.Goals`.
 */

// Get high-level summary statistics for the user dashboard
const getDashboardStats = async (req, res) => {
    const userId = req.user?.UserID || req.user?.userId;
    const role = req.user?.role;

    try {
        const pool = await poolPromise;
        const scopedUserIds = await getScopedUserIds(pool, userId, role);

        const statsRequest = pool.request();
        const statsFilter = buildUserIdFilter(statsRequest, scopedUserIds, 'UserID');

        // "Pending Approval" = GoalStatus = 'Submitted' — the actual status
        // a goal sits in while awaiting the next approval step (see
        // goalController.js / teamController.js's status-change logic).
        // The original query's 'Draft' + 'Pending Approval' statuses don't
        // exist in this schema at all.
        const statsQuery = `
            SELECT
                COUNT(*) AS totalGoals,
                SUM(CASE WHEN GoalStatus = 'Submitted' THEN 1 ELSE 0 END) AS pendingApproval,
                SUM(CASE WHEN GoalStatus = 'Completed' THEN 1 ELSE 0 END) AS completedGoals
            FROM dbo.Goals
            WHERE ${statsFilter}
        `;

        const statsResult = await statsRequest.query(statsQuery);

        const ratingRequest = pool.request();
        const ratingFilter = buildUserIdFilter(ratingRequest, scopedUserIds, 'g.UserID');

        const ratingQuery = `
            SELECT CAST(AVG(CAST(hr.Rating AS FLOAT)) AS DECIMAL(3,2)) AS currentRating
            FROM dbo.HODRatings hr
            INNER JOIN dbo.Goals g ON g.GoalID = hr.GoalID
            WHERE ${ratingFilter} AND hr.Rating IS NOT NULL
        `;

        const ratingResult = await ratingRequest.query(ratingQuery);

        const summary = {
            totalGoals: statsResult.recordset[0].totalGoals || 0,
            pendingApproval: statsResult.recordset[0].pendingApproval || 0,
            completedGoals: statsResult.recordset[0].completedGoals || 0,
            currentRating: ratingResult.recordset[0].currentRating || 0.00
        };

        return res.status(200).json({
            success: true,
            message: 'Dashboard statistics retrieved successfully.',
            data: summary
        });

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching dashboard statistics.',
            errors: error.message
        });
    }
};

// Get department-wise goal distribution for charts
const getDepartmentStats = async (req, res) => {
    try {
        const pool = await poolPromise;

        // Goals has no DepartmentId column — the real relationship is
        // Users.DepartmentID, so we go through Users to get from a goal to
        // its owner's department.
        const query = `
            SELECT
                d.DepartmentName AS department,
                COUNT(g.GoalID) AS totalGoals,
                SUM(CASE WHEN g.GoalStatus = 'Completed' THEN 1 ELSE 0 END) AS completedGoals
            FROM dbo.Departments d
            LEFT JOIN dbo.Users u ON u.DepartmentID = d.DepartmentID
            LEFT JOIN dbo.Goals g ON g.UserID = u.UserID
            GROUP BY d.DepartmentID, d.DepartmentName
            ORDER BY d.DepartmentName
        `;

        const result = await pool.request().query(query);

        return res.status(200).json({
            success: true,
            message: 'Department statistics fetched successfully.',
            data: result.recordset
        });

    } catch (error) {
        console.error('Department Stats Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching department statistics.',
            errors: error.message
        });
    }
};

// Get quarter completion trend metrics
const getQuarterCompletionTrend = async (req, res) => {
    const userId = req.user?.UserID || req.user?.userId;
    const role = req.user?.role;

    try {
        const pool = await poolPromise;
        const scopedUserIds = await getScopedUserIds(pool, userId, role);

        const request = pool.request();
        const filter = buildUserIdFilter(request, scopedUserIds, 'g.UserID');

        // Sourced from QuarterlyUpdates (Quarter, ProgressPercentage, GoalId)
        // since dbo.Goals has no Quarter column at all — see the file-level
        // comment above.
        const query = `
            SELECT
                qu.Quarter AS quarter,
                COUNT(DISTINCT qu.GoalId) AS totalGoalsReporting,
                CAST(AVG(CAST(qu.ProgressPercentage AS FLOAT)) AS DECIMAL(5,2)) AS avgProgress,
                SUM(CASE WHEN g.GoalStatus = 'Completed' THEN 1 ELSE 0 END) AS completedGoals
            FROM QuarterlyUpdates qu
            JOIN dbo.Goals g ON qu.GoalId = g.GoalID
            WHERE ${filter}
            GROUP BY qu.Quarter
            ORDER BY qu.Quarter ASC
        `;

        const result = await request.query(query);

        return res.status(200).json({
            success: true,
            message: 'Quarter completion trends fetched successfully.',
            data: result.recordset
        });

    } catch (error) {
        console.error('Quarter Trend Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching quarter trends.',
            errors: error.message
        });
    }
};

module.exports = {
    getDashboardStats,
    getDepartmentStats,
    getQuarterCompletionTrend
};
