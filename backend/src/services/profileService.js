const bcrypt = require("bcrypt");
const { poolPromise } = require("../config/db");
const profileModel = require("../models/profileModel");
const passwordHistoryModel = require("../models/passwordHistoryModel");
const { validateNewPassword, passwordErrorMessage } = require("../validations/passwordValidation");
const withTransaction = require("../utils/withTransaction");
const AppError = require("../utils/AppError");
const { BCRYPT_SALT_ROUNDS, PasswordMessages } = require("../constants/passwordPolicyConstants");

const toBool = (value) => value === true || value === 1 || value === "1";

/**
 * Rejected password change: `message` plus every failed rule in `errors`.
 */
const passwordRejected = (errors, statusCode = 400) =>
    new AppError(passwordErrorMessage(errors), statusCode, errors);

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

const getApprovers = async (userData) => {
    const userId = extractUserId(userData);
    if (!userId) throw new Error("User Id is required.");
    return profileModel.getApprovers(userId);
};

const updateHierarchy = async (userData, data) => {
    const userId = extractUserId(userData);
    if (!userId) throw new Error("User Id is required.");
    const parseId = (value, field) => {
        if (value === "" || value === null || value === undefined) return null;
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${field} is invalid.`);
        return parsed;
    };
    const managerId = parseId(data.reportingManagerId, "Reporting manager");
    const hodId = parseId(data.hodId, "HOD");
    if (managerId === Number(userId) || hodId === Number(userId)) {
        throw new Error("You cannot select yourself as your manager or HOD.");
    }
    const updated = await profileModel.updateHierarchy(userId, managerId, hodId);
    if (!updated) throw new Error("Select an active user with role Manager, HOD or BusinessHead.");
    return profileModel.getProfile(userId);
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
        throw passwordRejected([PasswordMessages.CURRENT_REQUIRED]);
    }

    const pool = await poolPromise;
    const user = await passwordHistoryModel.getUserForPasswordChange(pool, userId);

    if (!user) {
        throw new Error("User not found.");
    }

    const passwordMatched = await bcrypt.compare(
        currentPassword,
        user.PasswordHash
    );

    if (!passwordMatched) {
        throw passwordRejected([PasswordMessages.CURRENT_INCORRECT]);
    }

    const validation = await validateNewPassword({
        newPassword,
        confirmPassword,
        user,
        previousHashes: await passwordHistoryModel.getRecentHashes(pool, userId),
    });

    if (!validation.isValid) {
        throw passwordRejected(validation.errors);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    // The old hash goes into PasswordHistory in the same transaction.
    const changed = await withTransaction(async (transaction) => {
        if (!(await profileModel.updatePassword(transaction, userId, passwordHash, user.PasswordHash))) {
            return false;
        }

        await passwordHistoryModel.archivePassword(
            transaction, userId, user.PasswordHash, toBool(user.DefaultPasswordFlag)
        );
        return true;
    });

    if (!changed) {
        throw passwordRejected([PasswordMessages.CHANGED_ELSEWHERE], 409);
    }

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
    getApprovers,
    updateHierarchy,
    updateProfile,
    changePassword,
    uploadAvatar,
    removeAvatar,
    getLoginHistory
};
