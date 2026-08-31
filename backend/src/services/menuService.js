const menuModel = require("../models/menuModel");

/**
 * ============================================================
 * Menu Service
 * Enterprise Goal Tracker Management System
 * ============================================================
 */

/**
 * Get Sidebar Menu
 */
const getSidebarMenu = async (roleId) => {

    if (!roleId) {
        throw new Error("Role Id is required.");
    }

    return await menuModel.getSidebarMenu(roleId);
};

/**
 * Get Top Menu
 */
const getTopMenu = async (roleId) => {

    if (!roleId) {
        throw new Error("Role Id is required.");
    }

    return await menuModel.getTopMenu(roleId);
};

/**
 * Get All Permissions
 */
const getPermissions = async (roleId) => {

    if (!roleId) {
        throw new Error("Role Id is required.");
    }

    return await menuModel.getPermissions(roleId);
};

/**
 * Refresh Menu
 */
const refreshMenu = async (roleId) => {

    if (!roleId) {
        throw new Error("Role Id is required.");
    }

    return await menuModel.refreshMenu(roleId);
};

/**
 * Get Menu by User
 */
const getMenu = async (userId) => {

    if (!userId) {
        throw new Error("User Id is required.");
    }

    return await menuModel.getMenu(userId);
};

module.exports = {

    getSidebarMenu,

    getTopMenu,

    getPermissions,

    refreshMenu,

    getMenu

};