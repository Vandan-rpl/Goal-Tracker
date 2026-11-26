const { poolPromise, sql } = require('../config/db');
const { notifyUser } = require('../services/notifyService');
const {
    getFiscalQuarter,
    getFiscalQuarterBounds,
    getFiscalQuarterBoundsFromLabel,
    formatLocalDateKey
} = require('../utils/fiscalQuarter');
const {
    isAllocatedGoal,
    isCompletedWithin,
    completionMarkedDate,
    evaluationCategory,
    isOverdueGoal
} = require('../constants/goalQuarterRules');

const getFiscalYearEndYear = (date = new Date()) => {
    const fiscalQuarter = getFiscalQuarter(date).label;
    return Number(fiscalQuarter.slice(fiscalQuarter.indexOf('-') + 1));
};

const parseFiscalYear = (value) => {
    if (value == null) {
        return getFiscalYearEndYear();
    }

    if (!/^\d{4}$/.test(String(value))) {
        return null;
    }

    const year = Number(value);
    return year >= 1900 && year <= 9998 ? year : null;
};

// BusinessHead is the CFO role in this application and can see everyone.
// Managers and HODs may see employees in their reporting hierarchy.
const canAccessEvaluation = async (pool, requesterId, targetUserId) => {
    const normalizedRequesterId = Number(requesterId);
    if (normalizedRequesterId === Number(targetUserId)) {
        return true;
    }

    const result = await pool.request()
        .input('TargetUserID', sql.Int, targetUserId)
        .input('RequesterID', sql.Int, normalizedRequesterId)
        .query(`
            SELECT
                target.ReportingManagerID,
                target.HODID,
                target.BusinessHeadID,
                requester.Role AS RequesterRole
            FROM dbo.Users target
            CROSS JOIN dbo.Users requester
            WHERE target.UserID = @TargetUserID
              AND requester.UserID = @RequesterID
        `);

    const target = result.recordset[0];
    if (!target) {
        return false;
    }

    if (String(target.RequesterRole).toUpperCase() === 'BUSINESSHEAD') {
        return true;
    }

    if (
        target.HODID === normalizedRequesterId ||
        target.ReportingManagerID === normalizedRequesterId ||
        target.BusinessHeadID === normalizedRequesterId
    ) {
        return true;
    }

    if (!['MANAGER', 'HOD'].includes(String(target.RequesterRole).toUpperCase())) {
        return false;
    }

    const teamResult = await pool.request()
        .input('TargetUserID', sql.Int, targetUserId)
        .input('RequesterID', sql.Int, normalizedRequesterId)
        .query(`
            WITH TeamMembers AS (
                SELECT
                    UserID,
                    CAST('/' + CONVERT(VARCHAR(20), UserID) + '/' AS VARCHAR(MAX)) AS VisitedUsers
                FROM dbo.Users
                WHERE UserID = @RequesterID

                UNION ALL

                SELECT
                    employee.UserID,
                    CAST(manager.VisitedUsers + CONVERT(VARCHAR(20), employee.UserID) + '/' AS VARCHAR(MAX))
                FROM dbo.Users employee
                INNER JOIN TeamMembers manager
                    ON employee.ReportingManagerID = manager.UserID
                    OR employee.HODID = manager.UserID
                WHERE CHARINDEX(
                    '/' + CONVERT(VARCHAR(20), employee.UserID) + '/',
                    manager.VisitedUsers
                ) = 0
            )
            SELECT TOP 1 UserID
            FROM TeamMembers
            WHERE UserID = @TargetUserID
            OPTION (MAXRECURSION 100)
        `);

    return teamResult.recordset.length > 0;
};

// Read the latest HOD rating for each goal.
const getGoalsWithRatings = async (pool, userId) => {
    const goalsRequest = pool.request().input('UserID', sql.Int, userId);

    const goalsQuery = `
        SELECT GoalID, GoalNumber, GoalTitle, GoalStatus, Weightage, Timeline
        FROM dbo.Goals
        WHERE UserID = @UserID
    `;

    const orderedGoalsQuery = `${goalsQuery} ORDER BY GoalNumber ASC`;

    const goalsResult = await goalsRequest.query(orderedGoalsQuery);
    const goals = goalsResult.recordset;

    if (goals.length === 0) {
        return [];
    }

    // Fetch the latest rating for these goals in one query.
    let hodRatingsByGoalId = {};
    try {
        const goalIds = goals.map((g) => g.GoalID);
        const hodRequest = pool.request();
        const paramNames = goalIds.map((goalId, i) => {
            hodRequest.input(`GoalId${i}`, sql.BigInt, goalId);
            return `@GoalId${i}`;
        });

        const hodResult = await hodRequest.query(`
            SELECT GoalID, Rating, Comments AS Feedback, ReviewedDate AS UpdatedAt
            FROM (
                SELECT GoalID, Rating, Comments, ReviewedDate,
                       ROW_NUMBER() OVER (PARTITION BY GoalID ORDER BY ReviewedDate DESC) AS RatingRank
                FROM dbo.HODRatings
                WHERE GoalID IN (${paramNames.join(', ')})
            ) AS rankedRatings
            WHERE RatingRank = 1
        `);

        hodRatingsByGoalId = hodResult.recordset.reduce((acc, row) => {
            acc[row.GoalId] = row;
            return acc;
        }, {});
    } catch (hodErr) {
        console.error('[EVALUATION] Could not read HODRatings:', hodErr.message);
    }

    return goals.map((goal) => {
        const hodRating = hodRatingsByGoalId[goal.GoalID];

        const hodRatingDate = hodRating?.UpdatedAt ? new Date(hodRating.UpdatedAt) : null;

        const rating = hodRating?.Rating ?? null;
        const feedback = hodRating?.Feedback ?? null;
        const ratingSource = hodRatingDate ? 'HODRatings' : null;

        return {
            GoalID: goal.GoalID,
            GoalNumber: goal.GoalNumber,
            GoalTitle: goal.GoalTitle,
            GoalStatus: goal.GoalStatus,
            Weightage: goal.Weightage != null ? Number(goal.Weightage) : 0,
            Rating: rating != null ? Number(rating) : null,
            Feedback: feedback || null,
            RatingSource: ratingSource
        };
    });
};

// Per-quarter Final Evaluation figures for one employee and fiscal year.
// Rules: constants/goalQuarterRules.js. With S = start quarter, E = End Date
// quarter, C = quarter the user marked the goal complete (weightage counts
// only once that completion is approved), each completed goal's weightage is
// counted in quarter C under one category:
//   Achieved                (C = S)
//   Brought Forward         (E > S, S < C <= E)
//   Brought Forward Overdue (E > S, C > E)
//   Overdue Achieved        (E = S, C > S)
// Allocated: approved goals whose start quarter is this quarter.
// Brought Forward Allocated / Overdue Allocated (server only, not shown):
// with D = the quarter's first day, approved goals that started before D
// (any fiscal year) and were not completed before D (completion approved and
// marked before D). End Date on or after D -> Brought Forward Allocated,
// before D -> Overdue Allocated. A goal pending at the start of several
// quarters counts in each of them.
// Quarter Score = (sum of the four) / (Allocated + Brought Forward Allocated
// + Overdue Allocated), uncapped.
const getYearlyPerformance = async (pool, userId, fiscalYear) => {
    const fiscalQuarters = [1, 2, 3, 4].map((quarterNumber) =>
        getFiscalQuarterBoundsFromLabel(`Q${quarterNumber}-${fiscalYear}`),
    );
    const quarterSummaryRequest = pool.request()
        .input('UserID', sql.Int, userId)
        .input('Today', sql.Date, formatLocalDateKey(new Date()));
    fiscalQuarters.forEach((quarter, index) => {
        quarterSummaryRequest
            .input(`Q${index}Label`, sql.VarChar, quarter.label)
            .input(`Q${index}Start`, sql.Date, quarter.startKey)
            .input(`Q${index}End`, sql.Date, quarter.endKey);
    });
    const quarterValues = fiscalQuarters
        .map((_, index) => `(@Q${index}Label, @Q${index}Start, @Q${index}End)`)
        .join(',\n                ');
    const quarterSummaryResult = await quarterSummaryRequest.query(`
        WITH FiscalQuarters AS (
            SELECT Label, StartDate, EndDate
            FROM (VALUES
                ${quarterValues}
            ) quarters(Label, StartDate, EndDate)
        )
        SELECT q.Label AS SummaryQuarter,
               ISNULL(own.Allocated, 0) AS SummaryAllocated,
               ISNULL(own.CompletedCount, 0) AS CompletedCount,
               ISNULL(own.CountedGoalCount, 0) AS CountedGoalCount,
               ISNULL(categories.Achieved, 0) AS CategoryAchieved,
               ISNULL(categories.BroughtForward, 0) AS CategoryBroughtForward,
               ISNULL(categories.BroughtForwardOverdue, 0) AS CategoryBroughtForwardOverdue,
               ISNULL(categories.OverdueAchieved, 0) AS CategoryOverdueAchieved,
               ISNULL(pending.BroughtForwardAllocated, 0) AS BroughtForwardAllocated,
               ISNULL(pending.OverdueAllocated, 0) AS OverdueAllocated,
               ISNULL(overdue.OverdueCount, 0) AS OverdueCount
        FROM FiscalQuarters q
        OUTER APPLY (
            SELECT SUM(g.Weightage) AS Allocated,
                   SUM(CASE WHEN g.GoalStatus = 'Completed' THEN 1 ELSE 0 END) AS CompletedCount,
                   COUNT(*) AS CountedGoalCount
            FROM dbo.Goals g
            WHERE g.UserID = @UserID
              AND g.Quarter = q.Label
              AND ${isAllocatedGoal('g')}
        ) own
        OUTER APPLY (
            SELECT SUM(CASE WHEN c.Category = 'Achieved' THEN c.Weightage ELSE 0 END) AS Achieved,
                   SUM(CASE WHEN c.Category = 'BroughtForward' THEN c.Weightage ELSE 0 END) AS BroughtForward,
                   SUM(CASE WHEN c.Category = 'BroughtForwardOverdue' THEN c.Weightage ELSE 0 END) AS BroughtForwardOverdue,
                   SUM(CASE WHEN c.Category = 'OverdueAchieved' THEN c.Weightage ELSE 0 END) AS OverdueAchieved
            FROM dbo.Goals g
            CROSS APPLY (
                SELECT ${evaluationCategory('g', 'q.StartDate')} AS Category,
                       COALESCE(g.AchievedWeightage, g.Weightage, 0) AS Weightage
            ) c
            WHERE g.UserID = @UserID
              AND ${isCompletedWithin('g', 'q.StartDate', 'q.EndDate')}
        ) categories
        OUTER APPLY (
            -- Goals pending at the start of this quarter (D = q.StartDate).
            SELECT SUM(CASE WHEN p.Bucket = 'BroughtForward' THEN p.Weightage ELSE 0 END) AS BroughtForwardAllocated,
                   SUM(CASE WHEN p.Bucket = 'Overdue' THEN p.Weightage ELSE 0 END) AS OverdueAllocated
            FROM dbo.Goals g
            CROSS APPLY (
                SELECT CASE WHEN g.Timeline >= q.StartDate THEN 'BroughtForward' ELSE 'Overdue' END AS Bucket,
                       COALESCE(g.Weightage, 0) AS Weightage
            ) p
            WHERE g.UserID = @UserID
              AND ${isAllocatedGoal('g')}
              AND g.StartDate < q.StartDate
              AND NOT (
                  g.GoalStatus = 'Completed'
                  AND ${completionMarkedDate('g')} < q.StartDate
              )
        ) pending
        OUTER APPLY (
            SELECT COUNT(*) AS OverdueCount
            FROM dbo.Goals g
            WHERE g.UserID = @UserID
              AND g.Quarter = q.Label
              AND ${isOverdueGoal('g', '@Today')}
        ) overdue
        ORDER BY q.EndDate
    `);
    const currentQuarterEnd = getFiscalQuarterBounds().endKey;
    // TEMPORARY (testing only): EVALUATION_SHOW_FUTURE_QUARTERS=true in .env
    // treats future quarters as started on this page. Remove after testing.
    const showFutureQuarters = process.env.EVALUATION_SHOW_FUTURE_QUARTERS === 'true';
    const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

    const quarters = quarterSummaryResult.recordset.map((row) => {
        // Brought Forward / Overdue Allocated are used only for the Quarter
        // Score; they are not sent to the client.
        const { BroughtForwardAllocated, OverdueAllocated, ...displayRow } = row;
        const bounds = fiscalQuarters.find((quarter) => quarter.label === row.SummaryQuarter);
        const categoryTotal =
            Number(row.CategoryAchieved || 0) +
            Number(row.CategoryBroughtForward || 0) +
            Number(row.CategoryBroughtForwardOverdue || 0) +
            Number(row.CategoryOverdueAchieved || 0);
        const quarterScore = calculateQuarterScore(
            Number(row.SummaryAllocated || 0) +
                Number(BroughtForwardAllocated || 0) +
                Number(OverdueAllocated || 0),
            categoryTotal,
        );
        return {
            ...displayRow,
            Quarter: row.SummaryQuarter.split('-')[0],
            SummaryAllocated: round2(row.SummaryAllocated),
            CategoryAchieved: round2(row.CategoryAchieved),
            CategoryBroughtForward: round2(row.CategoryBroughtForward),
            CategoryBroughtForwardOverdue: round2(row.CategoryBroughtForwardOverdue),
            CategoryOverdueAchieved: round2(row.CategoryOverdueAchieved),
            CategoryTotal: round2(categoryTotal),
            QuarterScorePercentage: quarterScore,
            // Kept for Reports & Analytics: same value as the Quarter Score.
            QuarterCompletionPercentage: quarterScore,
            isFuture: !showFutureQuarters && bounds.endKey > currentQuarterEnd
        };
    });

    return {
        FiscalYear: fiscalYear,
        Quarters: quarters,
        YearScorePercentage: calculateYearScore(quarters),
        ToDateLabel: getToDateLabel(quarters)
    };
};

// Quarter Score % = (Achieved + Brought Forward + Brought Forward Overdue +
// Overdue Achieved) / (Allocated + Brought Forward Allocated + Overdue
// Allocated) x 100 for that quarter. All four are counted in the quarter the
// user marked the goal complete. Not capped. Null (shown as "-", not 0%) when
// the denominator is 0. Rounded to 2 decimal places.
const calculateQuarterScore = (denominator, categoryTotal) => {
    const denominatorValue = Number(denominator || 0);
    if (denominatorValue <= 0) return null;
    return Math.round((Number(categoryTotal || 0) / denominatorValue) * 100 * 100) / 100;
};

// Year Score % = (Achieved + Brought Forward + Brought Forward Overdue +
// Overdue Achieved, totalled across Q1-Q4 of the fiscal year) / 400 x 100.
// Always divided by 400, however many quarters have goals or have started.
// Not an average of quarter scores. Not capped. Rounded to 2 decimal places.
const YEAR_SCORE_DENOMINATOR = 400;
const calculateYearScore = (quarters) => {
    const achieved = quarters.reduce(
        (sum, quarter) => sum + Number(quarter.CategoryTotal || 0),
        0,
    );
    return Math.round((achieved / YEAR_SCORE_DENOMINATOR) * 100 * 100) / 100;
};

// Which quarters have started, e.g. "Q1–Q3 to date" or "Full year".
// Started quarters are always a run from Q1, so the last one names the range.
const getToDateLabel = (quarters) => {
    const startedCount = quarters.filter((quarter) => !quarter.isFuture).length;
    if (startedCount === 0) return 'No quarter started';
    if (startedCount === quarters.length) return 'Full year';
    return startedCount === 1 ? 'Q1 to date' : `Q1–Q${startedCount} to date`;
};

/**
 * Core, reusable data function. Not an Express handler; the route
 * handlers below (viewFinalEvaluation / finalizeFinalEvaluation) wrap this
 * with auth + req/res plumbing.
 */
const getFinalEvaluation = async (userId, fiscalYear) => {
    const pool = await poolPromise;
    const reportYear = parseFiscalYear(fiscalYear);
    if (reportYear == null) {
        throw new RangeError('Fiscal year must be a valid four-digit year.');
    }

    const userResult = await pool.request()
        .input('UserID', sql.Int, userId)
        .query('SELECT UserID, FirstName, LastName, Email FROM dbo.Users WHERE UserID = @UserID');

    const user = userResult.recordset[0];
    if (!user) {
        return null;
    }

    const [goalBreakdown, yearlyPerformance] = await Promise.all([
        getGoalsWithRatings(pool, userId),
        getYearlyPerformance(pool, userId, reportYear)
    ]);

    // Only rated goals with a positive weightage contribute a number —
    // an un-rated goal has no basis for a numeric contribution yet.
    const ratedGoals = goalBreakdown.filter((g) => g.Rating != null && g.Weightage > 0);
    const totalWeightage = ratedGoals.reduce((sum, g) => sum + g.Weightage, 0);
    const weightedSum = ratedGoals.reduce((sum, g) => sum + (g.Rating * g.Weightage), 0);

    const weightedScore = totalWeightage > 0
        ? Math.round((weightedSum / totalWeightage) * 100) / 100
        : null;

    const goalsWithContribution = goalBreakdown.map((g) => ({
        ...g,
        // Contribution = this goal's share of the weighted average.
        // Only meaningful for rated goals with weightage; null otherwise.
        Contribution: (g.Rating != null && g.Weightage > 0 && totalWeightage > 0)
            ? Math.round(((g.Rating * g.Weightage) / totalWeightage) * 100) / 100
            : null
    }));

    // Overall feedback = every goal's reviewer comment, labeled by goal so
    // it stays traceable to which goal each note is about.
    const feedbackParts = goalsWithContribution
        .filter((g) => g.Feedback && g.Feedback.trim() !== '')
        .map((g) => `${g.GoalTitle}: ${g.Feedback.trim()}`);

    const overallFeedback = feedbackParts.length > 0
        ? feedbackParts.join(' | ')
        : 'No reviewer feedback recorded yet.';

    // Goal Completion Status — Draft goals aren't "in the plan" yet, so
    // they're excluded from this rollup (but still shown in the breakdown).
    const nonDraftGoals = goalBreakdown.filter((g) => g.GoalStatus !== 'Draft');

    let goalCompletionStatus;
    if (goalBreakdown.length === 0 || nonDraftGoals.length === 0) {
        goalCompletionStatus = 'Not Started';
    } else if (nonDraftGoals.every((g) => g.GoalStatus === 'Completed')) {
        goalCompletionStatus = 'Completed';
    } else {
        goalCompletionStatus = 'In Progress';
    }

    return {
        User: {
            UserID: user.UserID,
            FirstName: user.FirstName,
            LastName: user.LastName,
            Email: user.Email
        },
        Goals: goalsWithContribution,
        WeightedScore: weightedScore,
        OverallFeedback: overallFeedback,
        GoalCompletionStatus: goalCompletionStatus,
        YearlyPerformance: yearlyPerformance
    };
};

/**
 * GET /api/v1/evaluation/:userId?fiscalYear=YYYY
 * Read-only. CFO, HOD, reporting manager, or Business Head of the target
 * employee may view (not the employee themselves). Does NOT notify anyone.
 */
const viewFinalEvaluation = async (req, res) => {
    try {
        const targetUserId = Number(req.params.userId);
        const requesterId = req.user?.UserID || req.user?.userId;
        const fiscalYear = parseFiscalYear(req.query.fiscalYear);
        if (fiscalYear == null) {
            return res.status(400).json({
                success: false,
                message: 'Fiscal year must be a valid four-digit year.'
            });
        }

        const pool = await poolPromise;

        // Final Evaluation is for the employee's Manager/HOD and CFO only;
        // employees cannot view their own.
        const allowed = Number(requesterId) !== targetUserId &&
            await canAccessEvaluation(pool, requesterId, targetUserId);
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view this evaluation.'
            });
        }

        const evaluation = await getFinalEvaluation(targetUserId, fiscalYear);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        return res.status(200).json({ success: true, data: evaluation });

    } catch (error) {
        console.error('View Final Evaluation Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching final evaluation.',
            errors: error.message
        });
    }
};

/**
 * POST /api/v1/evaluation/:userId/finalize
 *
 * The actual "generated/submitted by HOD/CFO" trigger point you asked for.
 * NOTE: there is no persisted FinalEvaluations table anywhere in this
 * schema — I didn't invent one. This endpoint computes the exact same
 * figure viewFinalEvaluation does and notifies the employee; it does NOT
 * lock in / snapshot a permanent record. If this evaluation ever feeds
 * compensation or HR decisions, you almost certainly want an immutable,
 * point-in-time record of what was actually communicated (in case goal
 * ratings or weightages change afterward) — that needs a real
 * FinalEvaluations table. Flagged rather than guessed at that design.
 *
 * Only the target employee's HOD, reporting manager, or Business Head can
 * call this (not the employee themselves — finalizing your own evaluation
 * doesn't make sense).
 */
const finalizeFinalEvaluation = async (req, res) => {
    try {
        const targetUserId = Number(req.params.userId);
        const requesterId = req.user?.UserID || req.user?.userId;
        const fiscalYear = parseFiscalYear(req.body?.fiscalYear);
        if (fiscalYear == null) {
            return res.status(400).json({
                success: false,
                message: 'Fiscal year must be a valid four-digit year.'
            });
        }

        const pool = await poolPromise;

        const hierarchyResult = await pool.request()
            .input('UserID', sql.Int, targetUserId)
            .query('SELECT ReportingManagerID, HODID, BusinessHeadID FROM dbo.Users WHERE UserID = @UserID');

        const target = hierarchyResult.recordset[0];
        if (!target) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        // Nobody can finalize (or see) their own evaluation.
        const isAuthorized =
            Number(requesterId) !== targetUserId && (
            target.HODID === requesterId ||
            target.ReportingManagerID === requesterId ||
            target.BusinessHeadID === requesterId);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: "Only this employee's HOD, reporting manager, or Business Head can finalize their evaluation."
            });
        }

        const evaluation = await getFinalEvaluation(targetUserId, fiscalYear);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        try {
            await notifyUser(pool, {
                userId: targetUserId,
                title: 'Final Evaluation Available',
                message: `Your final evaluation for FY${evaluation.YearlyPerformance.FiscalYear} has been generated. Weighted Score: ${evaluation.WeightedScore ?? 'N/A'}.`,
                type: 'FINAL_EVALUATION_GENERATED',
                referenceId: targetUserId,
                referenceType: 'Evaluation',
                createdBy: requesterId,
            });
        } catch (notifyErr) {
            console.error(`[NOTIF FAILED] finalizeFinalEvaluation notify step. targetUserId=${targetUserId}:`, notifyErr);
        }

        return res.status(200).json({
            success: true,
            message: 'Final evaluation generated and employee notified.',
            data: evaluation
        });

    } catch (error) {
        console.error('Finalize Final Evaluation Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while finalizing evaluation.',
            errors: error.message
        });
    }
};

module.exports = {
    parseFiscalYear,
    getYearlyPerformance,
    getFinalEvaluation,
    viewFinalEvaluation,
    finalizeFinalEvaluation,
    canAccessEvaluation
};
