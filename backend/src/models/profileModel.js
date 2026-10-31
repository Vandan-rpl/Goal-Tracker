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

// Roles that can be picked as Reporting Manager or HOD (any department).
const APPROVER_ROLES = "'Manager', 'HOD', 'BusinessHead'";

/**
 * Reporting Manager / HOD options for a user: active Managers, HODs and Business Heads from any
 * department (IsEligible = 1), plus the user's currently assigned Reporting Manager and HOD even
 * if they no longer qualify. The user themselves is never listed.
 */
exports.getApprovers = async (userId) => {
    const pool = await poolPromise;
    const result = await pool.request().input("UserId", sql.Int, userId).query(`
        SELECT candidate.UserID, candidate.FirstName, candidate.LastName, candidate.Designation,
               candidate.Role, candidate.IsActive, dept.DepartmentName,
               CAST(CASE WHEN candidate.IsActive = 1 AND candidate.Role IN (${APPROVER_ROLES})
                         THEN 1 ELSE 0 END AS BIT) AS IsEligible
        FROM dbo.Users owner
        INNER JOIN dbo.Users candidate ON candidate.UserID <> owner.UserID
            AND (
                (candidate.IsActive = 1 AND candidate.Role IN (${APPROVER_ROLES}))
                OR candidate.UserID = owner.ReportingManagerID
                OR candidate.UserID = owner.HODID
            )
        LEFT JOIN dbo.Departments dept ON dept.DepartmentID = candidate.DepartmentID
        WHERE owner.UserID = @UserId
        ORDER BY candidate.FirstName, candidate.LastName
    `);
    return result.recordset;
};

// Each choice must be an active Manager / HOD / Business Head, or the person already assigned.
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
              AND (@ReportingManagerID IS NULL OR @ReportingManagerID = employee.ReportingManagerID OR EXISTS (
                  SELECT 1 FROM dbo.Users candidate
                  WHERE candidate.UserID = @ReportingManagerID
                    AND candidate.IsActive = 1 AND candidate.Role IN (${APPROVER_ROLES})
                    AND candidate.UserID <> employee.UserID
              ))
              AND (@HODID IS NULL OR @HODID = employee.HODID OR EXISTS (
                  SELECT 1 FROM dbo.Users candidate
                  WHERE candidate.UserID = @HODID
                    AND candidate.IsActive = 1 AND candidate.Role IN (${APPROVER_ROLES})
                    AND candidate.UserID <> employee.UserID
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
 * Update User Password Hash, inside the caller's transaction (`db`).
 * Only while the stored hash is still `oldPasswordHash` (the one the
 * password checks ran against). Returns true if the row was updated.
 */
exports.updatePassword = async (db, userId, passwordHash, oldPasswordHash) => {
    try {
        const result = await db.request()
            .input("UserId", sql.Int, userId)
            .input("PasswordHash", sql.NVarChar, passwordHash)
            .input("OldPasswordHash", sql.NVarChar, oldPasswordHash)
            .query(`
                UPDATE Users 
                SET PasswordHash = @PasswordHash,
                    IsPasswordChanged = 1,
                    DefaultPasswordFlag = 0,
                    PasswordChangedDate = GETDATE(),
                    ModifiedDate = GETDATE() 
                WHERE UserID = @UserId AND PasswordHash = @OldPasswordHash
            `);

        return result.rowsAffected[0] === 1;
    } catch (error) {
        console.error("Model updatePassword Error:", error);
        throw error;
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
