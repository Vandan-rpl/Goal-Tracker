const { sql, poolPromise } = require("../config/db");

/**
 * ============================================================
 * Auth Model
 * Enterprise Goal Tracker Management System
 * Microsoft SQL Server
 * ============================================================
 */

/**
 * Find user by ID
 */
const getUserById = async (userId) => {
  try {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("UserID", sql.Int, userId);

    const result = await request.query(`
      SELECT TOP 1 *
      FROM Users
      WHERE UserID = @UserID
    `);

    return result.recordset[0];
  } catch (error) {
    console.error("Error in getUserById:", error);
    throw error;
  }
};

/**
 * Find user by Employee Code
 */
const getUserByEmployeeCode = async (employeeCode) => {
  if (!employeeCode) return null;

  try {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("EmployeeCode", sql.VarChar, employeeCode);

    const result = await request.query(`
      SELECT TOP 1 *
      FROM Users
      WHERE EmployeeCode = @EmployeeCode
    `);

    return result.recordset[0];
  } catch (error) {
    console.error("Error in getUserByEmployeeCode:", error);
    throw error;
  }
};

/**
 * Find user by Username
 */
const getUserByUsername = async (username) => {
  if (!username) return null;

  try {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("Username", sql.VarChar, username);

    const result = await request.query(`
      SELECT TOP 1 *
      FROM Users
      WHERE Username = @Username
    `);

    return result.recordset[0];
  } catch (error) {
    console.error("Error in getUserByUsername:", error);
    throw error;
  }
};

/**
 * Find user by Email
 */
const getUserByEmail = async (email) => {
  if (!email) return null;

  try {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("Email", sql.NVarChar, email);

    const result = await request.query(`
      SELECT TOP 1 *
      FROM Users
      WHERE Email = @Email
    `);

    return result.recordset[0];
  } catch (error) {
    console.error("Error in getUserByEmail:", error);
    throw error;
  }
};

/**
 * Find user by Login ID (Username or Email)
 */
const getUserByLogin = async (loginId) => {
  if (!loginId) return null;

  try {
    const pool = await poolPromise;
    const request = pool.request();
    request.input("LoginId", sql.VarChar, loginId);

    const result = await request.query(`
      SELECT TOP 1 *
      FROM Users
      WHERE Username = @LoginId OR Email = @LoginId
    `);

    return result.recordset[0];
  } catch (error) {
    console.error("Error in getUserByLogin:", error);
    throw error;
  }
};

/**
 * Create a new User
 */
const createUser = async (userData) => {
  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input("EmployeeCode", sql.VarChar, userData.EmployeeCode || null);
    request.input("Username", sql.VarChar, userData.Username);
    request.input("PasswordHash", sql.NVarChar, userData.PasswordHash);
    request.input("Email", sql.NVarChar, userData.Email);
    request.input("FirstName", sql.NVarChar, userData.FirstName);
    request.input("LastName", sql.NVarChar, userData.LastName || null);
    request.input("MobileNo", sql.VarChar, userData.MobileNo || null);
    request.input("DepartmentID", sql.Int, userData.DepartmentID || null);
    request.input("Designation", sql.NVarChar, userData.Designation || null);
    request.input("Grade", sql.NVarChar, userData.Grade || null);
    request.input("Post", sql.VarChar, userData.Post || null);
    request.input("ReportingManagerID", sql.Int, userData.ReportingManagerID || null);
    request.input("HODID", sql.Int, userData.HODID || null);
    request.input("BusinessHeadID", sql.Int, userData.BusinessHeadID || null);
    request.input("Role", sql.VarChar, userData.Role);
    request.input("IsActive", sql.Bit, userData.IsActive !== undefined ? userData.IsActive : 1);
    request.input("IsPasswordChanged", sql.Bit, userData.IsPasswordChanged || 0);

    const result = await request.query(`
      INSERT INTO Users (
        EmployeeCode, Username, PasswordHash, Email, FirstName, LastName, 
        MobileNo, DepartmentID, Designation, Grade, Post, ReportingManagerID, 
        HODID, BusinessHeadID, Role, IsActive, IsPasswordChanged, CreatedDate
      )
      OUTPUT INSERTED.UserID
      VALUES (
        @EmployeeCode, @Username, @PasswordHash, @Email, @FirstName, @LastName, 
        @MobileNo, @DepartmentID, @Designation, @Grade, @Post, @ReportingManagerID, 
        @HODID, @BusinessHeadID, @Role, @IsActive, @IsPasswordChanged, GETDATE()
      )
    `);

    return result.recordset[0];
  } catch (error) {
    console.error("Error in createUser:", error);
    throw error;
  }
};

/**
 * Change Password
 */
const changePassword = async (passwordData) => {
  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input("UserID", sql.Int, passwordData.UserID);
    request.input("PasswordHash", sql.NVarChar, passwordData.PasswordHash);
    request.input("IsPasswordChanged", sql.Bit, passwordData.IsPasswordChanged);

    await request.query(`
      UPDATE Users
      SET PasswordHash = @PasswordHash,
          IsPasswordChanged = @IsPasswordChanged,
          PasswordChangedDate = GETDATE(),
          ModifiedDate = GETDATE()
      WHERE UserID = @UserID
    `);

    return true;
  } catch (error) {
    console.error("Error in changePassword:", error);
    throw error;
  }
};

module.exports = {
  getUserById,
  getUserByEmployeeCode,
  getUserByUsername,
  getUserByEmail,
  getUserByLogin,
  createUser,
  changePassword,
};