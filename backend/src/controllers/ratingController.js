const { poolPromise, sql } = require('../config/db');
const { notifyUser } = require('../services/notifyService');

// Helper: fetch a goal together with its owner's contact/hierarchy info.
// Uses dbo.Goals / GoalID / UserID — the schema actually used everywhere
// else in the app (see goalController.js and goalModel.js) — NOT the
// unprefixed "Goals" / "GoalId" this file originally (incorrectly) used.
const getGoalWithOwner = async (pool, goalId) => {
    const result = await pool.request()
        .input('GoalID', sql.BigInt, goalId)
        .query(`
            SELECT
                g.GoalID,
                g.GoalTitle,
                g.GoalStatus,
                g.UserID AS OwnerID,
                owner.FirstName AS OwnerFirstName,
                owner.LastName AS OwnerLastName,
                owner.Email AS OwnerEmail,
                owner.ReportingManagerID,
                owner.HODID
            FROM dbo.Goals g
            JOIN dbo.Users owner ON g.UserID = owner.UserID
            WHERE g.GoalID = @GoalID
        `);
    return result.recordset[0] || null;
};

// Submit Quarterly Progress Update (Employee)
const submitQuarterlyUpdate = async (req, res) => {
    const { goalId, quarter, progressPercentage, achievements, challenges, evidenceUrl } = req.body;
    const userId = req.user?.UserID || req.user?.userId;

    if (!goalId || !quarter || progressPercentage === undefined) {
        return res.status(400).json({
            success: false,
            message: 'goalId, quarter, and progressPercentage are required.'
        });
    }

    try {
        const pool = await poolPromise;

        const goal = await getGoalWithOwner(pool, goalId);
        if (!goal) {
            return res.status(404).json({ success: false, message: 'Goal not found.' });
        }

        // Only the goal owner may submit a quarterly update for their own goal.
        if (goal.OwnerID !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Only the goal owner can submit a quarterly update for this goal.'
            });
        }

        // NOTE ON QuarterlyUpdates SCHEMA:
        // This table isn't defined anywhere else that shows a full CREATE TABLE,
        // but it IS referenced elsewhere (src/models/dashboardModel.js), which
        // assumes different column names (QuarterlyUpdateId, QuarterNo, UpdateDate,
        // IsDeleted) than this controller originally assumed (Quarter, CreatedAt,
        // UpdatedAt, Achievements, Challenges, EvidenceUrl). I left this file's
        // original column names in place below since I can't confirm the real
        // table definition from the code alone — see the flag in my response
        // before trusting this query against the live database.
        await pool.request()
            .input('GoalId', sql.BigInt, goalId)
            .input('Quarter', sql.VarChar, quarter)
            .input('ProgressPercentage', sql.Decimal(5, 2), progressPercentage)
            .input('Achievements', sql.VarChar, achievements || '')
            .input('Challenges', sql.VarChar, challenges || '')
            .input('EvidenceUrl', sql.VarChar, evidenceUrl || '')
            .query(`
                MERGE INTO QuarterlyUpdates AS target
                USING (SELECT @GoalId AS GoalId, @Quarter AS Quarter) AS source
                ON (target.GoalId = source.GoalId AND target.Quarter = source.Quarter)
                WHEN MATCHED THEN
                    UPDATE SET ProgressPercentage = @ProgressPercentage,
                               Achievements = @Achievements,
                               Challenges = @Challenges,
                               EvidenceUrl = @EvidenceUrl,
                               UpdatedAt = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (GoalId, Quarter, ProgressPercentage, Achievements, Challenges, EvidenceUrl, CreatedAt, UpdatedAt)
                    VALUES (@GoalId, @Quarter, @ProgressPercentage, @Achievements, @Challenges, @EvidenceUrl, GETDATE(), GETDATE());
            `);

        // REMOVED: the original code also ran
        //   UPDATE Goals SET Progress = @ProgressPercentage, UpdatedAt = GETDATE() WHERE GoalId = @GoalId
        // dbo.Goals (per goalController.js / goalModel.js) has NO "Progress" or
        // "UpdatedAt" columns — every other query against dbo.Goals uses
        // ModifiedDate, ApprovedDate, GoalStatus, etc. Left in, that statement
        // would fail every single call. Flagged in my response instead of guessed.

        // Notify the HOD that a quarterly update was submitted.
        try {
            if (goal.HODID) {
                const hodResult = await pool.request()
                    .input('UserID', sql.Int, goal.HODID)
                    .query('SELECT UserID, FirstName, LastName, Email FROM dbo.Users WHERE UserID = @UserID');
                const hod = hodResult.recordset[0];

                if (hod) {
                    const employeeName = `${goal.OwnerFirstName} ${goal.OwnerLastName}`;
                    const goalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/goals/view/${goalId}`;

                    await notifyUser(pool, {
                        userId: hod.UserID,
                        title: 'Quarterly Update Submitted',
                        message: `${employeeName} submitted a Q${quarter} update (${progressPercentage}% progress) for goal "${goal.GoalTitle}".`,
                        type: 'QUARTERLY_UPDATE_SUBMITTED',
                        referenceId: Number(goalId),
                        referenceType: 'Goal',
                        createdBy: userId,
                        emailTo: hod.Email || undefined,
                        emailSubject: `Quarterly Update Submitted - ${employeeName}`,
                        emailHtml: `
                            <h3>Hello ${hod.FirstName || 'there'},</h3>
                            <p><strong>${employeeName}</strong> submitted a quarterly progress update for goal <strong>"${goal.GoalTitle}"</strong>.</p>
                            <p>Quarter: <strong>${quarter}</strong> | Progress: <strong>${progressPercentage}%</strong></p>
                            <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
                        `
                    });
                }
            }
        } catch (notifyErr) {
            console.error(`[NOTIF FAILED] submitQuarterlyUpdate notify step. goalId=${goalId} userId=${goal.HODID}:`, notifyErr);
        }

        return res.status(200).json({
            success: true,
            message: 'Quarterly progress update submitted successfully.'
        });

    } catch (error) {
        console.error('Quarterly Update Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while submitting quarterly update.',
            errors: error.message
        });
    }
};

// Submit HOD Review & 5-Point Rating Scale (Manager / HOD)
const submitHODRating = async (req, res) => {
    const { goalId, rating, feedback } = req.body; // Rating scale: 1 to 5
    const hodId = req.user?.UserID || req.user?.userId;

    if (!goalId || rating === undefined || rating < 1 || rating > 5) {
        return res.status(400).json({
            success: false,
            message: 'goalId and a valid rating score between 1 and 5 are required.'
        });
    }

    try {
        const pool = await poolPromise;

        const goal = await getGoalWithOwner(pool, goalId);
        if (!goal) {
            return res.status(404).json({ success: false, message: 'Goal not found.' });
        }

        // Only the HOD or reporting manager of the goal owner may submit an HOD rating.
        const isAuthorizedRater = goal.HODID === hodId || goal.ReportingManagerID === hodId;
        if (!isAuthorizedRater) {
            return res.status(403).json({
                success: false,
                message: 'Only the HOD/reporting manager of this goal owner can submit an HOD rating.'
            });
        }

        // NOTE ON HODRatings SCHEMA: same caveat as QuarterlyUpdates above — this
        // table is also referenced from src/controllers/analyticsController.js
        // (GoalId, Rating), which is at least consistent with what's used here,
        // but I still can't confirm the full column list against a real schema
        // definition. Flagged in my response.
        await pool.request()
            .input('GoalId', sql.BigInt, goalId)
            .input('HODId', sql.Int, hodId)
            .input('Rating', sql.Int, rating)
            .input('Feedback', sql.VarChar, feedback || '')
            .query(`
                MERGE INTO HODRatings AS target
                USING (SELECT @GoalId AS GoalId) AS source
                ON (target.GoalId = source.GoalId)
                WHEN MATCHED THEN
                    UPDATE SET Rating = @Rating,
                               Feedback = @Feedback,
                               HODId = @HODId,
                               UpdatedAt = GETDATE()
                WHEN NOT MATCHED THEN
                    INSERT (GoalId, HODId, Rating, Feedback, CreatedAt, UpdatedAt)
                    VALUES (@GoalId, @HODId, @Rating, @Feedback, GETDATE(), GETDATE());
            `);

        // Notify the employee that the HOD submitted a rating.
        try {
            const employeeName = `${goal.OwnerFirstName} ${goal.OwnerLastName}`;
            const goalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/goals/view/${goalId}`;

            await notifyUser(pool, {
                userId: goal.OwnerID,
                title: 'HOD Rating Submitted',
                message: `Your goal "${goal.GoalTitle}" received an HOD rating of ${rating}/5. Feedback: ${feedback || 'No feedback provided'}`,
                type: 'HOD_RATING_SUBMITTED',
                referenceId: Number(goalId),
                referenceType: 'Goal',
                createdBy: hodId,
                emailTo: goal.OwnerEmail || undefined,
                emailSubject: `HOD Rating Submitted - ${employeeName}`,
                emailHtml: `
                    <h3>Hello ${goal.OwnerFirstName || 'there'},</h3>
                    <p>Your goal titled <strong>"${goal.GoalTitle}"</strong> has received an HOD rating.</p>
                    <p>Rating: <strong>${rating}/5</strong></p>
                    <p>Feedback: ${feedback || 'No feedback provided'}</p>
                    <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
                `
            });
        } catch (notifyErr) {
            console.error(`[NOTIF FAILED] submitHODRating notify step. goalId=${goalId} userId=${goal.OwnerID}:`, notifyErr);
        }

        return res.status(200).json({
            success: true,
            message: 'HOD rating and feedback submitted successfully.'
        });

    } catch (error) {
        console.error('HOD Rating Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while saving HOD rating.',
            errors: error.message
        });
    }
};

// Get Quarterly Update History for a Goal (Employee owner or their HOD/manager)
const getQuarterlyUpdates = async (req, res) => {
    const { goalId } = req.params;
    const userId = req.user?.UserID || req.user?.userId;

    try {
        const pool = await poolPromise;

        const goal = await getGoalWithOwner(pool, goalId);
        if (!goal) {
            return res.status(404).json({ success: false, message: 'Goal not found.' });
        }

        // Only the goal owner or their HOD/reporting manager may view this
        // goal's quarterly update history.
        const isAuthorized =
            goal.OwnerID === userId ||
            goal.HODID === userId ||
            goal.ReportingManagerID === userId;

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view quarterly updates for this goal.'
            });
        }

        // Same schema caveat as submitQuarterlyUpdate above — reading back
        // with the same column names this feature writes with.
        const result = await pool.request()
            .input('GoalId', sql.BigInt, goalId)
            .query(`
                SELECT GoalId, Quarter, ProgressPercentage, Achievements, Challenges, EvidenceUrl, CreatedAt, UpdatedAt
                FROM QuarterlyUpdates
                WHERE GoalId = @GoalId
                ORDER BY Quarter ASC
            `);

        return res.status(200).json({
            success: true,
            data: result.recordset
        });

    } catch (error) {
        console.error('Get Quarterly Updates Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching quarterly updates.',
            errors: error.message
        });
    }
};

module.exports = {
    submitQuarterlyUpdate,
    submitHODRating,
    getQuarterlyUpdates
};
