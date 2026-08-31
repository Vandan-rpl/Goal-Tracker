const menuService = require("../services/menuService");

/**
 * ============================================================
 * Menu Controller
 * Enterprise Goal Tracker Management System
 * ============================================================
 */

/**
 * ------------------------------------------------------------
 * Get Logged-in User Menu
 * GET /api/menu
 * ------------------------------------------------------------
 */
exports.getMenu = async (req, res) => {
    try {

        const user = {
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            roleId: req.user.roleId,
            companyId: req.user.companyId
        };

        const menu = await menuService.getMenu(user);

        return res.status(200).json({
            success: true,
            message: "Menu fetched successfully.",
            data: menu
        });

    } catch (error) {

        console.error("Get Menu Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch menu.",
            error: error.message
        });

    }
};

/**
 * ------------------------------------------------------------
 * Get Sidebar Menu
 * GET /api/menu/sidebar
 * ------------------------------------------------------------
 */
exports.getSidebarMenu = async (req, res) => {

    try {

        const user = {
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            roleId: req.user.roleId,
            companyId: req.user.companyId
        };

        const menu = await menuService.getSidebarMenu(user);

        return res.status(200).json({
            success: true,
            message: "Sidebar menu fetched successfully.",
            data: menu
        });

    } catch (error) {

        console.error("Sidebar Menu Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch sidebar menu.",
            error: error.message
        });

    }

};

/**
 * ------------------------------------------------------------
 * Get Top Navigation Menu
 * GET /api/menu/top
 * ------------------------------------------------------------
 */
exports.getTopMenu = async (req, res) => {

    try {

        const user = {
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            roleId: req.user.roleId,
            companyId: req.user.companyId
        };

        const menu = await menuService.getTopMenu(user);

        return res.status(200).json({
            success: true,
            message: "Top menu fetched successfully.",
            data: menu
        });

    } catch (error) {

        console.error("Top Menu Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch top menu.",
            error: error.message
        });

    }

};

/**
 * ------------------------------------------------------------
 * Refresh User Menu
 * GET /api/menu/refresh
 * ------------------------------------------------------------
 */
exports.refreshMenu = async (req, res) => {

    try {

        const user = {
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            roleId: req.user.roleId,
            companyId: req.user.companyId
        };

        const menu = await menuService.refreshMenu(user);

        return res.status(200).json({
            success: true,
            message: "Menu refreshed successfully.",
            data: menu
        });

    } catch (error) {

        console.error("Refresh Menu Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to refresh menu.",
            error: error.message
        });

    }

};

/**
 * ------------------------------------------------------------
 * Get User Permissions
 * GET /api/menu/permissions
 * ------------------------------------------------------------
 */
exports.getPermissions = async (req, res) => {

    try {

        const user = {
            userId: req.user.userId,
            employeeId: req.user.employeeId,
            roleId: req.user.roleId,
            companyId: req.user.companyId
        };

        const permissions = await menuService.getPermissions(user);

        return res.status(200).json({
            success: true,
            message: "Permissions fetched successfully.",
            data: permissions
        });

    } catch (error) {

        console.error("Permissions Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch permissions.",
            error: error.message
        });

    }

};