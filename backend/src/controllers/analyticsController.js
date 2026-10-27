const { poolPromise, sql } = require('../config/db');
const { getScopedUserIds, buildUserIdFilter } = require('../utils/goalScope');
const { getFiscalQuarter, getFiscalQuarterBoundsFromLabel } = require('../utils/fiscalQuarter');
const {
    parseFiscalYear,
    getYearlyPerformance
} = require('./evaluationController');

// Final-approved goals that are still being worked on (same set as the
// "In progress" column of getTeamStats).
const IN_PROGRESS_STATUSES = ['Running', 'Approved', 'Postpone', 'Completion Submitted'];

const bindStatusList = (request, prefix, statuses) => statuses
    .map((status, i) => {
        request.input(`${prefix}${i}`, sql.VarChar(50), status);
        return `@${prefix}${i}`;
    })
    .join(', ');

const getAnalyticsUserIds = async (pool, userId, role) => {
    const scopedUserIds = await getScopedUserIds(pool, userId, role);
    const normalizedRole = (role || '').trim().toUpperCase();

    if (scopedUserIds === null || !['MANAGER', 'HOD'].includes(normalizedRole)) {
        return scopedUserIds;
    }

    return scopedUserIds.filter((scopedUserId) => Number(scopedUserId) !== Number(userId));
};

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
    const role = req.user?.role || req.user?.Role;

    try {
        const pool = await poolPromise;
        const scopedUserIds = await getAnalyticsUserIds(pool, userId, role);

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
    const userId = req.user?.UserID || req.user?.userId;
    const role = req.user?.role || req.user?.Role;

    try {
        const pool = await poolPromise;
        const scopedUserIds = await getAnalyticsUserIds(pool, userId, role);
        const request = pool.request();
        const filter = buildUserIdFilter(request, scopedUserIds, 'u.UserID');

        // Goals has no DepartmentId column — the real relationship is
        // Users.DepartmentID, so we go through Users to get from a goal to
        // its owner's department.
        const query = `
            SELECT
                d.DepartmentName AS department,
                COUNT(g.GoalID) AS totalGoals,
                SUM(CASE WHEN g.GoalStatus = 'Completed' THEN 1 ELSE 0 END) AS completedGoals
            FROM dbo.Departments d
            LEFT JOIN dbo.Users u ON u.DepartmentID = d.DepartmentID AND ${filter}
            LEFT JOIN dbo.Goals g ON g.UserID = u.UserID
            WHERE ${filter}
            GROUP BY d.DepartmentID, d.DepartmentName
            ORDER BY d.DepartmentName
        `;

        const result = await request.query(query);

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

const getTeamStats = async (req, res) => {
    const userId = req.user?.UserID || req.user?.userId;
    const role = req.user?.role || req.user?.Role;
    const normalizedRole = String(role || '').trim().toUpperCase();

    if (!['MANAGER', 'HOD'].includes(normalizedRole)) {
        return res.status(403).json({
            success: false,
            message: 'Team analytics are available to managers and HODs only.'
        });
    }

    try {
        const pool = await poolPromise;
        const scopedUserIds = await getAnalyticsUserIds(pool, userId, role);
        const request = pool.request();
        const filter = buildUserIdFilter(request, scopedUserIds, 'u.UserID');

        const query = `
            SELECT
                u.UserID,
                LTRIM(RTRIM(CONCAT(u.FirstName, ' ', u.LastName))) AS employeeName,
                COUNT(g.GoalID) AS totalGoals,
                SUM(CASE WHEN g.GoalStatus IN (
                    'Submitted', 'HOD Approved', 'Manager Approved',
                    'Reviewed By HOD', 'Business Head Approved', 'Review By Business Head'
                ) THEN 1 ELSE 0 END) AS pendingGoals,
                SUM(CASE WHEN g.GoalStatus IN ('Running', 'Approved', 'Postpone', 'Completion Submitted') THEN 1 ELSE 0 END) AS activeGoals,
                SUM(CASE WHEN g.GoalStatus = 'Completed' THEN 1 ELSE 0 END) AS completedGoals,
                SUM(CASE WHEN g.GoalStatus IN ('Draft', 'Rejected', 'Cancelled') THEN 1 ELSE 0 END) AS otherGoals
            FROM dbo.Users u
            LEFT JOIN dbo.Goals g ON g.UserID = u.UserID
            WHERE ${filter} AND u.IsActive = 1
            GROUP BY u.UserID, u.FirstName, u.LastName
            ORDER BY u.FirstName, u.LastName
        `;

        const result = await request.query(query);
        return res.status(200).json({
            success: true,
            message: 'Team goal analytics fetched successfully.',
            data: result.recordset
        });
    } catch (error) {
        console.error('Team Stats Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching team analytics.',
            errors: error.message
        });
    }
};

// Active direct reports of a Manager (ReportingManagerID) or HOD (HODID).
const getActiveDirectReports = async (pool, userId, role) => {
    const scopedUserIds = await getAnalyticsUserIds(pool, userId, role);
    const request = pool.request();
    const filter = buildUserIdFilter(request, scopedUserIds, 'u.UserID');
    const result = await request.query(`
        SELECT u.UserID,
               LTRIM(RTRIM(CONCAT(u.FirstName, ' ', u.LastName))) AS employeeName
        FROM dbo.Users u
        WHERE ${filter} AND u.IsActive = 1
        ORDER BY u.FirstName, u.LastName
    `);
    return result.recordset;
};

// Goal counts for the summary cards, over the given employees.
//   InProgress: approved, not completed, goals of `inProgressQuarter`.
//   Completed: completed within the fiscal year.
//   BroughtForwardPending: still-open goals whose End Date is past their own
//     quarter and falls in this fiscal year — the goals behind the Final
//     Evaluation "Brought forward (pending)" column, summed over Q1-Q4.
const getGoalCounts = async (pool, userIds, fiscalYear, inProgressQuarter) => {
    const request = pool.request()
        .input('FiscalYearStart', sql.Date, getFiscalQuarterBoundsFromLabel(`Q1-${fiscalYear}`).startKey)
        .input('FiscalYearEnd', sql.Date, getFiscalQuarterBoundsFromLabel(`Q4-${fiscalYear}`).endKey)
        .input('InProgressQuarter', sql.VarChar(10), inProgressQuarter);
    const filter = buildUserIdFilter(request, userIds, 'g.UserID');
    const inProgressStatuses = bindStatusList(request, 'InProgressStatus', IN_PROGRESS_STATUSES);

    const result = await request.query(`
        SELECT
            SUM(CASE WHEN g.Quarter = @InProgressQuarter
                      AND g.GoalStatus IN (${inProgressStatuses})
                     THEN 1 ELSE 0 END) AS InProgressGoals,
            SUM(CASE WHEN g.GoalStatus = 'Completed'
                      AND g.CompletedDate >= @FiscalYearStart
                      AND g.CompletedDate < DATEADD(DAY, 1, @FiscalYearEnd)
                     THEN 1 ELSE 0 END) AS CompletedGoals,
            SUM(CASE WHEN g.Timeline > g.QuarterEndDate
                      AND g.Timeline >= @FiscalYearStart
                      AND g.Timeline < DATEADD(DAY, 1, @FiscalYearEnd)
                      AND g.GoalStatus NOT IN ('Completed', 'Draft', 'Rejected', 'Cancelled')
                     THEN 1 ELSE 0 END) AS BroughtForwardPendingGoals
        FROM dbo.Goals g
        WHERE ${filter}
    `);
    const row = result.recordset[0] || {};
    return {
        InProgressGoals: row.InProgressGoals || 0,
        CompletedGoals: row.CompletedGoals || 0,
        BroughtForwardPendingGoals: row.BroughtForwardPendingGoals || 0
    };
};

// Fiscal years (FY end year) with any goal for these employees, plus the
// current one, newest first.
const getFiscalYearOptions = async (pool, userIds, currentFiscalYear) => {
    const request = pool.request();
    const filter = buildUserIdFilter(request, userIds, 'UserID');
    const result = await request.query(`
        SELECT DISTINCT RIGHT(Quarter, 4) AS FiscalYear
        FROM dbo.Goals
        WHERE ${filter} AND Quarter LIKE 'Q[1-4]-[0-9][0-9][0-9][0-9]'
    `);
    const years = new Set([currentFiscalYear, ...result.recordset.map((row) => Number(row.FiscalYear))]);
    return [...years].sort((a, b) => b - a);
};

/**
 * GET /api/v1/analytics/team-performance?fiscalYear=YYYY&employeeId=N
 * Manager/HOD only. Without employeeId: one row per active direct report.
 * With employeeId (must be an active direct report): that employee's
 * quarter rows. Every quarter and Quarter Average figure comes from
 * getYearlyPerformance, the calculation behind the Final Evaluation page.
 */
const getTeamPerformance = async (req, res) => {
    const userId = req.user?.UserID || req.user?.userId;
    const role = req.user?.role || req.user?.Role;
    const normalizedRole = String(role || '').trim().toUpperCase();

    if (!['MANAGER', 'HOD'].includes(normalizedRole)) {
        return res.status(403).json({
            success: false,
            message: 'Team analytics are available to managers and HODs only.'
        });
    }

    const fiscalYear = parseFiscalYear(req.query.fiscalYear);
    if (fiscalYear == null) {
        return res.status(400).json({
            success: false,
            message: 'Fiscal year must be a valid four-digit year.'
        });
    }

    const rawEmployeeId = req.query.employeeId;
    const hasEmployee = rawEmployeeId != null && rawEmployeeId !== '';
    if (hasEmployee && !/^\d+$/.test(String(rawEmployeeId))) {
        return res.status(400).json({ success: false, message: 'Employee ID must be a number.' });
    }
    const employeeId = hasEmployee ? Number(rawEmployeeId) : null;

    try {
        const pool = await poolPromise;
        const employees = await getActiveDirectReports(pool, userId, role);

        if (employeeId != null && !employees.some((e) => Number(e.UserID) === employeeId)) {
            return res.status(403).json({
                success: false,
                message: 'You can only view reports for your active direct reports.'
            });
        }

        const targetEmployees = employeeId != null
            ? employees.filter((e) => Number(e.UserID) === employeeId)
            : employees;
        const targetIds = targetEmployees.map((e) => e.UserID);
        const currentFiscalYear = parseFiscalYear(undefined);

        const [fiscalYearOptions, performances] = await Promise.all([
            getFiscalYearOptions(pool, employees.map((e) => e.UserID), currentFiscalYear),
            Promise.all(targetIds.map((id) => getYearlyPerformance(pool, id, fiscalYear)))
        ]);

        const baseData = {
            FiscalYear: fiscalYear,
            CurrentFiscalYear: currentFiscalYear,
            FiscalYearOptions: fiscalYearOptions,
            Employees: employees,
            SelectedEmployeeID: employeeId
        };

        if (performances.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Team performance fetched successfully.',
                data: { ...baseData, Summary: null, Members: [], YearlyPerformance: null }
            });
        }

        // In progress uses the real current quarter (not the Final Evaluation
        // future-quarters testing flag): today's quarter in the current year,
        // Q4 for a past year, none for a future year.
        const inProgressQuarter = fiscalYear === currentFiscalYear
            ? getFiscalQuarter().label
            : fiscalYear < currentFiscalYear ? `Q4-${fiscalYear}` : null;

        const counts = await getGoalCounts(pool, targetIds, fiscalYear, inProgressQuarter);

        // Goals in Q1-Q4 of the year, excluding Draft, Rejected and Cancelled
        // (the "y" of each quarter's "x of y" Completed column).
        const totalGoals = performances.reduce(
            (sum, performance) => sum + performance.Quarters.reduce(
                (quarterSum, quarter) => quarterSum + Number(quarter.CountedGoalCount || 0), 0,
            ),
            0,
        );

        const members = targetEmployees.map((employee, index) => {
            const performance = performances[index];
            const started = performance.Quarters.filter((quarter) => !quarter.isFuture);
            return {
                UserID: employee.UserID,
                employeeName: employee.employeeName,
                Quarters: performance.Quarters.map((quarter) => ({
                    Quarter: quarter.SummaryQuarter,
                    isFuture: quarter.isFuture,
                    QuarterCompletionPercentage: quarter.QuarterCompletionPercentage
                })),
                CompletedCount: started.reduce((sum, quarter) => sum + Number(quarter.CompletedCount || 0), 0),
                CountedGoalCount: started.reduce((sum, quarter) => sum + Number(quarter.CountedGoalCount || 0), 0),
                QuarterAveragePercentage: performance.QuarterAveragePercentage
            };
        });

        return res.status(200).json({
            success: true,
            message: 'Team performance fetched successfully.',
            data: {
                ...baseData,
                Summary: {
                    TotalGoals: totalGoals,
                    InProgressQuarter: inProgressQuarter,
                    ...counts
                },
                Members: members,
                YearlyPerformance: employeeId != null ? performances[0] : null
            }
        });
    } catch (error) {
        console.error('Team Performance Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching team performance.',
            errors: error.message
        });
    }
};

// Get quarter completion trend metrics
const getQuarterCompletionTrend = async (req, res) => {
    const userId = req.user?.UserID || req.user?.userId;
    const role = req.user?.role || req.user?.Role;

    try {
        const pool = await poolPromise;
        const scopedUserIds = await getAnalyticsUserIds(pool, userId, role);

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
    getTeamStats,
    getTeamPerformance,
    getQuarterCompletionTrend
};
