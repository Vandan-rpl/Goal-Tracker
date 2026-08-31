const { poolPromise, sql } = require('../config/db');
const crypto = require('crypto');
const goalModel = require('../models/goalModel');
const { notifyUser } = require('../services/notifyService');
const { validateSmartGoal } = require('../utils/smartGoalValidator');

// Helper function to log goal history (Action set to 'UPDATE' to comply with constraints)
const logGoalHistory = async (transaction, goalId, action, oldValue, newValue, remarks, performedBy) => {
    try {
        const req = new sql.Request(transaction);
        await req.input('GoalID', sql.BigInt, goalId)
           .input('Action', sql.VarChar, action === 'CREATE' ? 'CREATE' : 'UPDATE')
           .input('OldValue', sql.NVarChar, oldValue || null)
           .input('NewValue', sql.NVarChar, newValue || null)
           .input('Remarks', sql.NVarChar, remarks || null)
           .input('PerformedBy', sql.Int, performedBy || null)
           .query(`
               INSERT INTO dbo.GoalHistory (GoalID, Action, OldValue, NewValue, Remarks, PerformedBy, PerformedDate)
               VALUES (@GoalID, @Action, @OldValue, @NewValue, @Remarks, @PerformedBy, GETDATE())
           `);
    } catch (err) {
        console.error('Goal History Logging Error:', err);
    }
};

// Helper: fetch a user's basic contact/hierarchy info in one place.
// Reused by the notification call sites below so we don't repeat the same
// Users lookup query four different ways.
const getUserContact = async (pool, userId) => {
    const result = await pool.request()
        .input('UserID', sql.Int, userId)
        .query(`
            SELECT UserID, FirstName, LastName, Email, ReportingManagerID, HODID, BusinessHeadID
            FROM dbo.Users
            WHERE UserID = @UserID
        `);
    return result.recordset[0] || null;
};

// Notify the relevant hierarchy above the employee that a goal was submitted/updated for review.
const notifyGoalHierarchy = async (userId, newGoalID, GoalTitle, goalStatus) => {
    if (goalStatus !== 'Submitted') return [];

    const pool = await poolPromise;
    const employee = await getUserContact(pool, userId);

    if (!employee) return [];

    const employeeName = `${employee.FirstName || ''} ${employee.LastName || ''}`.trim() || 'Employee';
    const approvalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/goals/view/${newGoalID}`;

    const superiorIds = [employee.ReportingManagerID, employee.HODID, employee.BusinessHeadID]
        .filter((id) => id !== null && id !== undefined && id !== '')
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id) && id !== userId)
        .filter((id, index, arr) => arr.indexOf(id) === index);

    if (superiorIds.length === 0) return [];

    const notifiedEmails = [];

    for (const superiorId of superiorIds) {
        const superior = await getUserContact(pool, superiorId);

        if (!superior || !superior.Email) continue;

        const superiorName = `${superior.FirstName || ''} ${superior.LastName || ''}`.trim() || 'Manager';
        const recipientEmail = superior.Email.trim();

        await notifyUser(pool, {
            userId: superiorId,
            title: 'Goal Submitted / Updated',
            message: `Goal submitted by ${employeeName} awaiting your approval.`,
            type: 'GOAL_SUBMITTED',
            referenceId: Number(newGoalID),
            referenceType: 'Goal',
            createdBy: userId,
            emailTo: recipientEmail,
            emailSubject: `Goal Submitted for Approval - ${employeeName}`,
            emailHtml: `
                <h3>Hello ${superiorName},</h3>
                <p><strong>${employeeName}</strong> has submitted/updated a performance goal titled: <strong>"${GoalTitle}"</strong> for your review.</p>
                <p>Please click the link below to review this goal:</p>
                <a href="${approvalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Click Here to Review Goal</a>
            `
        });

        notifiedEmails.push(recipientEmail);
    }

    return notifiedEmails;
};

// 1. Get All Goals
const getGoals = async (req, res) => {
    const userId = req.user?.UserID || req.user?.userId;

    try {
        const pool = await poolPromise;
        let query = `
            SELECT g.*, u.Username, u.FirstName, u.LastName 
            FROM dbo.Goals g
            JOIN dbo.Users u ON g.UserID = u.UserID
            WHERE g.UserID = @UserID
            ORDER BY g.CreatedDate DESC
        `;

        const request = pool.request();
        request.input('UserID', sql.Int, userId);

        const result = await request.query(query);

        return res.status(200).json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Get Goals Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while fetching goals.', errors: error.message });
    }
};

// 2. Get Single Goal with Sub-Goals & History
const getGoalById = async (req, res) => {
    const { id } = req.params;

    try {
        const pool = await poolPromise;
        
        const goalResult = await pool.request()
            .input('GoalID', sql.BigInt, id)
            .query('SELECT TOP 1 * FROM dbo.Goals WHERE GoalID = @GoalID');

        if (goalResult.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Goal not found.' });
        }

        const subGoalsResult = await pool.request()
            .input('GoalID', sql.BigInt, id)
            .query('SELECT * FROM dbo.GoalSubGoals WHERE GoalID = @GoalID');

        const historyResult = await pool.request()
            .input('GoalID', sql.BigInt, id)
            .query('SELECT h.*, u.FirstName, u.LastName FROM dbo.GoalHistory h LEFT JOIN dbo.Users u ON h.PerformedBy = u.UserID WHERE h.GoalID = @GoalID ORDER BY h.PerformedDate DESC');

        return res.status(200).json({
            success: true,
            data: {
                ...goalResult.recordset[0],
                SubGoals: subGoalsResult.recordset,
                History: historyResult.recordset
            }
        });
    } catch (error) {
        console.error('Get Goal By ID Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while fetching goal.', errors: error.message });
    }
};

// 3. Add Goal
const createGoal = async (req, res) => {
    const {
        GoalNumber, GoalTitle, GoalDescription, Measurability, JointAccountability,
        Weightage, Priority, Timeline, MeetPerformance, ExceedPerformance,
        ValidationSource, CrossFunctionalGoal, GoalCategory, GoalStatus, SubGoals
    } = req.body;
    
    const userId = req.body.UserID || req.user?.UserID || req.user?.userId;

    if (!GoalTitle || !Weightage || !Priority || !Timeline) {
        return res.status(400).json({ success: false, message: 'Mandatory goal fields are missing.' });
    }

    const pool = await poolPromise;

    // SMART validation only applies when actually submitting for approval —
    // Draft goals can stay incomplete while the employee is still working
    // on them. See smartGoalValidator.js for the exact criteria and the
    // Achievable weightage-sum DB check this triggers.
    if (GoalStatus === 'Submitted') {
        const { valid, errors } = await validateSmartGoal(
            { GoalTitle, GoalDescription, Measurability, MeetPerformance, ExceedPerformance, Weightage, GoalCategory, Timeline, CreatedDate: new Date() },
            { pool, userId }
        );
        if (!valid) {
            return res.status(400).json({
                success: false,
                message: 'This goal does not meet SMART criteria required for submission.',
                errors
            });
        }
    }

    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        request.input('UserID', sql.Int, userId);
        request.input('GoalNumber', sql.Int, GoalNumber || 1);
        request.input('GoalTitle', sql.NVarChar, GoalTitle);
        request.input('GoalDescription', sql.NVarChar, GoalDescription || null);
        request.input('Measurability', sql.NVarChar, Measurability || null);
        request.input('JointAccountability', sql.NVarChar, JointAccountability || null);
        request.input('Weightage', sql.Decimal(5, 2), Weightage);
        request.input('Priority', sql.VarChar, Priority);
        request.input('Timeline', sql.Date, Timeline);
        request.input('MeetPerformance', sql.NVarChar, MeetPerformance || null);
        request.input('ExceedPerformance', sql.NVarChar, ExceedPerformance || null);
        request.input('ValidationSource', sql.NVarChar, ValidationSource || null);
        request.input('CrossFunctionalGoal', sql.Bit, CrossFunctionalGoal ? 1 : 0);
        request.input('GoalCategory', sql.NVarChar, GoalCategory || null);
        request.input('GoalStatus', sql.VarChar, GoalStatus || 'Draft');
        request.input('SubmittedDate', sql.DateTime, GoalStatus === 'Submitted' ? new Date() : null);

        const goalInsertResult = await request.query(`
            INSERT INTO dbo.Goals (
                UserID, GoalNumber, GoalTitle, GoalDescription, Measurability, 
                JointAccountability, Weightage, Priority, Timeline, MeetPerformance, 
                ExceedPerformance, ValidationSource, CrossFunctionalGoal, GoalCategory, 
                GoalStatus, DraftVersion, SubmittedDate, CreatedDate
            )
            OUTPUT INSERTED.GoalID
            VALUES (
                @UserID, @GoalNumber, @GoalTitle, @GoalDescription, @Measurability, 
                @JointAccountability, @Weightage, @Priority, @Timeline, @MeetPerformance, 
                @ExceedPerformance, @ValidationSource, @CrossFunctionalGoal, @GoalCategory, 
                @GoalStatus, 1, @SubmittedDate, GETDATE()
            )
        `);

        const newGoalID = goalInsertResult.recordset[0].GoalID;

        await logGoalHistory(transaction, newGoalID, 'CREATE', null, GoalStatus || 'Draft', 'Goal created', userId);

        if (SubGoals && SubGoals.length > 0) {
            for (let i = 0; i < SubGoals.length; i++) {
                const sub = SubGoals[i];
                const subRequest = new sql.Request(transaction);
                subRequest.input('GoalID', sql.BigInt, newGoalID);
                subRequest.input('SubGoalNo', sql.Int, i + 1);
                subRequest.input('SubGoalTitle', sql.NVarChar, sub.SubGoalTitle);
                subRequest.input('SubGoalDescription', sql.NVarChar, sub.SubGoalDescription || null);
                subRequest.input('Weightage', sql.Decimal(5, 2), sub.Weightage || 0);
                subRequest.input('Target', sql.NVarChar, sub.Target || null);
                subRequest.input('Status', sql.VarChar, 'Pending');

                await subRequest.query(`
                    INSERT INTO dbo.GoalSubGoals (GoalID, SubGoalNo, SubGoalTitle, SubGoalDescription, Weightage, Target, Status, CreatedDate)
                    VALUES (@GoalID, @SubGoalNo, @SubGoalTitle, @SubGoalDescription, @Weightage, @Target, @Status, GETDATE())
                `);
            }
        }

        await transaction.commit();

        const notifiedEmails = await notifyGoalHierarchy(userId, newGoalID, GoalTitle, GoalStatus);

        const responseMessage = notifiedEmails.length > 0
            ? `Your goal is submitted and email has been sent to ${notifiedEmails.length} approver(s) in your reporting hierarchy.`
            : 'Goal created successfully.';

        return res.status(201).json({ 
            success: true, 
            message: responseMessage, 
            data: { GoalID: newGoalID } 
        });

    } catch (error) {
        if (transaction._aborted === false && transaction._acquiredConnection) {
            try { await transaction.rollback(); } catch (rbErr) {}
        }
        console.error('Create Goal Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while creating goal.', errors: error.message });
    }
};

// 4. Update Goal
const updateGoal = async (req, res) => {
    const { id } = req.params;
    const {
        GoalNumber, GoalTitle, GoalDescription, Measurability, JointAccountability,
        Weightage, Priority, Timeline, MeetPerformance, ExceedPerformance,
        ValidationSource, CrossFunctionalGoal, GoalCategory, GoalStatus, SubGoals
    } = req.body;

    const userId = req.body.UserID || req.user?.UserID || req.user?.userId;
    const transaction = new sql.Transaction(await poolPromise);

    try {
        await transaction.begin();

        const checkRequest = new sql.Request(transaction);
        const checkResult = await checkRequest.input('GoalID', sql.BigInt, id)
            .query('SELECT * FROM dbo.Goals WHERE GoalID = @GoalID');

        if (checkResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Goal not found.' });
        }

        const existingGoal = checkResult.recordset[0];
        const currentStatus = existingGoal.GoalStatus;

        if (currentStatus === 'Submitted') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Submitted goals cannot be modified.' });
        }

        if (currentStatus === 'Rejected') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Rejected goals cannot be edited.' });
        }

        const newStatus = GoalStatus || currentStatus;
        const isDraft = currentStatus === 'Draft';

        const finalGoalNumber = isDraft ? GoalNumber : existingGoal.GoalNumber;
        const finalGoalTitle = isDraft ? GoalTitle : existingGoal.GoalTitle;
        const finalGoalDesc = isDraft ? GoalDescription : existingGoal.GoalDescription;
        const finalMeetPerf = isDraft ? MeetPerformance : existingGoal.MeetPerformance;
        const finalExceedPerf = isDraft ? ExceedPerformance : existingGoal.ExceedPerformance;
        const finalValidation = isDraft ? ValidationSource : existingGoal.ValidationSource;
        const finalJointAcc = isDraft ? JointAccountability : existingGoal.JointAccountability;
        const finalCategory = isDraft ? GoalCategory : existingGoal.GoalCategory;
        const finalCrossFunc = isDraft ? (CrossFunctionalGoal ? 1 : 0) : existingGoal.CrossFunctionalGoal;

        // SMART validation only applies when this update actually moves the
        // goal to 'Submitted' — validated against the exact values that
        // will be persisted below (finalGoalDesc/finalCategory respect the
        // isDraft field-locking rule already in this function; Weightage
        // and Timeline aren't isDraft-gated here — they never were, even
        // before this fix — so they're validated as submitted directly).
        // Uses the goal's own transaction connection for the Achievable
        // weightage-sum read, and the goal's real CreatedDate as the
        // Time-bound baseline (not "now" — this goal may have been created
        // long before this edit).
        if (newStatus === 'Submitted') {
            const { valid, errors } = await validateSmartGoal(
                {
                    GoalTitle: finalGoalTitle,
                    GoalDescription: finalGoalDesc,
                    Measurability,
                    MeetPerformance: finalMeetPerf,
                    ExceedPerformance: finalExceedPerf,
                    Weightage,
                    GoalCategory: finalCategory,
                    Timeline,
                    CreatedDate: existingGoal.CreatedDate
                },
                { pool: await poolPromise, userId, excludeGoalId: id }
            );
            if (!valid) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'This goal does not meet SMART criteria required for submission.',
                    errors
                });
            }
        }

        const updateRequest = new sql.Request(transaction);
        updateRequest.input('GoalID', sql.BigInt, id);
        updateRequest.input('GoalNumber', sql.Int, finalGoalNumber);
        updateRequest.input('GoalTitle', sql.NVarChar, finalGoalTitle);
        updateRequest.input('GoalDescription', sql.NVarChar, finalGoalDesc || null);
        updateRequest.input('Measurability', sql.NVarChar, Measurability || null);
        updateRequest.input('JointAccountability', sql.NVarChar, finalJointAcc || null);
        updateRequest.input('Weightage', sql.Decimal(5, 2), Weightage);
        updateRequest.input('Priority', sql.VarChar, Priority);
        updateRequest.input('Timeline', sql.Date, Timeline);
        updateRequest.input('MeetPerformance', sql.NVarChar, finalMeetPerf || null);
        updateRequest.input('ExceedPerformance', sql.NVarChar, finalExceedPerf || null);
        updateRequest.input('ValidationSource', sql.NVarChar, finalValidation || null);
        updateRequest.input('CrossFunctionalGoal', sql.Bit, finalCrossFunc);
        updateRequest.input('GoalCategory', sql.NVarChar, finalCategory || null);
        updateRequest.input('GoalStatus', sql.VarChar, newStatus);

        let updateQuery = `
            UPDATE dbo.Goals SET 
                GoalNumber = @GoalNumber, GoalTitle = @GoalTitle, GoalDescription = @GoalDescription,
                Measurability = @Measurability, JointAccountability = @JointAccountability, Weightage = @Weightage,
                Priority = @Priority, Timeline = @Timeline, MeetPerformance = @MeetPerformance,
                ExceedPerformance = @ExceedPerformance, ValidationSource = @ValidationSource,
                CrossFunctionalGoal = @CrossFunctionalGoal, GoalCategory = @GoalCategory, 
                GoalStatus = @GoalStatus, ModifiedDate = GETDATE()
            WHERE GoalID = @GoalID
        `;

        await updateRequest.query(updateQuery);

        if (currentStatus !== newStatus) {
            await logGoalHistory(transaction, id, 'UPDATE', currentStatus, newStatus, `Status changed from ${currentStatus} to ${newStatus}`, userId);
        } else {
            await logGoalHistory(transaction, id, 'UPDATE', currentStatus, newStatus, 'Goal details updated', userId);
        }

        if (isDraft && SubGoals && SubGoals.length > 0) {
            const deleteSubRequest = new sql.Request(transaction);
            await deleteSubRequest.input('GoalID', sql.BigInt, id).query('DELETE FROM dbo.GoalSubGoals WHERE GoalID = @GoalID');

            for (let i = 0; i < SubGoals.length; i++) {
                const sub = SubGoals[i];
                const subRequest = new sql.Request(transaction);
                subRequest.input('GoalID', sql.BigInt, id);
                subRequest.input('SubGoalNo', sql.Int, i + 1);
                subRequest.input('SubGoalTitle', sql.NVarChar, sub.SubGoalTitle);
                subRequest.input('SubGoalDescription', sql.NVarChar, sub.SubGoalDescription || null);
                subRequest.input('Weightage', sql.Decimal(5, 2), sub.Weightage || 0);
                subRequest.input('Target', sql.NVarChar, sub.Target || null);
                subRequest.input('Status', sql.VarChar, 'Pending');

                await subRequest.query(`
                    INSERT INTO dbo.GoalSubGoals (GoalID, SubGoalNo, SubGoalTitle, SubGoalDescription, Weightage, Target, Status, CreatedDate)
                    VALUES (@GoalID, @SubGoalNo, @SubGoalTitle, @SubGoalDescription, @Weightage, @Target, @Status, GETDATE())
                `);
            }
        }

        await transaction.commit();

        return res.status(200).json({ success: true, message: 'Goal updated successfully.' });

    } catch (error) {
        if (transaction._aborted === false && transaction._acquiredConnection) {
            try { await transaction.rollback(); } catch (rbErr) {}
        }
        console.error('Update Goal Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while updating goal.', errors: error.message });
    }
};

// 5. Delete Goal
const deleteGoal = async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.UserID || req.user?.userId;
    const transaction = new sql.Transaction(await poolPromise);

    try {
        await transaction.begin();

        const checkRequest = new sql.Request(transaction);
        const checkResult = await checkRequest.input('GoalID', sql.BigInt, id)
            .query('SELECT GoalStatus FROM dbo.Goals WHERE GoalID = @GoalID');

        if (checkResult.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Goal not found.' });
        }

        if (checkResult.recordset[0].GoalStatus !== 'Draft') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Only goals in Draft status can be deleted.' });
        }

        await logGoalHistory(transaction, id, 'UPDATE', checkResult.recordset[0].GoalStatus, 'Deleted', 'Goal deleted', userId);

        const delSubReq = new sql.Request(transaction);
        await delSubReq.input('GoalID', sql.BigInt, id).query('DELETE FROM dbo.GoalSubGoals WHERE GoalID = @GoalID');

        const delGoalReq = new sql.Request(transaction);
        await delGoalReq.input('GoalID', sql.BigInt, id).query('DELETE FROM dbo.Goals WHERE GoalID = @GoalID');

        await transaction.commit();
        return res.status(200).json({ success: true, message: 'Goal deleted successfully.' });

    } catch (error) {
        if (transaction._aborted === false && transaction._acquiredConnection) {
            try { await transaction.rollback(); } catch (rbErr) {}
        }
        console.error('Delete Goal Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while updating goal.', errors: error.message });
    }
};

const canApproveOrRejectGoal = async (requesterUserId, goalOwnerUserId) => {
    if (!requesterUserId || !goalOwnerUserId) return false;
    if (Number(requesterUserId) === Number(goalOwnerUserId)) return false;

    const pool = await poolPromise;
    const result = await pool.request()
        .input('UserID', sql.Int, goalOwnerUserId)
        .query(`
            SELECT ReportingManagerID, HODID, BusinessHeadID
            FROM dbo.Users
            WHERE UserID = @UserID
        `);

    const ownerHierarchy = result.recordset[0];
    if (!ownerHierarchy) return false;

    const superiorIds = [
        ownerHierarchy.ReportingManagerID,
        ownerHierarchy.HODID,
        ownerHierarchy.BusinessHeadID,
    ];

    return superiorIds
        .filter((id) => id !== null && id !== undefined && id !== '')
        .some((id) => Number(id) === Number(requesterUserId));
};

// 6. Update Goal Status (Approve / Reject)
const changeGoalStatus = async (req, res) => {
    const { id } = req.params;
    const { goalStatus } = req.body; 
    const userId = req.user?.UserID || req.user?.userId;

    if (!goalStatus) {
        return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const transaction = new sql.Transaction(await poolPromise);

    try {
        await transaction.begin();

        const checkReq = new sql.Request(transaction);
        const oldRes = await checkReq.input('GoalID', sql.BigInt, id).query('SELECT GoalStatus, UserID, GoalTitle FROM dbo.Goals WHERE GoalID = @GoalID');
        if (oldRes.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Goal not found.' });
        }
        const oldStatus = oldRes.recordset[0].GoalStatus;
        const goalOwnerId = oldRes.recordset[0].UserID;
        const goalTitle = oldRes.recordset[0].GoalTitle;

        const isAuthorizedApprover = await canApproveOrRejectGoal(userId, goalOwnerId);
        if (!isAuthorizedApprover) {
            await transaction.rollback();
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to approve or reject this goal.'
            });
        }

        const updateReq = new sql.Request(transaction);
        await updateReq.input('GoalID', sql.BigInt, id)
                       .input('GoalStatus', sql.VarChar, goalStatus)
                       .query(`
                           UPDATE dbo.Goals 
                           SET GoalStatus = @GoalStatus, 
                               ModifiedDate = GETDATE(),
                               ApprovedDate = CASE WHEN @GoalStatus IN ('HOD Approved', 'Business Head Approved', 'Approved') THEN GETDATE() ELSE ApprovedDate END
                           WHERE GoalID = @GoalID
                       `);

        await logGoalHistory(transaction, id, 'UPDATE', oldStatus, goalStatus, `Status updated to ${goalStatus}`, userId);

        await transaction.commit();

        // Notify the employee whose goal this is when it's Approved or Rejected.
        // Notification failures are handled entirely inside notifyUser and never
        // affect this response — the status update has already been committed.
        if (goalStatus === 'Approved' || goalStatus === 'Rejected' || goalStatus.includes('Approved') || goalStatus.includes('Rejected')) {
            try {
                const pool = await poolPromise;
                const employee = await getUserContact(pool, goalOwnerId);
                if (employee) {
                    const isApproved = goalStatus.includes('Approved');
                    const employeeName = `${employee.FirstName} ${employee.LastName}`;
                    const goalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/goals/view/${id}`;

                    await notifyUser(pool, {
                        userId: employee.UserID,
                        title: isApproved ? 'Goal Approved' : 'Goal Rejected',
                        message: isApproved
                            ? `Your goal "${goalTitle}" has been approved (status: ${goalStatus}).`
                            : `Your goal "${goalTitle}" has been rejected (status: ${goalStatus}).`,
                        type: isApproved ? 'GOAL_APPROVED' : 'GOAL_REJECTED',
                        referenceId: Number(id),
                        referenceType: 'Goal',
                        createdBy: userId,
                        emailTo: employee.Email || undefined,
                        emailSubject: isApproved ? `Your Goal Was Approved - ${employeeName}` : `Your Goal Was Rejected - ${employeeName}`,
                        emailHtml: `
                            <h3>Hello ${employee.FirstName || 'there'},</h3>
                            <p>Your goal titled <strong>"${goalTitle}"</strong> has been <strong>${isApproved ? 'approved' : 'rejected'}</strong>.</p>
                            <p>New status: <strong>${goalStatus}</strong></p>
                            <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
                        `
                    });
                }
            } catch (notifyErr) {
                console.error(`[NOTIF FAILED] changeGoalStatus notify step. goalId=${id} userId=${goalOwnerId}:`, notifyErr);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Goal status updated to ${goalStatus} successfully.`
        });
    } catch (error) {
        if (transaction._aborted === false && transaction._acquiredConnection) {
            try { await transaction.rollback(); } catch (rbErr) {}
        }
        console.error('Change Goal Status Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while updating goal status.', errors: error.message });
    }
};

// 7. Submit Review (HOD or Business Head) — advances GoalStatus based on current stage
const submitGoalReview = async (req, res) => {
    const { goalId, rating, comment } = req.body;
    const userId = req.user?.UserID || req.user?.userId;

    if (!goalId || !rating) {
        return res.status(400).json({ success: false, message: 'goalId and rating are required.' });
    }

    // Defines which status comes next depending on the goal's current status.
    // HOD reviews a goal that is 'HOD Approved' -> moves it to 'Reviewed By HOD'
    // Business Head reviews a goal that is 'Reviewed By HOD' -> moves it to 'Review By Business Head'
    const statusFlow = {
        'HOD Approved': 'Reviewed By HOD',
        'Reviewed By HOD': 'Review By Business Head'
    };

    const transaction = new sql.Transaction(await poolPromise);

    try {
        await transaction.begin();

        const checkReq = new sql.Request(transaction);
        const checkRes = await checkReq.input('GoalID', sql.BigInt, goalId)
            .query('SELECT * FROM dbo.Goals WHERE GoalID = @GoalID');

        if (checkRes.recordset.length === 0) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Goal not found.' });
        }

        const existingGoal = checkRes.recordset[0];
        const oldStatus = existingGoal.GoalStatus;
        const newStatus = statusFlow[oldStatus];

console.log('DEBUG → oldStatus:', JSON.stringify(oldStatus), '| newStatus:', JSON.stringify(newStatus), '| userId:', userId);

        if (!newStatus) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Goal cannot be reviewed while in '${oldStatus}' status.`
            });
        }

        const updateReq = new sql.Request(transaction);
        const currentQuarter = `Q${Math.floor(new Date().getMonth() / 3) + 1}`;
        await updateReq.input('GoalID', sql.BigInt, goalId)
            .input('Quarter', sql.VarChar(2), currentQuarter)
            .input('Rating', sql.Int, rating)
            .input('AchievementPercentage', sql.Decimal(5, 2), Number(rating) * 20)
            .input('Comments', sql.NVarChar, comment || null)
            .input('ReviewedBy', sql.Int, userId)
            .input('GoalStatus', sql.VarChar, newStatus)
            .query(`
                MERGE dbo.HODRatings AS target
                USING (SELECT @GoalID AS GoalID, @Quarter AS Quarter) AS source
                ON target.GoalID = source.GoalID AND target.Quarter = source.Quarter
                WHEN MATCHED THEN UPDATE SET
                    Rating = @Rating,
                    AchievementPercentage = @AchievementPercentage,
                    Comments = @Comments,
                    ReviewedBy = @ReviewedBy,
                    ReviewedDate = GETDATE(),
                    ModifiedDate = GETDATE()
                WHEN NOT MATCHED THEN INSERT
                    (GoalID, Quarter, Rating, AchievementPercentage, Comments, ReviewedBy)
                    VALUES (@GoalID, @Quarter, @Rating, @AchievementPercentage, @Comments, @ReviewedBy);

                UPDATE dbo.Goals
                SET GoalStatus = @GoalStatus,
                    ModifiedDate = GETDATE()
                WHERE GoalID = @GoalID;
            `);

        await logGoalHistory(
            transaction,
            goalId,
            'UPDATE',
            oldStatus,
            newStatus,
            `Reviewed with rating ${rating}/5. Comment: ${comment || 'No comment provided'}`,
            userId
        );

        await transaction.commit();

        // Notify the relevant people that a review was submitted. This never
        // affects the response — the review has already been committed.
        try {
            const pool = await poolPromise;
            const employee = await getUserContact(pool, existingGoal.UserID);
            const isBusinessHeadReview = oldStatus === 'Reviewed By HOD'; // Business Head / CFO stage
            const goalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/goals/view/${goalId}`;

            if (employee) {
                const employeeName = `${employee.FirstName} ${employee.LastName}`;

                if (!isBusinessHeadReview) {
                    // HOD review stage: notify the employee only.
                    await notifyUser(pool, {
                        userId: employee.UserID,
                        title: 'Goal Reviewed',
                        message: `Your goal "${existingGoal.GoalTitle}" was reviewed with a rating of ${rating}/5. Comment: ${comment || 'No comment provided'}`,
                        type: 'GOAL_REVIEWED',
                        referenceId: Number(goalId),
                        referenceType: 'Goal',
                        createdBy: userId,
                        emailTo: employee.Email || undefined,
                        emailSubject: `Your Goal Was Reviewed - ${employeeName}`,
                        emailHtml: `
                            <h3>Hello ${employee.FirstName || 'there'},</h3>
                            <p>Your goal titled <strong>"${existingGoal.GoalTitle}"</strong> has been reviewed.</p>
                            <p>Rating: <strong>${rating}/5</strong></p>
                            <p>Comment: ${comment || 'No comment provided'}</p>
                            <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
                        `
                    });
                } else {
                    // Business Head / CFO review stage: notify the employee AND the HOD
                    // who approved this goal earlier, so both know the CFO reviewed it.
                    await notifyUser(pool, {
                        userId: employee.UserID,
                        title: 'Goal Reviewed by Business Head/CFO',
                        message: `Your goal "${existingGoal.GoalTitle}" was reviewed by the Business Head/CFO with a rating of ${rating}/5. Comment: ${comment || 'No comment provided'}`,
                        type: 'CFO_REVIEWED',
                        referenceId: Number(goalId),
                        referenceType: 'Goal',
                        createdBy: userId,
                        emailTo: employee.Email || undefined,
                        emailSubject: `Your Goal Was Reviewed by Business Head/CFO - ${employeeName}`,
                        emailHtml: `
                            <h3>Hello ${employee.FirstName || 'there'},</h3>
                            <p>Your goal titled <strong>"${existingGoal.GoalTitle}"</strong> has been reviewed by the Business Head/CFO.</p>
                            <p>Rating: <strong>${rating}/5</strong></p>
                            <p>Comment: ${comment || 'No comment provided'}</p>
                            <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
                        `
                    });

                    if (employee.HODID) {
                        const hod = await getUserContact(pool, employee.HODID);
                        if (hod) {
                            await notifyUser(pool, {
                                userId: hod.UserID,
                                title: 'Goal Reviewed by Business Head/CFO',
                                message: `The goal "${existingGoal.GoalTitle}" (${employeeName}), which you approved, was reviewed by the Business Head/CFO with a rating of ${rating}/5.`,
                                type: 'CFO_REVIEWED',
                                referenceId: Number(goalId),
                                referenceType: 'Goal',
                                createdBy: userId,
                                emailTo: hod.Email || undefined,
                                emailSubject: `Goal You Approved Was Reviewed by Business Head/CFO - ${employeeName}`,
                                emailHtml: `
                                    <h3>Hello ${hod.FirstName || 'there'},</h3>
                                    <p>The goal titled <strong>"${existingGoal.GoalTitle}"</strong> belonging to <strong>${employeeName}</strong>, which you previously approved, has now been reviewed by the Business Head/CFO.</p>
                                    <p>Rating: <strong>${rating}/5</strong></p>
                                    <p>Comment: ${comment || 'No comment provided'}</p>
                                    <a href="${goalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">View Goal</a>
                                `
                            });
                        }
                    }
                }
            }
        } catch (notifyErr) {
            console.error(`[NOTIF FAILED] submitGoalReview notify step. goalId=${goalId} userId=${existingGoal.UserID}:`, notifyErr);
        }

        return res.status(200).json({
            success: true,
            message: `Feedback submitted successfully. Goal status updated to '${newStatus}'.`
        });

    } catch (error) {
        if (transaction._aborted === false && transaction._acquiredConnection) {
            try { await transaction.rollback(); } catch (rbErr) {}
        }
        console.error('Submit Goal Review Error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error while submitting feedback.', errors: error.message });
    }
};

module.exports = {
    getGoals,
    getGoalById,
    createGoal,
    updateGoal,
    deleteGoal,
    changeGoalStatus,
    submitGoalReview
};