const { sql, poolPromise } = require("../config/database");

/**
 * Creates a new user record in the SQL Server database
 * @param {Object} userData - User record information
 * @returns {Object} Newly created user profile
 */
async function createUser(userData) {
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input("EmployeeCode", sql.VarChar, userData.EmployeeCode)
            .input("Username", sql.VarChar, userData.Username)
            .input("Email", sql.VarChar, userData.Email)
            .input("PasswordHash", sql.VarChar, userData.PasswordHash)
            .input("FirstName", sql.VarChar, userData.FirstName)
            .input("LastName", sql.VarChar, userData.LastName)
            .input("MobileNo", sql.VarChar, userData.MobileNo)
            .input("DepartmentID", sql.Int, userData.DepartmentID)
            .input("Designation", sql.VarChar, userData.Designation)
            .input("Grade", sql.VarChar, userData.Grade)
            .input("Post", sql.VarChar, userData.Post)
            .input("ReportingManagerID", sql.Int, userData.ReportingManagerID)
            .input("HODID", sql.Int, userData.HODID)
            .input("BusinessHeadID", sql.Int, userData.BusinessHeadID)
            .input("Role", sql.VarChar, userData.Role)
            .input("IsPasswordChanged", sql.Bit, userData.IsPasswordChanged || 0)
            .query(`
                INSERT INTO Users (
                    EmployeeCode, Username, Email, PasswordHash, FirstName, LastName, 
                    MobileNo, DepartmentID, Designation, Grade, Post, 
                    ReportingManagerID, HODID, BusinessHeadID, Role, IsPasswordChanged, CreatedDate
                )
                OUTPUT INSERTED.*
                VALUES (
                    @EmployeeCode, @Username, @Email, @PasswordHash, @FirstName, @LastName, 
                    @MobileNo, @DepartmentID, @Designation, @Grade, @Post, 
                    @ReportingManagerID, @HODID, @BusinessHeadID, @Role, @IsPasswordChanged, GETDATE()
                );
            `);
        return result.recordset[0];
    } catch (error) {
        throw error;
    }
}

/**
 * Updates a user's password and shifts the first-login flag status
 * @param {number} userId - The unique user identity index
 * @param {string} newPasswordHash - Pre-hashed credential string
 */
async function updatePassword(userId, newPasswordHash) {
    try {
        const pool = await poolPromise;
        await pool.request()
            .input("UserID", sql.Int, userId)
            .input("PasswordHash", sql.VarChar, newPasswordHash)
            .query(`
                UPDATE Users 
                SET PasswordHash = @PasswordHash, 
                    IsPasswordChanged = 1, 
                    ModifiedDate = GETDATE() 
                WHERE UserID = @UserID
            `);
        return true;
    } catch (error) {
        throw error;
    }
}

module.exports = {
    createUser,
    updatePassword,
    // Export existing query wrappers (e.g., findByUsername, findByEmployeeCode, etc.)
};