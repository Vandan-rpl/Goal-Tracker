const dashboardService = require("../services/dashboardService");

/**
 * ============================================================
 * Dashboard Controller
 * Enterprise Goal Tracker Management System
 * ============================================================
 *
 * FIX: every method here used to read req.user.companyId /
 * req.user.employeeId / req.user.roleId. None of those exist in the real
 * JWT payload — authController.js only ever signs
 * { userId, username, role, isPasswordChanged }. There is also no
 * multi-tenant "company" concept anywhere else in this schema (no
 * CompanyID column on Users, Goals, or anywhere). Every method below now
 * reads req.user.userId / req.user.role and passes { userId, role } to
 * dashboardService, which was also completely empty (0 bytes) before this
 * fix — see dashboardService.js for the scoping logic.
 */

/**
 * Dashboard Summary
 * GET /api/v1/dashboard/summary
 */
exports.getDashboardSummary = async (req, res) => {
    try {
        const userId = req.user?.UserID || req.user?.userId;
        const role = req.user?.role;

        const data = await dashboardService.getDashboardSummary({ userId, role });

        return res.status(200).json({
            success: true,
            message: "Dashboard summary fetched successfully.",
            data
        });

    } catch (error) {
        console.error("Dashboard Summary Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard summary.",
            error: error.message
        });
    }
};

/**
 * Recent Activities
 * GET /api/v1/dashboard/recent-activities
 */
exports.getRecentActivities = async (req, res) => {
    try {

        const userId = req.user?.UserID || req.user?.userId;
        const role = req.user?.role;

        const data = await dashboardService.getRecentActivities({ userId, role });

        return res.status(200).json({
            success: true,
            message: "Recent activities fetched successfully.",
            data
        });

    } catch (error) {

        console.error("Recent Activities Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch recent activities.",
            error: error.message
        });

    }
};

/**
 * Pending Approvals
 * GET /api/v1/dashboard/pending-approvals
 */
exports.getPendingApprovals = async (req, res) => {

    try {

        const userId = req.user?.UserID || req.user?.userId;
        const role = req.user?.role;

        const data = await dashboardService.getPendingApprovals({ userId, role });

        return res.status(200).json({
            success: true,
            message: "Pending approvals fetched successfully.",
            data
        });

    } catch (error) {

        console.error("Pending Approvals Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch pending approvals.",
            error: error.message
        });

    }

};

/**
 * Goal Progress
 * GET /api/v1/dashboard/goal-progress
 */
exports.getGoalProgress = async (req, res) => {

    try {

        const userId = req.user?.UserID || req.user?.userId;
        const role = req.user?.role;

        const data = await dashboardService.getGoalProgress({ userId, role });

        return res.status(200).json({
            success: true,
            message: "Goal progress fetched successfully.",
            data
        });

    } catch (error) {

        console.error("Goal Progress Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch goal progress.",
            error: error.message
        });

    }

};

/**
 * Dashboard Statistics
 * GET /api/v1/dashboard/statistics
 */
exports.getStatistics = async (req, res) => {

    try {

        const userId = req.user?.UserID || req.user?.userId;
        const role = req.user?.role;

        const data = await dashboardService.getStatistics({ userId, role });

        return res.status(200).json({
            success: true,
            message: "Dashboard statistics fetched successfully.",
            data
        });

    } catch (error) {

        console.error("Statistics Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch statistics.",
            error: error.message
        });

    }

};

/**
 * Dashboard Charts
 * GET /api/v1/dashboard/charts
 */
exports.getCharts = async (req, res) => {

    try {

        const userId = req.user?.UserID || req.user?.userId;
        const role = req.user?.role;

        const data = await dashboardService.getCharts({ userId, role });

        return res.status(200).json({
            success: true,
            message: "Dashboard chart data fetched successfully.",
            data
        });

    } catch (error) {

        console.error("Charts Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch chart data.",
            error: error.message
        });

    }

};
