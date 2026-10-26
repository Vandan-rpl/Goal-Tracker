const { poolPromise, sql } = require('../config/db');
const { notifyUser } = require('../services/notifyService');
const {
    getFiscalQuarter,
    getFiscalQuarterBounds,
    getFiscalQuarterBoundsFromLabel
} = require('../utils/fiscalQuarter');
const {
    calculateQuarterAllocationAndAchievement
} = require('../utils/quarterPerformance');

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

const getYearlyPerformance = async (pool, userId, fiscalYear) => {
    const request = pool.request()
        .input('UserID', sql.Int, userId)
        .input('FiscalYear', sql.VarChar(4), String(fiscalYear));
    const result = await request
        .query(`
            WITH GoalQuarters AS (
                SELECT
                    goal.GoalID,
                    goal.Weightage,
                    goal.GoalStatus,
                    COALESCE(
                        firstCarryForward.FromQuarter,
                        goal.Quarter,
                        CASE
                            WHEN MONTH(goal.CreatedDate) BETWEEN 4 AND 6 THEN CONCAT('Q1-', YEAR(goal.CreatedDate) + 1)
                            WHEN MONTH(goal.CreatedDate) BETWEEN 7 AND 9 THEN CONCAT('Q2-', YEAR(goal.CreatedDate) + 1)
                            WHEN MONTH(goal.CreatedDate) BETWEEN 10 AND 12 THEN CONCAT('Q3-', YEAR(goal.CreatedDate) + 1)
                            ELSE CONCAT('Q4-', YEAR(goal.CreatedDate))
                        END
                    ) AS OriginalQuarter,
                    -- A goal earns its full weightage only once completion is
                    -- approved; sub-goal weightage is not used for scoring.
                    CAST(CASE WHEN goal.GoalStatus = 'Completed' THEN 100 ELSE 0 END AS DECIMAL(5,2))
                        AS SubGoalCompletionPercentage,
                    firstCarryForward.ProgressAtCarryForward
                FROM dbo.Goals goal
                OUTER APPLY (
                    SELECT TOP 1
                        history.FromQuarter,
                        history.ProgressAtCarryForward
                    FROM dbo.GoalCarryForwardHistory history
                    WHERE history.GoalID = goal.GoalID
                    ORDER BY history.CarriedForwardDate ASC, history.HistoryID ASC
                ) firstCarryForward
                WHERE goal.UserID = @UserID
                  AND goal.GoalStatus NOT IN ('Rejected', 'Cancelled')
            )
            SELECT *
            FROM GoalQuarters
            WHERE RIGHT(OriginalQuarter, 4) = @FiscalYear
            ORDER BY GoalID
        `);

    const fiscalQuarters = [1, 2, 3, 4].map((quarterNumber) =>
        getFiscalQuarterBoundsFromLabel(`Q${quarterNumber}-${fiscalYear}`),
    );
    const quarterSummaryRequest = pool.request().input('UserID', sql.Int, userId);
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
               ISNULL(own.Achieved, 0) AS SummaryAchieved,
               ISNULL(own.CompletedCount, 0) AS CompletedCount,
               ISNULL(own.CountedGoalCount, 0) AS CountedGoalCount,
               ISNULL(broughtForward.Achieved, 0) AS BroughtForwardAchieved,
               ISNULL(broughtForwardPending.Pending, 0) AS BroughtForwardPending,
               ISNULL(carried.CarriedForwardCount, 0) AS CarriedForwardCount
        FROM FiscalQuarters q
        OUTER APPLY (
            -- A goal completed after its start quarter ended is shown only as
            -- brought forward achieved in the quarter it was completed in.
            SELECT SUM(g.Weightage) AS Allocated,
                   SUM(CASE
                           WHEN g.CompletedDate >= DATEADD(DAY, 1, g.QuarterEndDate) THEN 0
                           ELSE COALESCE(g.AchievedWeightage, 0)
                       END) AS Achieved,
                   SUM(CASE WHEN g.GoalStatus = 'Completed' THEN 1 ELSE 0 END) AS CompletedCount,
                   COUNT(*) AS CountedGoalCount
            FROM dbo.Goals g
            WHERE g.UserID = @UserID
              AND g.Quarter = q.Label
              AND g.GoalStatus NOT IN ('Draft', 'Rejected', 'Cancelled')
        ) own
        OUTER APPLY (
            SELECT SUM(COALESCE(g.AchievedWeightage, 0)) AS Achieved
            FROM dbo.Goals g
            WHERE g.UserID = @UserID
              AND g.QuarterEndDate < q.StartDate
              AND g.CompletedDate >= q.StartDate
              AND g.CompletedDate < DATEADD(DAY, 1, q.EndDate)
        ) broughtForward
        -- Same as the employee dashboard: goals from an earlier quarter whose
        -- End Date is in this quarter and that are still open.
        OUTER APPLY (
            SELECT SUM(g.Weightage) AS Pending
            FROM dbo.Goals g
            WHERE g.UserID = @UserID
              AND g.QuarterEndDate < q.StartDate
              AND g.Timeline >= q.StartDate
              AND g.Timeline < DATEADD(DAY, 1, q.EndDate)
              AND g.GoalStatus NOT IN ('Completed', 'Draft', 'Rejected', 'Cancelled')
        ) broughtForwardPending
        OUTER APPLY (
            SELECT COUNT(DISTINCT g.GoalID) AS CarriedForwardCount
            FROM dbo.Goals g
            INNER JOIN dbo.GoalCarryForwardHistory history
                ON history.GoalID = g.GoalID
            WHERE g.UserID = @UserID
              AND g.Quarter = q.Label
              AND history.FromQuarter = q.Label
        ) carried
        ORDER BY q.EndDate
    `);
    const currentQuarterEnd = getFiscalQuarterBounds().endKey;
    const quarterSummaries = new Map(
        quarterSummaryResult.recordset.map((quarter) => [
            quarter.SummaryQuarter,
            {
                ...quarter,
                isFuture: fiscalQuarters.find((bounds) => bounds.label === quarter.SummaryQuarter).endKey >
                    currentQuarterEnd
            }
        ]),
    );

    const quarters = [1, 2, 3, 4].map((quarterNumber) => {
        const quarter = `Q${quarterNumber}`;
        const quarterGoals = result.recordset
            .filter((goal) => goal.OriginalQuarter === `${quarter}-${fiscalYear}`)
            .map((goal) => ({
                ...goal,
                SubGoalCompletionPercentage:
                    goal.ProgressAtCarryForward ??
                    goal.SubGoalCompletionPercentage
            }));
        const performance =
            calculateQuarterAllocationAndAchievement(quarterGoals);
        const quarterSummary = quarterSummaries.get(`${quarter}-${fiscalYear}`);

        return {
            Quarter: quarter,
            Percentage: quarterGoals.length === 0
                ? null
                : Math.round(performance.achievedPercentage * 100) / 100,
            AllocatedPercentage: performance.allocatedPercentage,
            AchievedPercentage: performance.achievedPercentage,
            GoalCount: quarterGoals.length,
            ...quarterSummary
        };
    });

    // Average the Achieved column shown in the table, over quarters that have
    // started and have counted goals.
    const availableQuarters = quarters.filter(
        (quarter) => !quarter.isFuture && quarter.CountedGoalCount > 0,
    );

    return {
        FiscalYear: fiscalYear,
        Quarters: quarters,
        AveragePercentage: availableQuarters.length > 0
            ? Math.round(
                (availableQuarters.reduce(
                    (total, quarter) => total + Number(quarter.SummaryAchieved || 0),
                    0,
                ) / availableQuarters.length) * 100,
            ) / 100
            : null
    };
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
 * Read-only. Self, CFO, HOD, reporting manager, or Business Head of the
 * target employee may view. Does NOT notify anyone.
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

        const allowed = await canAccessEvaluation(pool, requesterId, targetUserId);
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

        const isAuthorized =
            target.HODID === requesterId ||
            target.ReportingManagerID === requesterId ||
            target.BusinessHeadID === requesterId;

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
            const goalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/goals/final-evaluation/${targetUserId}`;

            await notifyUser(pool, {
                userId: targetUserId,
                title: 'Final Evaluation Available',
                message: `Your final evaluation for FY${evaluation.YearlyPerformance.FiscalYear} has been generated. Weighted Score: ${evaluation.WeightedScore ?? 'N/A'}.`,
                type: 'FINAL_EVALUATION_GENERATED',
                referenceId: targetUserId,
                referenceType: 'Evaluation',
                createdBy: requesterId,
                emailTo: evaluation.User.Email || undefined,
                emailSubject: 'Your Final Evaluation is Available',
                emailHtml: `
                    <h3>Hello ${evaluation.User.FirstName || 'there'},</h3>
                    <p>Your final evaluation for <strong>FY${evaluation.YearlyPerformance.FiscalYear}</strong> has been generated.</p>
                    <p>Weighted Score: <strong>${evaluation.WeightedScore ?? 'N/A'}</strong></p>
                    <p>Status: <strong>${evaluation.GoalCompletionStatus}</strong></p>
                    <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Evaluation</a>
                `
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
    getFinalEvaluation,
    viewFinalEvaluation,
    finalizeFinalEvaluation,
    canAccessEvaluation
};
