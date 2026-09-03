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

module.exports = {
    getGoalsByUserId,
    getTeamGoalsByManagerId,
    getManagersGoalsByBusinessHeadId,
    updateGoalStatus
};