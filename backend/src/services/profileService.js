const bcrypt = require("bcrypt");
const profileModel = require("../models/profileModel");

/**
 * ============================================================
 * Profile Service
 * Enterprise Goal Tracker Management System
 * ============================================================
 */

/**
 * Helper function to extract user ID safely from primitive or object
 */
const extractUserId = (user) => {
    if (!user) return null;
    return typeof user === 'object' ? (user.userId || user.id || user.UserId) : user;
};

/**
 * Get Logged-in User Profile
 */
const getProfile = async (userData) => {
    const userId = extractUserId(userData);

    if (!userId) {
        throw new Error("User Id is required.");
    }

    const profile = await profileModel.getProfile(userId);

    if (!profile) {
        throw new Error("Profile not found.");
    }

    return profile;
};

/**
 * Update User Profile
 */
const updateProfile = async (userData, data) => {
    const userId = extractUserId(userData);

    if (!userId) {
        throw new Error("User Id is required.");
    }

    if (!data.firstName || data.firstName.trim() === "") {
        throw new Error("First Name is required.");
    }

    if (!data.lastName || data.lastName.trim() === "") {
        throw new Error("Last Name is required.");
    }

    if (!data.email || data.email.trim() === "") {
        throw new Error("Email is required.");
    }

    await profileModel.updateProfile(userId, data);

    return await profileModel.getProfile(userId);
};

/**
 * Change Password
 */
const changePassword = async (userData, bodyData) => {
    const userId = extractUserId(userData);
    const { currentPassword, newPassword, confirmPassword } = bodyData || {};

    if (!userId) {
        throw new Error("User Id is required.");
    }

    if (!currentPassword) {
        throw new Error("Current password is required.");
    }

    if (!newPassword) {
        throw new Error("New password is required.");
    }

    if (!confirmPassword) {
        throw new Error("Confirm password is required.");
    }

    if (newPassword !== confirmPassword) {
        throw new Error("New password and confirm password do not match.");
    }

    const user = await profileModel.getPasswordHash(userId);

    if (!user) {
        throw new Error("User not found.");
    }

    const passwordMatched = await bcrypt.compare(
        currentPassword,
        user.PasswordHash
    );

    if (!passwordMatched) {
        throw new Error("Current password is incorrect.");
    }

    const samePassword = await bcrypt.compare(
        newPassword,
        user.PasswordHash
    );

    if (samePassword) {
        throw new Error(
            "New password cannot be the same as the current password."
        );
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await profileModel.updatePassword(userId, passwordHash);

    await profileModel.savePasswordHistory(userId, passwordHash);

    return {
        success: true,
        message: "Password changed successfully."
    };
};

/**
 * Upload Profile Avatar
 */
const uploadAvatar = async (userData, file) => {
    const userId = extractUserId(userData);

    if (!userId) {
        throw new Error("User Id is required.");
    }

    if (!file) {
        throw new Error("Please upload an image.");
    }

    await profileModel.uploadAvatar(userId, file.filename);

    return await profileModel.getProfile(userId);
};

/**
 * Remove Profile Avatar
 */
const removeAvatar = async (userData) => {
    const userId = extractUserId(userData);

    if (!userId) {
        throw new Error("User Id is required.");
    }

    await profileModel.removeAvatar(userId);

    return {
        success: true,
        message: "Profile photo removed successfully."
    };
};

/**
 * Get Login History
 */
const getLoginHistory = async (userData) => {
    const userId = extractUserId(userData);

    if (!userId) {
        throw new Error("User Id is required.");
    }

    return await profileModel.getLoginHistory(userId);
};

module.exports = {
    getProfile,
    updateProfile,
    changePassword,
    uploadAvatar,
    removeAvatar,
    getLoginHistory
};