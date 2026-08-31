const notificationModel = require("../models/notificationModel");

/**
 * ============================================================
 * Notification Service
 * Enterprise Goal Tracker Management System
 * ============================================================
 */

/**
 * Get User Notifications
 */
const getNotifications = async (userId) => {

    if (!userId) {
        throw new Error("User Id is required.");
    }

    return await notificationModel.getNotifications(userId);
};

/**
 * Get Notification Count
 */
const getNotificationCount = async (userId) => {

    if (!userId) {
        throw new Error("User Id is required.");
    }

    return await notificationModel.getNotificationCount(userId);
};

/**
 * Mark Notification As Read
 */
const markAsRead = async (notificationId, userId) => {

    if (!notificationId) {
        throw new Error("Notification Id is required.");
    }

    if (!userId) {
        throw new Error("User Id is required.");
    }

    await notificationModel.markAsRead(notificationId, userId);

    return {
        success: true,
        message: "Notification marked as read."
    };
};

/**
 * Mark All Notifications As Read
 */
const markAllAsRead = async (userId) => {

    if (!userId) {
        throw new Error("User Id is required.");
    }

    await notificationModel.markAllAsRead(userId);

    return {
        success: true,
        message: "All notifications marked as read."
    };
};

/**
 * Delete Notification
 */
const deleteNotification = async (notificationId, userId) => {

    if (!notificationId) {
        throw new Error("Notification Id is required.");
    }

    if (!userId) {
        throw new Error("User Id is required.");
    }

    await notificationModel.deleteNotification(notificationId, userId);

    return {
        success: true,
        message: "Notification deleted successfully."
    };
};

/**
 * Delete All Notifications
 */
const deleteAllNotifications = async (userId) => {

    if (!userId) {
        throw new Error("User Id is required.");
    }

    await notificationModel.deleteAllNotifications(userId);

    return {
        success: true,
        message: "All notifications deleted successfully."
    };
};

/**
 * Create Notification
 */
const createNotification = async (data) => {

    if (!data) {
        throw new Error("Notification data is required.");
    }

    if (!data.userId) {
        throw new Error("User Id is required.");
    }

    if (!data.title) {
        throw new Error("Notification title is required.");
    }

    if (!data.message) {
        throw new Error("Notification message is required.");
    }

    if (!data.notificationType) {
        throw new Error("Notification type is required.");
    }

    return await notificationModel.createNotification(data);
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