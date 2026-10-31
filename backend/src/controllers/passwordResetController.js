const passwordResetService = require("../services/passwordResetService");
const { successResponse, errorResponse } = require("../utils/apiResponse");
const {
    OTP_LENGTH,
    OTP_VALID_MINUTES,
    OTP_RESEND_GAP_SECONDS,
    ResetMessages,
} = require("../constants/passwordResetConstants");

/**
 * Send an AppError's status/message/errors as-is; anything else is a 500.
 */
const handleError = (res, error, label, fallbackMessage) => {

    if (error.statusCode) {
        return errorResponse(res, error.statusCode, error.message, error.errors);
    }

    console.error(`${label} Error:`, error);

    return errorResponse(res, 500, fallbackMessage);
};

// req.ip honours X-Forwarded-For from one proxy hop (app.set("trust proxy", 1)).
const clientInfo = (req) => ({
    ip: req.ip,
    userAgent: req.get("user-agent") || null,
});

/**
 * Forgot Password Step 1: Request OTP
 * POST /api/v1/auth/forgot-password/request-otp
 * Body: { email }
 *
 * Always the same answer, whether or not the email is registered.
 */
exports.requestOtp = async (req, res) => {

    try {

        await passwordResetService.requestOtp({ email: req.body?.email, ...clientInfo(req) });

    } catch (error) {

        // Only a bad email address is reported; anything else still gets
        // the generic answer so it reveals nothing.
        if (error.statusCode) {
            return handleError(res, error, "Request Password Reset OTP");
        }

        console.error("Request Password Reset OTP Error:", error);

    }

    return successResponse(res, 200, ResetMessages.GENERIC_REQUEST, {
        otpLength: OTP_LENGTH,
        otpValidMinutes: OTP_VALID_MINUTES,
        resendAfterSeconds: OTP_RESEND_GAP_SECONDS,
    });

};

/**
 * Forgot Password Step 2: Verify OTP
 * POST /api/v1/auth/forgot-password/verify-otp
 * Body: { email, otp }
 */
exports.verifyOtp = async (req, res) => {

    try {

        const data = await passwordResetService.verifyOtp({
            email: req.body?.email,
            otp: req.body?.otp,
            ...clientInfo(req),
        });

        return successResponse(res, 200, ResetMessages.OTP_VERIFIED, data);

    } catch (error) {

        return handleError(res, error, "Verify Password Reset OTP", "Failed to verify the OTP.");

    }

};

/**
 * Forgot Password Step 3: Set New Password
 * POST /api/v1/auth/forgot-password/reset-password
 * Body: { resetToken, newPassword, confirmPassword }
 */
exports.resetPassword = async (req, res) => {

    try {

        await passwordResetService.resetPassword({
            resetToken: req.body?.resetToken,
            newPassword: req.body?.newPassword,
            confirmPassword: req.body?.confirmPassword,
            ...clientInfo(req),
        });

        return successResponse(res, 200, ResetMessages.RESET_SUCCESS);

    } catch (error) {

        return handleError(res, error, "Reset Password", "Failed to reset the password.");

    }

};

/**
 * Old emailed reset link was opened (the link no longer works)
 * POST /api/v1/auth/forgot-password/legacy-link-opened
 */
exports.legacyLinkOpened = (req, res) => {

    passwordResetService.recordLegacyLinkOpened(clientInfo(req));

    return successResponse(res, 200, ResetMessages.LEGACY_LINK);

};
