const { poolPromise, sql } = require('../config/db');
const { notifyUser } = require('../services/notifyService');

/**
 * ============================================================
 * IMPORTANT — READ THIS BEFORE TRUSTING WeightedScore
 * ============================================================
 * You asked me to flag it clearly if rating data isn't in one consistent
 * place after the earlier prompts. It isn't. There are TWO separate,
 * disconnected places a goal's rating can end up:
 *
 *   Ratings are stored in the `HODRatings` table. The old goal-level
 *   ManagerRating columns are not part of the database schema.
 *
 * ALSO FLAGGING: there is no "review cycle" / period / year concept
 * anywhere in this schema — I searched, nothing like ReviewCycle,
 * AppraisalPeriod, or similar exists on dbo.Goals or anywhere else. The
 * `cycle` parameter below is therefore a best-effort stand-in: if
 * provided, it's treated as a calendar year and used to filter goals by
 * YEAR(Timeline). If you actually need discrete review cycles (e.g.
 * "H1 2026", "Annual 2026"), that needs a real column added to dbo.Goals
 * — flagged, not guessed.
 */

// Access rule: a user can view an evaluation if it's their own, or if
// they are the target employee's HOD, reporting manager, or Business Head.
const canAccessEvaluation = async (pool, requesterId, targetUserId) => {
    if (requesterId === targetUserId) {
        return true;
    }

    const result = await pool.request()
        .input('UserID', sql.Int, targetUserId)
        .query('SELECT ReportingManagerID, HODID, BusinessHeadID FROM dbo.Users WHERE UserID = @UserID');

    const target = result.recordset[0];
    if (!target) {
        return false;
    }

    return (
        target.HODID === requesterId ||
        target.ReportingManagerID === requesterId ||
        target.BusinessHeadID === requesterId
    );
};

// Read the latest HOD rating for each goal.
const getGoalsWithRatings = async (pool, userId, cycle) => {
    const goalsRequest = pool.request().input('UserID', sql.Int, userId);

    let goalsQuery = `
        SELECT GoalID, GoalNumber, GoalTitle, GoalStatus, Weightage, Timeline
        FROM dbo.Goals
        WHERE UserID = @UserID
    `;

    if (cycle) {
        goalsRequest.input('Cycle', sql.Int, Number(cycle));
        goalsQuery += ` AND YEAR(Timeline) = @Cycle`;
    }

    goalsQuery += ` ORDER BY GoalNumber ASC`;

    const goalsResult = await goalsRequest.query(goalsQuery);
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

/**
 * Core, reusable data function — matches the literal signature requested:
 * getFinalEvaluation(userId, cycle). Not an Express handler; the route
 * handlers below (viewFinalEvaluation / finalizeFinalEvaluation) wrap this
 * with auth + req/res plumbing.
 */
const getFinalEvaluation = async (userId, cycle) => {
    const pool = await poolPromise;

    const userResult = await pool.request()
        .input('UserID', sql.Int, userId)
        .query('SELECT UserID, FirstName, LastName, Email FROM dbo.Users WHERE UserID = @UserID');

    const user = userResult.recordset[0];
    if (!user) {
        return null;
    }

    const goalBreakdown = await getGoalsWithRatings(pool, userId, cycle);

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
        Cycle: cycle || null,
        Goals: goalsWithContribution,
        WeightedScore: weightedScore,
        OverallFeedback: overallFeedback,
        GoalCompletionStatus: goalCompletionStatus
    };
};

/**
 * GET /api/v1/evaluation/:userId?cycle=YYYY
 * Read-only. Self, HOD, reporting manager, or Business Head of the target
 * employee may view. Does NOT notify anyone — this is just viewing/
 * computing on demand and could be called (or refreshed) many times.
 */
const viewFinalEvaluation = async (req, res) => {
    try {
        const targetUserId = Number(req.params.userId);
        const requesterId = req.user?.UserID || req.user?.userId;
        const { cycle } = req.query;

        const pool = await poolPromise;

        const allowed = await canAccessEvaluation(pool, requesterId, targetUserId);
        if (!allowed) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view this evaluation.'
            });
        }

        const evaluation = await getFinalEvaluation(targetUserId, cycle);
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
        const { cycle } = req.body;

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

        const evaluation = await getFinalEvaluation(targetUserId, cycle);
        if (!evaluation) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        try {
            const goalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/goals/final-evaluation/${targetUserId}`;

            await notifyUser(pool, {
                userId: targetUserId,
                title: 'Final Evaluation Available',
                message: `Your final evaluation${evaluation.Cycle ? ` for ${evaluation.Cycle}` : ''} has been generated. Weighted Score: ${evaluation.WeightedScore ?? 'N/A'}.`,
                type: 'FINAL_EVALUATION_GENERATED',
                referenceId: targetUserId,
                referenceType: 'Evaluation',
                createdBy: requesterId,
                emailTo: evaluation.User.Email || undefined,
                emailSubject: 'Your Final Evaluation is Available',
                emailHtml: `
                    <h3>Hello ${evaluation.User.FirstName || 'there'},</h3>
                    <p>Your final evaluation${evaluation.Cycle ? ` for <strong>${evaluation.Cycle}</strong>` : ''} has been generated.</p>
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
    finalizeFinalEvaluation
};
