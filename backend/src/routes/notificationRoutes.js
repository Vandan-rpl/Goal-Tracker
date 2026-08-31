const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notificationController");

// FIX: this used to `require("../middleware/authMiddleware")` and pass the
// whole module (an object: { verifyToken, verifyRole, decodeAuthToken })
// straight to router.get/put/delete as if it were a middleware function.
// Express would throw at request time ("argument handler must be a
// function") the moment any of these routes was actually hit. Destructuring
// verifyToken here is the fix.
const { verifyToken } = require("../middleware/authMiddleware");

/**
 * ============================================================
 * Notification Routes
 * Base URL : /api/v1/notifications
 * ============================================================
 */

/**
 * Get All Notifications
 * GET /api/v1/notifications
 */
router.get(
    "/",
    verifyToken,
    notificationController.getNotifications
);

/**
 * Get Unread Notification Count
 * GET /api/v1/notifications/count
 */
router.get(
    "/count",
    verifyToken,
    notificationController.getNotificationCount
);

/**
 * Mark Notification As Read
 * PUT /api/v1/notifications/:notificationId/read
 */
router.put(
    "/:notificationId/read",
    verifyToken,
    notificationController.markAsRead
);

/**
 * Mark All Notifications As Read
 * PUT /api/v1/notifications/read-all
 */
router.put(
    "/read-all",
    verifyToken,
    notificationController.markAllAsRead
);

/**
 * Delete Notification
 * DELETE /api/v1/notifications/:notificationId
 */
router.delete(
    "/:notificationId",
    verifyToken,
    notificationController.deleteNotification
);

/**
 * Delete All Notifications
 * DELETE /api/v1/notifications
 */
router.delete(
    "/",
    verifyToken,
    notificationController.deleteAllNotifications
);

module.exports = router;
