const { poolPromise, sql } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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

// Forgot Password Controller (Generates Token & Sends Email)
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: "Email is required." });
  }

  try {
    const pool = await poolPromise;

    const userResult = await pool
      .request()
      .input("Email", sql.VarChar, email)
      .query(
        "SELECT TOP 1 UserID, Username, Email FROM Users WHERE Email = @Email AND IsActive = 1",
      );

    if (userResult.recordset.length === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "User with this email does not exist.",
        });
    }

    const user = userResult.recordset[0];

    const resetToken = jwt.sign(
      { userId: user.UserID, email: user.Email },
      process.env.JWT_SECRET || "default_jwt_secret",
      { expiresIn: "15m" },
    );

    const resetLink = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`;
    await transporter.sendMail({
      from: `"Goal Tracker" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
                <h3>Password Reset Request</h3>
                <p>Hello ${user.Username},</p>
                <p>Click the link below to reset your password (Link valid for 15 minutes):</p>
                <a href="${resetLink}" target="_blank">Reset Password</a>
                <p>If you didn't request this, please ignore this email.</p>
            `,
    });

    return res.status(200).json({
      success: true,
      message: "Password reset instructions sent to your email.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Internal server error while sending reset email.",
      });
  }
};

// Reset Password with Token (Public Route - No verifyToken Middleware required)
const resetPasswordWithToken = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Token and new password are required.",
      });
  }

  if (newPassword.length < 6) {
    return res
      .status(400)
      .json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "default_jwt_secret",
    );
    const userId = decoded.userId;

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    const pool = await poolPromise;
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
      message:
        "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error("Token Reset Error:", error);
    return res.status(400).json({
      success: false,
      message: "Invalid or expired password reset token.",
    });
  }
};

module.exports = {
  login,
  forceResetPassword,
  forgotPassword,
  resetPasswordWithToken,
};
