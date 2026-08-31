const profileService = require("../services/profileService");

/**
 * ============================================================
 * Profile Controller
 * Enterprise Goal Tracker Management System
 * ============================================================
 */

/**
 * Get Logged-in User Profile
 * GET /api/v1/profile
 */
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id || req.user?.UserId;
        const profile = await profileService.getProfile(userId);

        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully.",
            data: profile
        });

    } catch (error) {
        console.error("Get Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Update Profile
 * PUT /api/v1/profile
 */
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id || req.user?.UserId;
        const profile = await profileService.updateProfile(
            userId,
            req.body
        );

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully.",
            data: profile
        });

    } catch (error) {
        console.error("Update Profile Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Change Password
 * PUT /api/v1/profile/change-password
 */
exports.changePassword = async (req, res) => {
    try {
        // Safely extract user ID supporting multiple naming conventions
        const user = {
            userId: req.user?.userId || req.user?.id || req.user?.UserId
        };

        const {
            currentPassword,
            newPassword,
            confirmPassword
        } = req.body;

        // Pass user object and body data properly to profileService
        const result = await profileService.changePassword(
            user,
            { currentPassword, newPassword, confirmPassword }
        );

        return res.status(200).json({
            success: true,
            message: result.message || "Password changed successfully.",
            data: result
        });

    } catch (error) {
        console.error("Change Password Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message || "Failed to change password."
        });
    }
};

/**
 * Upload Avatar
 * POST /api/v1/profile/avatar
 */
exports.uploadAvatar = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id || req.user?.UserId;
        const result = await profileService.uploadAvatar(
            userId,
            req.file
        );

        return res.status(200).json({
            success: true,
            message: "Profile photo updated successfully.",
            data: result
        });

    } catch (error) {
        console.error("Upload Avatar Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Remove Avatar
 * DELETE /api/v1/profile/avatar
 */
exports.removeAvatar = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id || req.user?.UserId;
        const result = await profileService.removeAvatar(userId);

        return res.status(200).json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error("Remove Avatar Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get Login History
 * GET /api/v1/profile/login-history
 */
exports.getLoginHistory = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id || req.user?.UserId;
        const history = await profileService.getLoginHistory(userId);

        return res.status(200).json({
            success: true,
            data: history
        });

    } catch (error) {
        console.error("Login History Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};