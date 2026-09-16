const menuService = require("../services/menuService");

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