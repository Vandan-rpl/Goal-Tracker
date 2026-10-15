const { poolPromise, sql } = require("../config/db");

/**
 * ============================================================
 * Profile Model
 * Enterprise Goal Tracker Management System
 * ============================================================
 */

/**
 * Get User Profile by User ID matching the Users table structure
 */
exports.getProfile = async (userId) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input("UserId", sql.Int, userId)
            .query(`
                SELECT 
                    UserID, 
                    EmployeeCode,
                    Username,
                    Email, 
                    FirstName, 
                    LastName, 
                    MobileNo, 
                    DepartmentID,
                    ReportingManagerID,
                    HODID,
                    Designation,
                    Grade,
                    Post,
                    Role,
                    IsActive
                FROM Users
                WHERE UserID = @UserId
            `);

        return result.recordset[0] || null;
    } catch (error) {
        console.error("Model getProfile Error:", error);
        throw error;
    }
};

exports.getDepartmentApprovers = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT colleague.UserID, colleague.FirstName, colleague.LastName, colleague.Designation
        FROM dbo.Users owner
        INNER JOIN dbo.Users colleague ON colleague.DepartmentID = owner.DepartmentID
        WHERE owner.UserID = @UserId AND colleague.UserID <> @UserId AND colleague.IsActive = 1
        ORDER BY colleague.FirstName, colleague.LastName
    `);
    return result.recordset;
};

exports.updateHierarchy = async (userId, reportingManagerId, hodId) => {
    const pool = await poolPromise;
    const result = await pool.request()
        .input("UserId", sql.Int, userId)
        .input("ReportingManagerID", sql.Int, reportingManagerId)
        .input("HODID", sql.Int, hodId)
        .query(`
            UPDATE employee
            SET ReportingManagerID = @ReportingManagerID,
                HODID = @HODID,
                ModifiedDate = GETDATE()
            FROM dbo.Users employee
            WHERE employee.UserID = @UserId
              AND (@ReportingManagerID IS NULL OR EXISTS (
                  SELECT 1 FROM dbo.Users candidate
                  WHERE candidate.UserID = @ReportingManagerID
                    AND candidate.DepartmentID = employee.DepartmentID
                    AND candidate.IsActive = 1 AND candidate.UserID <> employee.UserID
              ))
              AND (@HODID IS NULL OR EXISTS (
                  SELECT 1 FROM dbo.Users candidate
                  WHERE candidate.UserID = @HODID
                    AND candidate.DepartmentID = employee.DepartmentID
                    AND candidate.IsActive = 1 AND candidate.UserID <> employee.UserID
              ))
        `);
    return result.rowsAffected?.[0] > 0;
};

/**
 * Update User Profile Information
 */
exports.updateProfile = async (userId, data) => {
    try {
        const pool = await poolPromise;

        await pool.request()
            .input("UserId", sql.Int, userId)
            .input("FirstName", sql.VarChar, data.firstName)
            .input("LastName", sql.VarChar, data.lastName)
            .input("Email", sql.VarChar, data.email)
            .input("MobileNo", sql.VarChar, data.mobileNo || null)
            .query(`
                UPDATE Users 
                SET FirstName = @FirstName,
                    LastName = @LastName,
                    Email = @Email,
                    MobileNo = @MobileNo,
                    ModifiedDate = GETDATE()
                WHERE UserID = @UserId
            `);

        return true;
    } catch (error) {
        console.error("Model updateProfile Error:", error);
        throw error;
    }
};

/**
 * Get Password Hash for Password Verification
 */
exports.getPasswordHash = async (userId) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input("UserId", sql.Int, userId)
            .query("SELECT PasswordHash FROM Users WHERE UserID = @UserId");

        return result.recordset[0] || null;
    } catch (error) {
        console.error("Model getPasswordHash Error:", error);
        throw error;
    }
};

/**
 * Update User Password Hash
 */
exports.updatePassword = async (userId, passwordHash) => {
    try {
        const pool = await poolPromise;

        await pool.request()
            .input("UserId", sql.Int, userId)
            .input("PasswordHash", sql.VarChar, passwordHash)
            .query(`
                UPDATE Users 
                SET PasswordHash = @PasswordHash, 
                    IsPasswordChanged = 1, 
                    PasswordChangedDate = GETDATE(),
                    ModifiedDate = GETDATE() 
                WHERE UserID = @UserId
            `);

        return true;
    } catch (error) {
        console.error("Model updatePassword Error:", error);
        throw error;
    }
};

/**
 * Save Password History (Optional / If table exists)
 */
exports.savePasswordHistory = async (userId, passwordHash) => {
    try {
        return true;
    } catch (error) {
        console.error("Model savePasswordHistory Error:", error);
    }
};

/**
 * Upload/Update Profile Avatar Filename
 */
exports.uploadAvatar = async (userId, filename) => {
    try {
        return true;
    } catch (error) {
        console.error("Model uploadAvatar Error:", error);
        throw error;
    }
};

/**
 * Remove Profile Avatar
 */
exports.removeAvatar = async (userId) => {
    try {
        return true;
    } catch (error) {
        console.error("Model removeAvatar Error:", error);
        throw error;
    }
};

/**
 * Get User Login History
 */
exports.getLoginHistory = async (userId) => {
    try {
        const pool = await poolPromise;

        const result = await pool.request()
            .input("UserId", sql.Int, userId)
            .query("SELECT TOP 10 * FROM LoginHistory WHERE UserID = @UserId ORDER BY LoginTime DESC");

        return result.recordset || [];
    } catch (error) {
        console.error("Model getLoginHistory Error:", error);
        return [];
    }
};
