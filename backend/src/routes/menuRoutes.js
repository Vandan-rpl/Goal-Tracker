const express = require("express");
const router = express.Router();

const menuController = require("../controllers/menuController");

// Authentication Middleware
const authMiddleware = require("../middleware/authMiddleware");

// Authorization Middleware (Optional)
// const authorize = require("../middleware/authorizeMiddleware");

/**
 * ============================================================
 * Menu Routes
 * Base URL : /api/menu
 * ============================================================
 */

/**
 * Get Sidebar Menu
 * GET /api/menu/sidebar
 */
router.get(
    "/sidebar",
    authMiddleware,
    menuController.getSidebarMenu
);

/**
 * Get Top Menu
 * GET /api/menu/top
 */
router.get(
    "/top",
    authMiddleware,
    menuController.getTopMenu
);

/**
 * Get Complete Menu
 * GET /api/menu
 */
router.get(
    "/",
    authMiddleware,
    menuController.getMenu
);

/**
 * Refresh Menu
 * GET /api/menu/refresh
 */
router.get(
    "/refresh",
    authMiddleware,
    menuController.refreshMenu
);

/**
 * Get Role Permissions
 * GET /api/menu/permissions
 */
router.get(
    "/permissions",
    authMiddleware,
    menuController.getPermissions
);

module.exports = router;