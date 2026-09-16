const notificationService = require("../services/notificationService");

/**
 * Get User Notifications
 * GET /api/v1/notifications
 */
exports.getNotifications = async (req, res) => {
    try {

        const userId = req.user.userId;

        const notifications = await notificationService.getNotifications(userId);

        return res.status(200).json({
            success: true,
            message: "Notifications fetched successfully.",
            data: notifications
        });

    } catch (error) {

        console.error("Get Notifications Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch notifications.",
            error: error.message
        });

    }
};

/**
 * Get Notification Count
 * GET /api/v1/notifications/count
 */
exports.getNotificationCount = async (req, res) => {

    try {

        const userId = req.user.userId;

        const count = await notificationService.getNotificationCount(userId);

        return res.status(200).json({
            success: true,
            message: "Notification count fetched successfully.",
            data: count
        });

    } catch (error) {

        console.error("Notification Count Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch notification count.",
            error: error.message
        });

    }

};

/**
 * Mark Notification As Read
 * PUT /api/v1/notifications/:notificationId/read
 */
exports.markAsRead = async (req, res) => {

    try {

        const { notificationId } = req.params;
        const userId = req.user.userId;

        const result = await notificationService.markAsRead(
            notificationId,
            userId
        );

        return res.status(200).json({
            success: true,
            message: "Notification marked as read successfully.",
            data: result
        });

    } catch (error) {

        console.error("Mark As Read Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to mark notification as read.",
            error: error.message
        });

    }

};

/**
 * Mark All Notifications As Read
 * PUT /api/v1/notifications/read-all
 */
exports.markAllAsRead = async (req, res) => {

    try {

        const userId = req.user.userId;

        const result = await notificationService.markAllAsRead(userId);

        return res.status(200).json({
            success: true,
            message: "All notifications marked as read successfully.",
            data: result
        });

    } catch (error) {

        console.error("Mark All As Read Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to mark all notifications as read.",
            error: error.message
        });

    }

};

/**
 * Delete Notification
 * DELETE /api/v1/notifications/:notificationId
 */
exports.deleteNotification = async (req, res) => {

    try {

        const { notificationId } = req.params;
        const userId = req.user.userId;

        const result = await notificationService.deleteNotification(
            notificationId,
            userId
        );

        return res.status(200).json({
            success: true,
            message: "Notification deleted successfully.",
            data: result
        });

    } catch (error) {

        console.error("Delete Notification Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete notification.",
            error: error.message
        });

    }

};

/**
 * Delete All Notifications
 * DELETE /api/v1/notifications
 */
exports.deleteAllNotifications = async (req, res) => {

    try {

        const userId = req.user.userId;

        const result = await notificationService.deleteAllNotifications(userId);

        return res.status(200).json({
            success: true,
            message: "All notifications deleted successfully.",
            data: result
        });

    } catch (error) {

        console.error("Delete All Notifications Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete all notifications.",
            error: error.message
        });

    }

};
