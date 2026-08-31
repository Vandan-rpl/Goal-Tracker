const nodemailer = require('nodemailer');
const { sql } = require('../config/db');
const { getIO } = require('../sockets/io');

// Single shared transporter, reusing the same env vars every controller was
// each configuring separately (EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS).
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

/**
 * notifyUser
 * ------------------------------------------------------------------
 * Single reusable entry point for every in-app + email notification in
 * the app. Replaces the scattered/inconsistent logic that used to live
 * (partially) inside goalController.js and was completely missing from
 * teamController.js.
 *
 * Behavior:
 *  - ALWAYS attempts to insert a row into dbo.Notifications for `userId`.
 *  - If the insert succeeds, ALSO emits a 'notification:new' socket event
 *    to that user's room (`user:${userId}`) so any connected client updates
 *    live, with no page refresh needed. See src/server.js for the room
 *    join and src/sockets/io.js for the singleton this pulls the io
 *    instance from.
 *  - If `emailTo` is provided, ALSO attempts to send an email.
 *  - The DB insert, the socket emit, and the email send are each wrapped in
 *    their OWN try/catch blocks so a failure in one can never block or fail
 *    the others, and can never bubble up and fail the caller's request/transaction.
 *  - Every failure is logged with a clear [EMAIL FAILED] / [NOTIF FAILED]
 *    prefix plus the userId and goalId (referenceId) so it's easy to grep
 *    logs for a specific user/goal when debugging.
 *
 * @param {object} pool - an already-resolved mssql pool (i.e. `await poolPromise`)
 * @param {object} params
 * @param {number} params.userId          - recipient UserID (required)
 * @param {string} params.title           - short notification title (required)
 * @param {string} params.message         - notification body text (required)
 * @param {string} params.type            - NotificationType, e.g. 'GOAL_APPROVED' (required)
 * @param {number} [params.referenceId]   - typically the GoalID
 * @param {string} [params.referenceType] - typically 'Goal'
 * @param {number} [params.createdBy]     - UserID who triggered this notification
 * @param {string} [params.emailTo]       - recipient email; omit to skip email entirely
 * @param {string} [params.emailSubject]  - email subject line (defaults to `title`)
 * @param {string} [params.emailHtml]     - email HTML body (defaults to a plain wrap of `message`)
 *
 * @returns {Promise<{notified: boolean, emailSent: boolean}>}
 */
const notifyUser = async (pool, {
    userId,
    title,
    message,
    type,
    referenceId,
    referenceType,
    createdBy,
    emailTo,
    emailSubject,
    emailHtml
} = {}) => {
    const result = { notified: false, emailSent: false };

    if (!pool) {
        console.error(`[NOTIF FAILED] notifyUser called without a DB pool. userId=${userId} goalId=${referenceId}`);
        return result;
    }

    if (!userId || !title || !message || !type) {
        console.error(`[NOTIF FAILED] Missing required fields (userId/title/message/type). userId=${userId} goalId=${referenceId} type=${type}`);
        return result;
    }

    // 1. In-app DB notification — always attempted, isolated from email/socket.
    let insertedNotification = null;
    try {
        const insertResult = await pool.request()
            .input('UserId', sql.Int, userId)
            .input('Title', sql.NVarChar, title)
            .input('Message', sql.NVarChar, message)
            .input('NotificationType', sql.NVarChar, type)
            .input('ReferenceId', sql.Int, referenceId ?? null)
            .input('ReferenceType', sql.NVarChar, referenceType || null)
            .input('CreatedBy', sql.Int, createdBy ?? null)
            .query(`
                INSERT INTO dbo.Notifications
                    (UserId, Title, Message, NotificationType, ReferenceId, ReferenceType, IsRead, CreatedAt, CreatedBy)
                OUTPUT
                    INSERTED.NotificationId, INSERTED.UserId, INSERTED.Title, INSERTED.Message,
                    INSERTED.NotificationType, INSERTED.ReferenceId, INSERTED.ReferenceType,
                    INSERTED.IsRead, INSERTED.CreatedAt, INSERTED.CreatedBy
                VALUES
                    (@UserId, @Title, @Message, @NotificationType, @ReferenceId, @ReferenceType, 0, GETDATE(), @CreatedBy)
            `);
        result.notified = true;
        insertedNotification = insertResult.recordset[0] || null;
    } catch (notifError) {
        console.error(`[NOTIF FAILED] userId=${userId} goalId=${referenceId} type=${type}:`, notifError);
    }

    // 2. Live push via Socket.IO — only if the DB insert actually succeeded,
    // and only if a socket server is up (getIO() is null before server.js
    // has initialized it, e.g. very early in boot or in a script context).
    if (insertedNotification) {
        try {
            const io = getIO();
            if (io) {
                io.to(`user:${userId}`).emit('notification:new', insertedNotification);
            }
        } catch (socketError) {
            console.error(`[SOCKET EMIT FAILED] userId=${userId} goalId=${referenceId} type=${type}:`, socketError);
        }
    }

    // 3. Email — only attempted if a recipient address was supplied.
    if (emailTo) {
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER || '"GOAL TRACKER" <no-reply@pms.com>',
                to: emailTo,
                subject: emailSubject || title,
                html: emailHtml || `<p>${message}</p>`
            });
            result.emailSent = true;
        } catch (emailError) {
            console.error(`[EMAIL FAILED] userId=${userId} goalId=${referenceId} emailTo=${emailTo} type=${type}:`, emailError);
        }
    }

    return result;
};

module.exports = { notifyUser };
