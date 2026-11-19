const { poolPromise, sql } = require("../config/db");
const { issueTemporaryPassword } = require("./authService");
const welcomeMailQueue = require("./welcomeMailQueue");
const passwordHistoryModel = require("../models/passwordHistoryModel");
const withTransaction = require("../utils/withTransaction");
const logger = require("../utils/logger");

/**
 * ============================================================
 * Activate All Users (Admin)
 *
 * The employee Excel import leaves every uploaded user inactive and sends
 * no email. The Admin then activates every inactive user at once:
 * - every inactive user is set active (IsActive is the only flag; this
 *   includes users who were deleted, since delete is IsActive = 0);
 * - users who have never logged in (DefaultPasswordFlag = 1, still on a
 *   temporary password) and have an email get a new temporary password and
 *   the welcome email, through the welcome mail queue (30 per minute);
 * - everyone else keeps their current password and gets no email.
 * ============================================================
 */

const fullName = (u) => [u.FirstName, u.LastName].filter(Boolean).join(" ").trim();

const hasEmail = (u) => Boolean(u.Email && String(u.Email).trim());

const isNeverLoggedIn = (u) => u.DefaultPasswordFlag === true || u.DefaultPasswordFlag === 1;

const listInactiveUsers = async (db) => {
  const result = await db.request().query(`
    SELECT UserID, EmployeeCode, Username, FirstName, LastName, Email, Role, DefaultPasswordFlag
    FROM dbo.Users
    WHERE IsActive = 0
    ORDER BY FirstName, LastName, UserID
  `);
  return result.recordset;
};

const describe = (u) => ({
  userId: u.UserID,
  employeeCode: u.EmployeeCode || null,
  name: fullName(u),
  email: u.Email || null,
  role: u.Role,
  willGetEmail: isNeverLoggedIn(u) && hasEmail(u),
  neverLoggedIn: isNeverLoggedIn(u),
});

/**
 * What Activate All would do now: every inactive user, and who gets an email.
 */
const getActivationSummary = async () => {
  const pool = await poolPromise;
  const users = (await listInactiveUsers(pool)).map(describe);
  return {
    total: users.length,
    emails: users.filter((u) => u.willGetEmail).length,
    noEmailAddress: users.filter((u) => u.neverLoggedIn && !u.email).length,
    users,
  };
};

/**
 * Activate every inactive user and queue the welcome emails.
 * Returns { activated, mailsQueued, batchId, noEmailAddress }.
 */
const activateAllUsers = async (admin) => {
  const pool = await poolPromise;
  const candidates = await listInactiveUsers(pool);
  if (!candidates.length) {
    return { activated: 0, mailsQueued: 0, batchId: null, noEmailAddress: 0 };
  }

  // Hash before the transaction so it stays short.
  const toMail = candidates.filter((u) => isNeverLoggedIn(u) && hasEmail(u));
  const credentials = new Map(
    await Promise.all(toMail.map(async (u) => [u.UserID, await issueTemporaryPassword()])),
  );

  const { activatedIds, mailed } = await withTransaction(async (transaction) => {
    // Only users still inactive now.
    const activated = await transaction
      .request()
      .input("UserIDs", sql.NVarChar(sql.MAX), JSON.stringify(candidates.map((u) => u.UserID)))
      .query(`
        UPDATE dbo.Users SET IsActive = 1, ModifiedDate = GETDATE()
        OUTPUT INSERTED.UserID
        WHERE IsActive = 0
          AND UserID IN (SELECT CAST(value AS INT) FROM OPENJSON(@UserIDs))
      `);
    const ids = new Set(activated.recordset.map((r) => r.UserID));

    // New temporary password (same steps as Resend Credentials): lockout
    // cleared, the replaced hash into PasswordHistory.
    const mailedUsers = [];
    for (const user of toMail) {
      if (!ids.has(user.UserID)) continue;
      const current = await passwordHistoryModel.getUserForPasswordChange(transaction, user.UserID, { forUpdate: true });
      if (!current || !isNeverLoggedIn(current)) continue;

      const { temporaryPassword, passwordHash } = credentials.get(user.UserID);
      await transaction
        .request()
        .input("UserID", sql.Int, user.UserID)
        .input("PasswordHash", sql.NVarChar, passwordHash)
        .query(`
          UPDATE dbo.Users
          SET PasswordHash = @PasswordHash,
              DefaultPasswordFlag = 1,
              IsPasswordChanged = 0,
              FailedLoginCount = 0,
              IsLocked = 0,
              LockoutUntil = NULL,
              ModifiedDate = GETDATE()
          WHERE UserID = @UserID
        `);
      await passwordHistoryModel.archivePassword(transaction, user.UserID, current.PasswordHash, true);
      mailedUsers.push({ user: current, temporaryPassword });
    }

    return { activatedIds: ids, mailed: mailedUsers };
  });

  // After the commit; sent in the background (30 per minute).
  let batchId = null;
  let mailsQueued = 0;
  try {
    batchId = welcomeMailQueue.enqueueBatch(mailed, { source: "activate-all" });
    mailsQueued = mailed.length;
  } catch (error) {
    logger.error(`[ACTIVATE ALL] Could not queue ${mailed.length} mail(s): ${error.message}`);
  }

  logger.info(
    `[ACTIVATE ALL] By admin userId=${admin.userId} (${admin.username}): activated=${activatedIds.size} mailsQueued=${mailsQueued}`,
  );

  return {
    activated: activatedIds.size,
    mailsQueued,
    mailsNotQueued: mailed.length - mailsQueued,
    batchId,
    noEmailAddress: candidates.filter((u) => activatedIds.has(u.UserID) && isNeverLoggedIn(u) && !hasEmail(u)).length,
  };
};

module.exports = {
  getActivationSummary,
  activateAllUsers,
};
