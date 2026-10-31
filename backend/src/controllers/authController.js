const { poolPromise, sql } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// -----------------------------------------------------------------------
// FIX: SQL Server BIT columns come back from the `mssql` driver as native
// JS booleans (true/false), not integers. Strict comparisons like
// `user.IsPasswordChanged === 1` will ALWAYS be false, no matter what is
// stored in the DB. This helper normalizes bit/boolean/string values
// (1, "1", true) to a real boolean so comparisons work no matter how the
// driver/config returns them.
// -----------------------------------------------------------------------
const toBool = (value) => value === true || value === 1 || value === "1";

// User Login Controller
const login = async (req, res) => {
  const username = req.body.username || req.body.email || req.body.identifier;
  const { password } = req.body;

  if (!username) {
    return res.status(400).json({
      success: false,
      message: "Username or Email is required.",
    });
  }

  if (!password) {
    return res.status(400).json({
      success: false,
      message: "Password is required.",
    });
  }

  try {
    const pool = await poolPromise;

    const result = await pool
      .request()
      .input("Identifier", sql.VarChar, username).query(`
                SELECT TOP 1 
                    UserID, Username, FirstName, LastName, PasswordHash, Email, Role, IsPasswordChanged, 
                    IsLocked, FailedLoginCount, DefaultPasswordFlag 
                FROM Users 
                WHERE (Username = @Identifier OR Email = @Identifier) AND IsActive = 1
            `);

    if (result.recordset.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Username or Email is incorrect.",
      });
    }

    const user = result.recordset[0];

    // FIX: was `user.IsLocked === 1` — this NEVER fired because
    // IsLocked is a boolean from the driver, not the integer 1.
    if (toBool(user.IsLocked)) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been locked due to multiple failed login attempts. Please contact admin.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      await pool
        .request()
        .input("UserID", sql.Int, user.UserID)
        .query(
          "UPDATE Users SET FailedLoginCount = FailedLoginCount + 1 WHERE UserID = @UserID",
        );

      return res.status(401).json({
        success: false,
        message: "Password is incorrect.",
      });
    }

    if (user.FailedLoginCount > 0) {
      await pool
        .request()
        .input("UserID", sql.Int, user.UserID)
        .query("UPDATE Users SET FailedLoginCount = 0 WHERE UserID = @UserID");
    }

    // FIX: normalize once, use the same normalized value everywhere below
    // instead of re-comparing against 1 / 0 in three different places.
    const isPasswordChanged = toBool(user.IsPasswordChanged);
    const defaultPasswordFlag = toBool(user.DefaultPasswordFlag);

    const token = jwt.sign(
      {
        userId: user.UserID,
        username: user.Username,
        role: user.Role,
        isPasswordChanged,
      },
      process.env.JWT_SECRET || "default_jwt_secret",
      { expiresIn: "8h" },
    );

    const fullName = [user.FirstName, user.LastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    return res.status(200).json({
      success: true,
      message: !isPasswordChanged
        ? "Login successful. Password reset required."
        : "Login successful.",
      data: {
        token,
        isPasswordChanged,
        defaultPasswordFlag,
        username: user.Username,
        email: user.Email,
        role: user.Role,
        firstName: user.FirstName || "",
        lastName: user.LastName || "",
        fullName,
        FullName: fullName,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during login.",
      errors: error.message,
    });
  }
};

// Force Reset Password Controller (Required on First Login / Default Password)
const forceResetPassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.userId; // Extracted from token middleware

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Current password and new password are required.",
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 6 characters long.",
    });
  }

  try {
    const pool = await poolPromise;

    const userResult = await pool
      .request()
      .input("UserID", sql.Int, userId)
      .query("SELECT UserID, PasswordHash FROM Users WHERE UserID = @UserID");

    if (userResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const user = userResult.recordset[0];

    const isMatch = await bcrypt.compare(currentPassword, user.PasswordHash);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect." });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    // Explicitly set IsPasswordChanged = 1 and clear DefaultPasswordFlag
    await pool
      .request()
      .input("UserID", sql.Int, userId)
      .input("PasswordHash", sql.NVarChar, newPasswordHash).query(`
                UPDATE Users 
                SET PasswordHash = @PasswordHash, 
                    IsPasswordChanged = 1, 
                    DefaultPasswordFlag = 0,
                    PasswordChangedDate = GETDATE(),
                    ModifiedDate = GETDATE() 
                WHERE UserID = @UserID
            `);

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now access the dashboard.",
    });
  } catch (error) {
    console.error("Password Reset Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during password reset.",
      errors: error.message,
    });
  }
};

module.exports = {
  login,
  forceResetPassword,
};
