const { poolPromise, sql } = require('../config/db');

const getTeamMembersByManager = async (managerId) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input('ManagerID', sql.Int, managerId);

    const result = await request.query(`
        SELECT 
            u.UserID, 
            u.EmployeeCode, 
            u.Username, 
            u.FirstName, 
            u.LastName, 
            u.Email, 
            u.Designation, 
            u.Role,
            (SELECT COUNT(*) FROM dbo.Goals g WHERE g.UserID = u.UserID AND g.IsDeleted = 0) AS TotalGoals
        FROM dbo.Users u
        WHERE (u.ReportingManagerID = @ManagerID OR u.HODID = @ManagerID)
          AND u.UserID <> @ManagerID
    `);

    return result.recordset;
};

const getManagersByBusinessHead = async (businessHeadId) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input('BusinessHeadID', sql.Int, businessHeadId);

    const result = await request.query(`
        SELECT 
            u.UserID, 
            u.EmployeeCode, 
            u.Username, 
            u.FirstName, 
            u.LastName, 
            u.Email, 
            u.Designation, 
            u.Role,
            (SELECT COUNT(*) FROM dbo.Goals g WHERE g.UserID = u.UserID AND g.IsDeleted = 0) AS TotalGoals
        FROM dbo.Users u
        WHERE u.BusinessHeadID = @BusinessHeadID
          AND u.UserID <> @BusinessHeadID
    `);

    return result.recordset;
};

const getUserGoalsForManager = async (userId) => {
    const pool = await poolPromise;
    const request = pool.request();
    request.input('UserID', sql.Int, userId);

    const result = await request.query(`
        SELECT g.*, 
               u.FirstName, u.LastName, u.EmployeeCode
        FROM dbo.Goals g
        JOIN dbo.Users u ON g.UserID = u.UserID
        WHERE g.UserID = @UserID
        ORDER BY g.CreatedDate DESC
    `);

    return result.recordset;
};

module.exports = {
    getTeamMembersByManager,
    getManagersByBusinessHead,
    getUserGoalsForManager
};