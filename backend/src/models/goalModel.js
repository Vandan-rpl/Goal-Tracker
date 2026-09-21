const { sql, poolPromise } = require("../config/db");

const getGoalsByUserId = async (userId) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("UserID", sql.Int, userId);

    const result = await request.query(`
        SELECT g.*, u.Username, u.FirstName, u.LastName 
        FROM dbo.Goals g
        JOIN dbo.Users u ON g.UserID = u.UserID
        WHERE g.UserID = @UserID
        ORDER BY g.CreatedDate DESC
    `);
    return result.recordset;
};

const getTeamGoalsByManagerId = async (managerId) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("ManagerID", sql.Int, managerId);

    const result = await request.query(`
        SELECT g.*, u.Username, u.FirstName, u.LastName, u.Designation
        FROM dbo.Goals g
        JOIN dbo.Users u ON g.UserID = u.UserID
        WHERE (u.ReportingManagerID = @ManagerID OR u.HODID = @ManagerID)
          AND g.UserID <> @ManagerID
        ORDER BY g.CreatedDate DESC
    `);
    return result.recordset;
};

const getManagersGoalsByBusinessHeadId = async (businessHeadId) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("BusinessHeadID", sql.Int, businessHeadId);

    const result = await request.query(`
        SELECT g.*, u.Username, u.FirstName, u.LastName, u.Designation
        FROM dbo.Goals g
        JOIN dbo.Users u ON g.UserID = u.UserID
        WHERE u.BusinessHeadID = @BusinessHeadID
          AND g.UserID <> @BusinessHeadID
          AND (
              (u.ReportingManagerID IS NULL AND u.HODID IS NULL)
              OR u.ReportingManagerID = @BusinessHeadID
              OR u.HODID = @BusinessHeadID
          )
        ORDER BY g.CreatedDate DESC
    `);
    return result.recordset;
};

const updateGoalStatus = async (goalId, goalStatus) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("GoalID", sql.BigInt, goalId);
    request.input("GoalStatus", sql.VarChar, goalStatus);

    const result = await request.query(`
        UPDATE dbo.Goals
        SET GoalStatus = @GoalStatus,
            ModifiedDate = GETDATE(),
            ApprovedDate = CASE WHEN @GoalStatus IN ('HOD Approved', 'Business Head Approved', 'Approved') THEN GETDATE() ELSE ApprovedDate END
        WHERE GoalID = @GoalID;
        
        SELECT @@ROWCOUNT AS AffectedRows;
    `);
    return result.recordset[0].AffectedRows > 0;
};

const getGoalById = async (goalId) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("GoalID", sql.BigInt, goalId);

    const result = await request.query(`
        SELECT * FROM dbo.Goals WHERE GoalID = @GoalID
    `);
    return result.recordset[0];
};

const getActiveWeightageSumForQuarter = async (userId, quarter, excludeGoalId = null) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("UserID", sql.Int, userId);
    request.input("Quarter", sql.VarChar, quarter);

    let query = `
        SELECT ISNULL(SUM(Weightage), 0) AS TotalWeightage
        FROM dbo.Goals
        WHERE UserID = @UserID
          AND Quarter = @Quarter
          AND GoalStatus NOT IN ('Rejected', 'Cancelled')
    `;

    if (excludeGoalId) {
        request.input("ExcludeGoalID", sql.BigInt, excludeGoalId);
        query += ` AND GoalID <> @ExcludeGoalID`;
    }

    const result = await request.query(query);
    return result.recordset[0].TotalWeightage;
};

const getSubGoalsByGoalId = async (goalId) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("GoalID", sql.BigInt, goalId);

    const result = await request.query(`
        SELECT * FROM dbo.GoalSubGoals WHERE GoalID = @GoalID
    `);
    return result.recordset;
};

const updateSubGoalStatus = async (goalId, subGoalId, status) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("GoalID", sql.BigInt, goalId);
    request.input("SubGoalID", sql.BigInt, subGoalId);
    request.input("Status", sql.VarChar, status);

    const result = await request.query(`
        UPDATE dbo.GoalSubGoals
        SET Status = @Status
        WHERE GoalID = @GoalID AND SubGoalID = @SubGoalID;

        SELECT @@ROWCOUNT AS AffectedRows;
    `);
    return result.recordset[0].AffectedRows > 0;
};

const carryForwardGoal = async (goalId) => {
    const pool = await poolPromise;

    const goal = await getGoalById(goalId);
    if (!goal) {
        return { success: false, message: "Goal not found.", errors: [] };
    }

    const subGoals = await getSubGoalsByGoalId(goalId);
    const completedWeightage = subGoals
        .filter(sg => sg.Status === "Completed")
        .reduce((sum, sg) => sum + Number(sg.Weightage), 0);

    if (subGoals.length > 0 && completedWeightage === 100) {
        return { success: false, message: "All sub-goals are complete — mark the goal Completed instead of carrying it forward.", errors: [] };
    }

    const { getNextFiscalQuarter } = require("../utils/fiscalQuarter");
    const { label: nextQuarter, quarterEndDate: nextQuarterEnd } = getNextFiscalQuarter(goal.QuarterEndDate);

    const request = pool.request();
    request.input("GoalID", sql.BigInt, goalId);
    request.input("FromQuarter", sql.VarChar, goal.Quarter);
    request.input("ToQuarter", sql.VarChar, nextQuarter);
    request.input("Progress", sql.Decimal(5, 2), completedWeightage);

    await request.query(`
        INSERT INTO dbo.GoalCarryForwardHistory (GoalID, FromQuarter, ToQuarter, ProgressAtCarryForward)
        VALUES (@GoalID, @FromQuarter, @ToQuarter, @Progress)
    `);

    const updateRequest = pool.request();
    updateRequest.input("GoalID", sql.BigInt, goalId);
    updateRequest.input("Quarter", sql.VarChar, nextQuarter);
    updateRequest.input("QuarterEndDate", sql.Date, nextQuarterEnd);
    updateRequest.input("Timeline", sql.Date, nextQuarterEnd);

    await updateRequest.query(`
        UPDATE dbo.Goals SET
            Quarter = @Quarter,
            QuarterEndDate = @QuarterEndDate,
            Timeline = @Timeline,
            GoalStatus = 'Submitted',
            SubmittedDate = GETDATE(),
            ApprovedDate = NULL,
            BusinessHeadApprovedBy = NULL,
            BusinessHeadApprovedDate = NULL,
            CarryForwardCount = CarryForwardCount + 1,
            ModifiedDate = GETDATE()
        WHERE GoalID = @GoalID
    `);

    return { success: true, message: `Goal carried forward to ${nextQuarter} and resubmitted for approval.`, errors: [] };
};

module.exports = {
    getGoalsByUserId,
    getTeamGoalsByManagerId,
    getManagersGoalsByBusinessHeadId,
    updateGoalStatus,
    getGoalById,
    getActiveWeightageSumForQuarter,
    getSubGoalsByGoalId,
    updateSubGoalStatus,
    carryForwardGoal,
};