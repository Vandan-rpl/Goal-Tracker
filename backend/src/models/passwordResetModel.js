const { sql } = require("../config/db");
const { ResetStatus } = require("../constants/passwordResetConstants");

/**
 * ============================================================
 * Password Reset Model
 * SQL for dbo.PasswordResetOTPs (Forgot Password OTP flow) and the
 * Users reads/updates that flow needs.
 *
 * Every function takes `db`: either a resolved pool or an open
 * sql.Transaction (both expose .request()).
 *
 * All expiry checks use GETDATE() in SQL, the same clock as the table's
 * CreatedAt/UpdatedAt defaults. Every status change is a guarded UPDATE
 * (WHERE Status = expected) so two parallel requests can never move the
 * same row twice.
 * ============================================================
 */

/**
 * User for a Forgot Password email (active or not; the service decides).
 */
const findUserByEmail = async (db, email) => {
    const result = await db.request()
        .input("Email", sql.NVarChar(150), email)
        .query(`
            SELECT TOP 1 UserID, Username, FirstName, LastName, Email, IsActive
            FROM dbo.Users
            WHERE Email = @Email
        `);

    return result.recordset[0] || null;
};

/**
 * Serialise OTP requests for one user until the transaction ends, so two
 * parallel requests cannot both pass the rate-limit check.
 */
const lockUserResetRequests = async (db, userId) => {
    await db.request()
        .input("Resource", sql.NVarChar(255), `PasswordResetOTP:${userId}`)
        .query(`
            DECLARE @LockResult INT;
            EXEC @LockResult = sp_getapplock
                @Resource = @Resource,
                @LockMode = 'Exclusive',
                @LockOwner = 'Transaction',
                @LockTimeout = 10000;
            IF @LockResult < 0
                THROW 50001, 'Could not lock password reset requests for this user.', 1;
        `);
};

/**
 * OTP requests in the last hour and seconds since the newest one.
 */
const getRecentRequestStats = async (db, userId) => {
    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT
                COUNT(*) AS RequestsLastHour,
                DATEDIFF(SECOND, MAX(CreatedAt), GETDATE()) AS SecondsSinceLast
            FROM dbo.PasswordResetOTPs
            WHERE UserID = @UserID
              AND CreatedAt >= DATEADD(HOUR, -1, GETDATE())
        `);

    return result.recordset[0];
};

/**
 * Pending/Verified rows of the user -> Invalidated (except `exceptResetId`).
 */
const invalidateOpenRows = async (db, userId, reason, exceptResetId = null) => {
    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .input("Reason", sql.NVarChar(50), reason)
        .input("ExceptResetID", sql.BigInt, exceptResetId)
        .input("Invalidated", sql.NVarChar(20), ResetStatus.INVALIDATED)
        .input("Pending", sql.NVarChar(20), ResetStatus.PENDING)
        .input("Verified", sql.NVarChar(20), ResetStatus.VERIFIED)
        .query(`
            UPDATE dbo.PasswordResetOTPs
            SET Status = @Invalidated,
                InvalidatedAt = GETDATE(),
                InvalidatedReason = @Reason,
                UpdatedAt = GETDATE()
            WHERE UserID = @UserID
              AND Status IN (@Pending, @Verified)
              AND (@ExceptResetID IS NULL OR ResetID <> @ExceptResetID)
        `);

    return result.rowsAffected[0];
};

const insertOtpRow = async (db, { userId, otpHash, validMinutes, requestIp, userAgent }) => {
    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .input("OTPHash", sql.NVarChar(255), otpHash)
        .input("ValidMinutes", sql.Int, validMinutes)
        .input("RequestIP", sql.NVarChar(45), requestIp)
        .input("UserAgent", sql.NVarChar(500), userAgent)
        .query(`
            INSERT INTO dbo.PasswordResetOTPs (UserID, OTPHash, OTPExpiresAt, RequestIP, UserAgent)
            OUTPUT INSERTED.ResetID
            VALUES (@UserID, @OTPHash, DATEADD(MINUTE, @ValidMinutes, GETDATE()), @RequestIP, @UserAgent)
        `);

    return result.recordset[0].ResetID;
};

/**
 * The user's newest row, locked until the transaction ends. Only the newest
 * row can still be Pending (a new request invalidates older ones).
 */
const getLatestRowForUpdate = async (db, userId) => {
    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT TOP 1
                ResetID, OTPHash, AttemptCount, Status,
                CAST(CASE WHEN OTPExpiresAt <= GETDATE() THEN 1 ELSE 0 END AS BIT) AS IsOtpExpired
            FROM dbo.PasswordResetOTPs WITH (UPDLOCK, HOLDLOCK)
            WHERE UserID = @UserID
            ORDER BY CreatedAt DESC, ResetID DESC
        `);

    return result.recordset[0] || null;
};

/**
 * Wrong OTP: AttemptCount + 1, and Locked when it reaches `maxAttempts`.
 * Returns the new { AttemptCount, Status }, or null if the row was no
 * longer Pending.
 */
const recordWrongAttempt = async (db, resetId, maxAttempts) => {
    const result = await db.request()
        .input("ResetID", sql.BigInt, resetId)
        .input("MaxAttempts", sql.Int, maxAttempts)
        .input("Pending", sql.NVarChar(20), ResetStatus.PENDING)
        .input("Locked", sql.NVarChar(20), ResetStatus.LOCKED)
        .query(`
            UPDATE dbo.PasswordResetOTPs
            SET AttemptCount = AttemptCount + 1,
                Status = CASE WHEN AttemptCount + 1 >= @MaxAttempts THEN @Locked ELSE Status END,
                UpdatedAt = GETDATE()
            OUTPUT INSERTED.AttemptCount, INSERTED.Status
            WHERE ResetID = @ResetID
              AND Status = @Pending
        `);

    return result.recordset[0] || null;
};

/**
 * Status `fromStatus` -> Expired. Returns true if this call changed it.
 */
const markExpired = async (db, resetId, fromStatus) => {
    const result = await db.request()
        .input("ResetID", sql.BigInt, resetId)
        .input("FromStatus", sql.NVarChar(20), fromStatus)
        .input("Expired", sql.NVarChar(20), ResetStatus.EXPIRED)
        .query(`
            UPDATE dbo.PasswordResetOTPs
            SET Status = @Expired,
                UpdatedAt = GETDATE()
            WHERE ResetID = @ResetID
              AND Status = @FromStatus
        `);

    return result.rowsAffected[0] === 1;
};

/**
 * Correct OTP: Pending -> Verified with a new reset token hash.
 * Returns true if this call verified it.
 */
const markVerified = async (db, resetId, resetTokenHash, tokenValidMinutes) => {
    const result = await db.request()
        .input("ResetID", sql.BigInt, resetId)
        .input("ResetTokenHash", sql.NVarChar(255), resetTokenHash)
        .input("ValidMinutes", sql.Int, tokenValidMinutes)
        .input("Pending", sql.NVarChar(20), ResetStatus.PENDING)
        .input("Verified", sql.NVarChar(20), ResetStatus.VERIFIED)
        .query(`
            UPDATE dbo.PasswordResetOTPs
            SET Status = @Verified,
                VerifiedAt = GETDATE(),
                ResetTokenHash = @ResetTokenHash,
                ResetTokenExpiresAt = DATEADD(MINUTE, @ValidMinutes, GETDATE()),
                UpdatedAt = GETDATE()
            WHERE ResetID = @ResetID
              AND Status = @Pending
              AND OTPExpiresAt > GETDATE()
        `);

    return result.rowsAffected[0] === 1;
};

/**
 * Row for a reset token hash (locked until the transaction ends), with the
 * user's details for the confirmation email.
 */
const getRowByResetTokenForUpdate = async (db, resetTokenHash) => {
    const result = await db.request()
        .input("ResetTokenHash", sql.NVarChar(255), resetTokenHash)
        .query(`
            SELECT TOP 1
                r.ResetID, r.UserID, r.Status, r.ResetTokenHash,
                CAST(CASE WHEN r.ResetTokenExpiresAt <= GETDATE() THEN 1 ELSE 0 END AS BIT) AS IsTokenExpired,
                u.Username, u.FirstName, u.LastName, u.Email, u.IsActive
            FROM dbo.PasswordResetOTPs r WITH (UPDLOCK, HOLDLOCK)
            INNER JOIN dbo.Users u ON u.UserID = r.UserID
            WHERE r.ResetTokenHash = @ResetTokenHash
        `);

    return result.recordset[0] || null;
};

/**
 * Verified -> Used, only while the reset token is unexpired.
 * Returns true if this call used it.
 */
const markUsed = async (db, resetId) => {
    const result = await db.request()
        .input("ResetID", sql.BigInt, resetId)
        .input("Verified", sql.NVarChar(20), ResetStatus.VERIFIED)
        .input("Used", sql.NVarChar(20), ResetStatus.USED)
        .query(`
            UPDATE dbo.PasswordResetOTPs
            SET Status = @Used,
                UsedAt = GETDATE(),
                UpdatedAt = GETDATE()
            WHERE ResetID = @ResetID
              AND Status = @Verified
              AND ResetTokenExpiresAt > GETDATE()
        `);

    return result.rowsAffected[0] === 1;
};

/**
 * Same Users columns the old reset-link flow set, plus unlocking the account:
 * proving ownership of the mailbox via OTP clears a failed-login lock.
 * Returns the new PasswordChangedDate, or null if the user is no longer active.
 */
const updateUserPassword = async (db, userId, passwordHash) => {
    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .input("PasswordHash", sql.NVarChar, passwordHash)
        .query(`
            UPDATE dbo.Users
            SET PasswordHash = @PasswordHash,
                IsPasswordChanged = 1,
                DefaultPasswordFlag = 0,
                PasswordChangedDate = GETDATE(),
                IsLocked = 0,
                FailedLoginCount = 0,
                LockoutUntil = NULL,
                ModifiedDate = GETDATE()
            OUTPUT INSERTED.PasswordChangedDate
            WHERE UserID = @UserID
              AND IsActive = 1
        `);

    return result.recordset[0] ? result.recordset[0].PasswordChangedDate : null;
};

module.exports = {
    findUserByEmail,
    lockUserResetRequests,
    getRecentRequestStats,
    invalidateOpenRows,
    insertOtpRow,
    getLatestRowForUpdate,
    recordWrongAttempt,
    markExpired,
    markVerified,
    getRowByResetTokenForUpdate,
    markUsed,
    updateUserPassword,
};
