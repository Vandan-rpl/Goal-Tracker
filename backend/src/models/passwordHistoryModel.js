const { sql } = require("../config/db");
const { PASSWORD_HISTORY_COUNT } = require("../constants/passwordPolicyConstants");

/**
 * ============================================================
 * Password History
 * Every function takes `db`: the pool, or a transaction so the history
 * rows are written together with the Users update.
 *
 * CreatedAt is written with GETDATE() (server-local), the same clock as
 * Users.PasswordChangedDate and PasswordResetOTPs, instead of the
 * column's SYSUTCDATETIME() default.
 * ============================================================
 */

/**
 * What the password policy needs about a user: the words a password may
 * not contain, the current hash and DefaultPasswordFlag (was the current
 * password a temporary one?). WITH (UPDLOCK) when `forUpdate`, so the hash
 * cannot change between the checks and the update in the same transaction.
 */
const getUserForPasswordChange = async (db, userId, { forUpdate = false } = {}) => {
    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .query(`
            SELECT UserID, Username, EmployeeCode, FirstName, LastName, Email,
                   PasswordHash, DefaultPasswordFlag, IsActive
            FROM dbo.Users ${forUpdate ? "WITH (UPDLOCK, ROWLOCK)" : ""}
            WHERE UserID = @UserID
        `);

    return result.recordset[0] || null;
};

/**
 * The user's most recent previous password hashes, newest first.
 */
const getRecentHashes = async (db, userId) => {
    const result = await db.request()
        .input("UserID", sql.Int, userId)
        .input("Count", sql.Int, PASSWORD_HISTORY_COUNT)
        .query(`
            SELECT TOP (@Count) PasswordHash
            FROM dbo.PasswordHistory
            WHERE UserID = @UserID
            ORDER BY CreatedAt DESC, HistoryID DESC
        `);

    return result.recordset.map((row) => row.PasswordHash);
};

/**
 * Stores the hash being replaced and keeps only the newest
 * PASSWORD_HISTORY_COUNT rows for the user. Call inside the same
 * transaction as the Users update.
 *
 * @param {boolean} isDefaultPassword  the replaced password was a system
 *                                     temporary password
 */
const archivePassword = async (db, userId, oldPasswordHash, isDefaultPassword) => {
    await db.request()
        .input("UserID", sql.Int, userId)
        .input("PasswordHash", sql.NVarChar(255), oldPasswordHash)
        .input("IsDefaultPassword", sql.Bit, isDefaultPassword ? 1 : 0)
        .input("Count", sql.Int, PASSWORD_HISTORY_COUNT)
        .query(`
            INSERT INTO dbo.PasswordHistory (UserID, PasswordHash, IsDefaultPassword, CreatedAt)
            VALUES (@UserID, @PasswordHash, @IsDefaultPassword, GETDATE());

            DELETE FROM dbo.PasswordHistory
            WHERE UserID = @UserID
              AND HistoryID NOT IN (
                  SELECT TOP (@Count) HistoryID
                  FROM dbo.PasswordHistory
                  WHERE UserID = @UserID
                  ORDER BY CreatedAt DESC, HistoryID DESC
              );
        `);
};

module.exports = {
    getUserForPasswordChange,
    getRecentHashes,
    archivePassword,
};
