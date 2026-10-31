/**
 * ============================================================
 * Forgot Password (emailed OTP) Constants
 * ============================================================
 */

const OTP_LENGTH = 6;
const OTP_VALID_MINUTES = 10;
const RESET_TOKEN_VALID_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;

// Per-user limits, counted from dbo.PasswordResetOTPs.CreatedAt
const MAX_OTP_REQUESTS_PER_HOUR = 5;
const OTP_RESEND_GAP_SECONDS = 60;

// In-memory limits (per Node process). These also cover emails that are
// not registered, which never get a DB row.
const RATE_LIMITS = Object.freeze({
    REQUEST_PER_IP: { windowMs: 15 * 60 * 1000, max: 20 },
    REQUEST_PER_EMAIL: { windowMs: 60 * 60 * 1000, max: MAX_OTP_REQUESTS_PER_HOUR },
    VERIFY_PER_IP: { windowMs: 15 * 60 * 1000, max: 30 },
    RESET_PER_IP: { windowMs: 15 * 60 * 1000, max: 20 },
    LEGACY_LINK_LOG_PER_IP: { windowMs: 15 * 60 * 1000, max: 20 },
});

// Values of dbo.PasswordResetOTPs.Status (CK_PasswordResetOTPs_Status)
const ResetStatus = Object.freeze({
    PENDING: "Pending",
    VERIFIED: "Verified",
    USED: "Used",
    EXPIRED: "Expired",
    LOCKED: "Locked",
    INVALIDATED: "Invalidated",
});

const InvalidatedReason = Object.freeze({
    SUPERSEDED: "Superseded",
    PASSWORD_RESET: "PasswordReset",
});

// Machine-readable code sent in `errors[0]` so the frontend can react
// (e.g. show "Resend OTP" for an expired or locked OTP).
const ResetErrorCode = Object.freeze({
    OTP_INCORRECT: "OTP_INCORRECT",
    OTP_EXPIRED: "OTP_EXPIRED",
    OTP_LOCKED: "OTP_LOCKED",
    OTP_NOT_VALID: "OTP_NOT_VALID",
    RESET_SESSION_INVALID: "RESET_SESSION_INVALID",
    RESET_SESSION_EXPIRED: "RESET_SESSION_EXPIRED",
    TOO_MANY_ATTEMPTS: "TOO_MANY_ATTEMPTS",
    VALIDATION: "VALIDATION",
});

const ResetMessages = Object.freeze({
    GENERIC_REQUEST: "If this email is registered, an OTP has been sent to it.",
    EMAIL_REQUIRED: "Please enter your email address.",
    EMAIL_INVALID: "Please enter a valid email address.",
    OTP_FORMAT: `Please enter the ${OTP_LENGTH}-digit OTP.`,
    OTP_INCORRECT: "Incorrect OTP. Please check the code and try again.",
    OTP_EXPIRED: "This OTP has expired. Please request a new OTP.",
    OTP_LOCKED: "Too many wrong attempts. Please request a new OTP.",
    OTP_NOT_VALID: "This OTP is no longer valid. Please request a new OTP.",
    OTP_VERIFIED: "OTP verified. You can now set a new password.",
    RESET_SESSION_INVALID: "This password reset session is no longer valid. Please use Forgot Password again.",
    RESET_SESSION_EXPIRED: "This password reset session has expired. Please use Forgot Password again.",
    RESET_SUCCESS: "Your password has been reset. Please log in with your new password.",
    TOO_MANY_ATTEMPTS: "Too many attempts. Please wait a few minutes and try again.",
    LEGACY_LINK: "This link is no longer valid. Please use Forgot Password again.",
});

module.exports = {
    OTP_LENGTH,
    OTP_VALID_MINUTES,
    RESET_TOKEN_VALID_MINUTES,
    MAX_OTP_ATTEMPTS,
    MAX_OTP_REQUESTS_PER_HOUR,
    OTP_RESEND_GAP_SECONDS,
    RATE_LIMITS,
    ResetStatus,
    InvalidatedReason,
    ResetErrorCode,
    ResetMessages,
};
