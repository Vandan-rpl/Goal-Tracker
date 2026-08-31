const { sql, poolPromise } = require("../config/db");

/**
 * ============================================================
 * Notification Model
 * Enterprise Goal Tracker Management System
 * ============================================================
 *
 * FIX: this file used to `const { sql, pool, poolConnect } = require("../config/db")`.
 * config/db.js only ever exports `{ sql, poolPromise }` — there is no
 * `pool` or `poolConnect` export. `await poolConnect` silently resolved to
 * `await undefined` (no error), but every subsequent `pool.request()` call
 * threw a TypeError ("Cannot read properties of undefined") because `pool`
 * itself was undefined. In other words, EVERY function in this file was
 * broken and would 500 the moment it ran. Fixed by using `poolPromise`
 * the same way goalModel.js and every other model in this codebase does.
 */

/**
 * Get Notifications
 */
const getNotifications = async (userId) => {

    const pool = await poolPromise;

    const request = pool.request();

    request.input("UserId", sql.Int, userId);

    const result = await request.query(`
        SELECT
            NotificationId,
            UserId,
            Title,
            Message,
            NotificationType,
            ReferenceId,
            ReferenceType,
            IsRead,
            ReadAt,
            CreatedAt,
            CreatedBy
        FROM dbo.Notifications
        WHERE UserId = @UserId
        ORDER BY CreatedAt DESC;
    `);

    return result.recordset;
};

/**
 * Get Unread Notification Count
 */
const getNotificationCount = async (userId) => {

    const pool = await poolPromise;

    const request = pool.request();

    request.input("UserId", sql.Int, userId);

    const result = await request.query(`
        SELECT COUNT(*) AS NotificationCount
        FROM dbo.Notifications
        WHERE UserId = @UserId
          AND IsRead = 0;
    `);

    return result.recordset[0];
};

/**
 * Mark Notification As Read
 */
const markAsRead = async (notificationId, userId) => {

    const pool = await poolPromise;

    const request = pool.request();

    request.input("NotificationId", sql.Int, notificationId);
    request.input("UserId", sql.Int, userId);

    await request.query(`
        UPDATE dbo.Notifications
        SET
            IsRead = 1,
            ReadAt = GETDATE()
        WHERE
            NotificationId = @NotificationId
            AND UserId = @UserId;
    `);

    return true;
};

/**
 * Mark All Notifications As Read
 */
const markAllAsRead = async (userId) => {

    const pool = await poolPromise;

    const request = pool.request();

    request.input("UserId", sql.Int, userId);

    await request.query(`
        UPDATE dbo.Notifications
        SET
            IsRead = 1,
            ReadAt = GETDATE()
        WHERE
            UserId = @UserId
            AND IsRead = 0;
    `);

    return true;
};

/**
 * Delete Notification
 */
const deleteNotification = async (notificationId, userId) => {

    const pool = await poolPromise;

    const request = pool.request();

    request.input("NotificationId", sql.Int, notificationId);
    request.input("UserId", sql.Int, userId);

    await request.query(`
        DELETE FROM dbo.Notifications
        WHERE
            NotificationId = @NotificationId
            AND UserId = @UserId;
    `);

    return true;
};

/**
 * Delete All Notifications
 */
const deleteAllNotifications = async (userId) => {

    const pool = await poolPromise;

    const request = pool.request();

    request.input("UserId", sql.Int, userId);

    await request.query(`
        DELETE FROM dbo.Notifications
        WHERE UserId = @UserId;
    `);

    return true;
};

/**
 * Create Notification
 */
const createNotification = async (data) => {

    const pool = await poolPromise;

    const request = pool.request();

    request.input("UserId", sql.Int, data.userId);
    request.input("Title", sql.NVarChar(200), data.title);
    request.input("Message", sql.NVarChar(sql.MAX), data.message);
    request.input("NotificationType", sql.NVarChar(50), data.notificationType);
    request.input("ReferenceId", sql.Int, data.referenceId || null);
    request.input("ReferenceType", sql.NVarChar(50), data.referenceType || null);
    request.input("CreatedBy", sql.Int, data.createdBy || null);

    const result = await request.query(`
        INSERT INTO dbo.Notifications
        (
            UserId,
            Title,
            Message,
            NotificationType,
            ReferenceId,
            ReferenceType,
            CreatedBy
        )
        OUTPUT INSERTED.NotificationId
        VALUES
        (
            @UserId,
            @Title,
            @Message,
            @NotificationType,
            @ReferenceId,
            @ReferenceType,
            @CreatedBy
        );
    `);

    return result.recordset[0];
};

module.exports = {

    getNotifications,

    getNotificationCount,

    markAsRead,

    markAllAsRead,

    deleteNotification,

    deleteAllNotifications,

    createNotification

};
