/**
 * ============================================================
 * New Password Validation
 * The single place that decides whether a new password is acceptable for
 * the Forgot Password flow. Add password policy rules (length, character
 * classes, history, ...) here; the reset flow only reads isValid/errors.
 *
 * Note: bcrypt only uses the first 72 bytes of a password.
 * ============================================================
 */

const validateNewPassword = ({ newPassword, confirmPassword }) => {
    const errors = [];

    if (typeof newPassword !== "string" || newPassword.trim() === "") {
        errors.push("New password is required.");
    } else if (newPassword !== confirmPassword) {
        errors.push("New password and confirm password do not match.");
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

module.exports = {
    validateNewPassword,
};
