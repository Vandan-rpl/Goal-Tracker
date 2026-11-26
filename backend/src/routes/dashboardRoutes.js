const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireGoalAccess } = require("../middleware/goalAccessMiddleware");

// FIX: this used to `require("../middleware/authMiddleware")` and pass the
// whole module (an object, not a function) straight to router.get as
// middleware — same bug notificationRoutes.js had. Express would throw at
// request time. Destructuring verifyToken fixes it. This router was ALSO
// never mounted in server.js at all (fixed there too), so every one of
// these routes was a 404 regardless.

/**
 * ============================================================
 * Dashboard Routes
 * Base URL : /api/v1/dashboard
 * ============================================================
 */

/**
 * Dashboard Summary
 * GET /api/v1/dashboard/summary
 */
router.get(
    "/summary",
    verifyToken, requireGoalAccess,
    dashboardController.getDashboardSummary
);

/**
 * Dashboard Statistics
 * GET /api/v1/dashboard/statistics
 */
router.get(
    "/statistics",
    verifyToken, requireGoalAccess,
    dashboardController.getStatistics
);

/**
 * Goal Progress
 * GET /api/v1/dashboard/goal-progress
 */
router.get(
    "/goal-progress",
    verifyToken, requireGoalAccess,
    dashboardController.getGoalProgress
);

/**
 * Pending Approvals
 * GET /api/v1/dashboard/pending-approvals
 */
router.get(
    "/pending-approvals",
    verifyToken, requireGoalAccess,
    dashboardController.getPendingApprovals
);

/**
 * Recent Activities
 * GET /api/v1/dashboard/recent-activities
 */
router.get(
    "/recent-activities",
    verifyToken, requireGoalAccess,
    dashboardController.getRecentActivities
);

/**
 * Dashboard Charts
 * GET /api/v1/dashboard/charts
 */
router.get(
    "/charts",
    verifyToken, requireGoalAccess,
    dashboardController.getCharts
);

module.exports = router;