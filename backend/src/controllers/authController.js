const { poolPromise, sql } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const passwordHistoryModel = require("../models/passwordHistoryModel");
const { validateNewPassword, passwordErrorMessage } = require("../validations/passwordValidation");
const withTransaction = require("../utils/withTransaction");
const {
  BCRYPT_SALT_ROUNDS,
  MAX_FAILED_LOGINS,
  LOCKOUT_MINUTES,
  PasswordMessages,
  LoginMessages,
} = require("../constants/passwordPolicyConstants");

// -----------------------------------------------------------------------
// FIX: SQL Server BIT columns come back from the `mssql` driver as native
// JS booleans (true/false), not integers. Strict comparisons like
// `user.IsPasswordChanged === 1` will ALWAYS be false, no matter what is
// stored in the DB. This helper normalizes bit/boolean/string values
// (1, "1", true) to a real boolean so comparisons work no matter how the
// driver/config returns them.
// -----------------------------------------------------------------------
const toBool = (value) => value === true || value === 1 || value === "1";

const invalidCredentials = (res) =>
  res.status(401).json({ success: false, message: LoginMessages.INVALID_CREDENTIALS });

const passwordRejected = (res, errors, status = 400) =>
  res.status(status).json({ success: false, message: passwordErrorMessage(errors), errors });

const lockedOut = (res) =>
  res.status(403).json({ success: false, code: "ACCOUNT_LOCKED", message: LoginMessages.LOCKED_OUT });

/**
 * One atomic UPDATE per wrong password, so parallel attempts each count.
 * A lockout that has already ended starts the count again from 1. Does
 * nothing while a lockout is running (another request just locked it).
 * Returns { locked } — true when the account is now locked out.
 */
const recordFailedLogin = async (pool, userId) => {
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId)
    .input("MaxFailed", sql.Int, MAX_FAILED_LOGINS)
    .input("LockoutMinutes", sql.Int, LOCKOUT_MINUTES).query(`
      UPDATE u
      SET FailedLoginCount = c.NewCount,
          IsLocked = CASE WHEN c.NewCount >= @MaxFailed THEN 1 ELSE 0 END,
          LockoutUntil = CASE WHEN c.NewCount >= @MaxFailed
                              THEN DATEADD(MINUTE, @LockoutMinutes, GETDATE()) ELSE NULL END
      OUTPUT INSERTED.IsLocked
      FROM dbo.Users u
      CROSS APPLY (
        SELECT CASE WHEN u.LockoutUntil IS NOT NULL AND u.LockoutUntil <= GETDATE()
                    THEN 1 ELSE u.FailedLoginCount + 1 END AS NewCount
      ) c
      WHERE u.UserID = @UserID
        AND u.IsActive = 1
        AND (u.LockoutUntil IS NULL OR u.LockoutUntil <= GETDATE())
    `);

  const row = result.recordset[0];
  // No row: a parallel request locked the account first.
  return { locked: !row || toBool(row.IsLocked) };
};

/**
 * Successful login: reset the count and any (ended) lock. Only while no
 * lockout is running; returns false if one is.
 */
const clearFailedLogins = async (pool, userId) => {
  const result = await pool
    .request()
    .input("UserID", sql.Int, userId).query(`
      UPDATE dbo.Users
      SET FailedLoginCount = 0, IsLocked = 0, LockoutUntil = NULL
      WHERE UserID = @UserID
        AND (LockoutUntil IS NULL OR LockoutUntil <= GETDATE())
    `);

  return result.rowsAffected[0] === 1;
};

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

    // IsLockedOut compares LockoutUntil with GETDATE() in SQL, the same
    // clock that set it. IsLocked = 1 without a LockoutUntil (old data) is
    // not a lock: locking only comes from the 15-minute lockout.
    const result = await pool
      .request()
      .input("Identifier", sql.VarChar, username).query(`
                SELECT TOP 1
                    UserID, Username, FirstName, LastName, PasswordHash, Email, Role, IsPasswordChanged,
                    DefaultPasswordFlag,
                    CAST(CASE WHEN LockoutUntil > GETDATE() THEN 1 ELSE 0 END AS BIT) AS IsLockedOut
                FROM Users
                WHERE (Username = @Identifier OR Email = @Identifier) AND IsActive = 1
            `);

    // Unknown (or deactivated) login: same answer as a wrong password, no DB write.
    if (result.recordset.length === 0) {
      return invalidCredentials(res);
    }

    const user = result.recordset[0];

    // Locked: reject without checking the password.
    if (toBool(user.IsLockedOut)) {
      return lockedOut(res);
    }

    const isMatch = await bcrypt.compare(password, user.PasswordHash);
    if (!isMatch) {
      const failure = await recordFailedLogin(pool, user.UserID);

      return failure.locked ? lockedOut(res) : invalidCredentials(res);
    }

    // Guarded: if parallel wrong attempts locked the account while this
    // password was being checked, the lock wins.
    if (!(await clearFailedLogins(pool, user.UserID))) {
      return lockedOut(res);
    }

    // DefaultPasswordFlag is the source of truth for "must change password"
    // (the same column verifyToken enforces on every protected request).
    // isPasswordChanged is derived from it so the two can never disagree
    // in the token/response, even if the DB columns have drifted.
    const defaultPasswordFlag = toBool(user.DefaultPasswordFlag);
    const isPasswordChanged = !defaultPasswordFlag;

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
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const userId = req.user.userId; // Extracted from token middleware

  if (!currentPassword) {
    return passwordRejected(res, [PasswordMessages.CURRENT_REQUIRED]);
  }

  try {
    const pool = await poolPromise;

    const user = await passwordHistoryModel.getUserForPasswordChange(pool, userId);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.PasswordHash);
    if (!isMatch) {
      return passwordRejected(res, [PasswordMessages.CURRENT_INCORRECT]);
    }

    // Also rejects "changing" the temporary password to itself.
    const validation = await validateNewPassword({
      newPassword,
      confirmPassword,
      user,
      previousHashes: await passwordHistoryModel.getRecentHashes(pool, userId),
    });

    if (!validation.isValid) {
      return passwordRejected(res, validation.errors);
    }

    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // Explicitly set IsPasswordChanged = 1 and clear DefaultPasswordFlag.
    // Only if the hash is still the one checked above; the old hash goes
    // into PasswordHistory in the same transaction.
    const changed = await withTransaction(async (transaction) => {
      const updated = await transaction
        .request()
        .input("UserID", sql.Int, userId)
        .input("PasswordHash", sql.NVarChar, newPasswordHash)
        .input("OldPasswordHash", sql.NVarChar, user.PasswordHash).query(`
                UPDATE Users
                SET PasswordHash = @PasswordHash,
                    IsPasswordChanged = 1,
                    DefaultPasswordFlag = 0,
                    PasswordChangedDate = GETDATE(),
                    ModifiedDate = GETDATE()
                WHERE UserID = @UserID AND PasswordHash = @OldPasswordHash
            `);

      if (updated.rowsAffected[0] === 0) {
        return false;
      }

      await passwordHistoryModel.archivePassword(
        transaction,
        userId,
        user.PasswordHash,
        toBool(user.DefaultPasswordFlag),
      );
      return true;
    });

    if (!changed) {
      return passwordRejected(res, [PasswordMessages.CHANGED_ELSEWHERE], 409);
    }

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
