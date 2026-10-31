const bcrypt = require("bcryptjs");
const { poolPromise, sql } = require("../config/db");
const passwordResetModel = require("../models/passwordResetModel");
const { sendPasswordResetOtpMail, sendPasswordChangedMail } = require("./authMailService");
const passwordHistoryModel = require("../models/passwordHistoryModel");
const { validateNewPassword, passwordErrorMessage } = require("../validations/passwordValidation");
const { createRateLimiter } = require("../utils/rateLimiter");
const AppError = require("../utils/AppError");
const logger = require("../utils/logger");
const StatusCodes = require("../constants/statusCodes");
const {
    hashOtp,
    hashResetToken,
    hashesMatch,
    generateOtp,
    generateResetToken,
    isResetTokenFormat,
} = require("../utils/passwordResetCrypto");
const {
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
} = require("../constants/passwordResetConstants");

/**
 * ============================================================
 * Password Reset Service
 * Forgot Password by emailed OTP:
 *   1. requestOtp       always answers with the generic message
 *   2. verifyOtp        correct OTP -> single-use reset token
 *   3. resetPassword    reset token + new password
 *
 * Never logs or returns the OTP, the reset token or the password.
 * ============================================================
 */

const EMAIL_MAX_LENGTH = 150;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`);
const PASSWORD_SALT_ROUNDS = 10;

const requestIpLimiter = createRateLimiter(RATE_LIMITS.REQUEST_PER_IP);
const requestEmailLimiter = createRateLimiter(RATE_LIMITS.REQUEST_PER_EMAIL);
const verifyIpLimiter = createRateLimiter(RATE_LIMITS.VERIFY_PER_IP);
const resetIpLimiter = createRateLimiter(RATE_LIMITS.RESET_PER_IP);
const legacyLinkIpLimiter = createRateLimiter(RATE_LIMITS.LEGACY_LINK_LOG_PER_IP);

const toBool = (value) => value === true || value === 1 || value === "1";

const errorMessage = (error) => (error && error.message ? error.message : error);

/**
 * One log line per event: [PASSWORD RESET] event=... userId=... ip=...
 */
const logEvent = (level, event, fields = {}) => {
    const details = Object.entries(fields)
        .filter(([, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => `${key}=${value}`)
        .join(" ");

    logger[level](`[PASSWORD RESET] event=${event}${details ? ` ${details}` : ""}`);
};

const withTransaction = async (work) => {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    try {
        const result = await work(transaction);
        await transaction.commit();
        return result;
    } catch (error) {
        try {
            await transaction.rollback();
        } catch (rollbackError) {
            console.error("Password Reset Transaction Rollback Error:", rollbackError);
        }
        throw error;
    }
};

/**
 * Trimmed email; 400 when it is empty or not an email address.
 */
const normalizeEmail = (email) => {
    const value = typeof email === "string" ? email.trim() : "";

    if (!value) {
        throw new AppError(ResetMessages.EMAIL_REQUIRED, StatusCodes.BAD_REQUEST, [ResetErrorCode.VALIDATION]);
    }

    if (value.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(value)) {
        throw new AppError(ResetMessages.EMAIL_INVALID, StatusCodes.BAD_REQUEST, [ResetErrorCode.VALIDATION]);
    }

    return value;
};

const resetError = (code, statusCode = StatusCodes.BAD_REQUEST) =>
    new AppError(ResetMessages[code], statusCode, [code]);

const tooManyAttempts = () =>
    new AppError(ResetMessages.TOO_MANY_ATTEMPTS, 429, [ResetErrorCode.TOO_MANY_ATTEMPTS]);

/**
 * Step 1. Never reveals whether the email exists, is inactive, or was
 * rate limited: the controller always answers with the generic message.
 * The OTP email is sent in the background so the response time is the same
 * whether or not the email is registered.
 */
const requestOtp = async ({ email, ip, userAgent }) => {
    const normalizedEmail = normalizeEmail(email);
    const emailKey = normalizedEmail.toLowerCase();

    if (!requestIpLimiter.hit(ip)) {
        logEvent("warn", "rate_limited", { scope: "request_per_ip", email: normalizedEmail, ip });
        return;
    }

    if (!requestEmailLimiter.hit(emailKey)) {
        logEvent("warn", "rate_limited", { scope: "request_per_email", email: normalizedEmail, ip });
        return;
    }

    const pool = await poolPromise;
    const user = await passwordResetModel.findUserByEmail(pool, normalizedEmail);

    if (!user) {
        logEvent("warn", "otp_request_ignored", { reason: "email_not_found", email: normalizedEmail, ip });
        return;
    }

    if (!toBool(user.IsActive)) {
        logEvent("warn", "otp_request_ignored", { reason: "user_inactive", userId: user.UserID, ip });
        return;
    }

    if (!String(user.Email || "").trim()) {
        logEvent("warn", "otp_request_ignored", { reason: "user_has_no_email", userId: user.UserID, ip });
        return;
    }

    const otp = generateOtp();

    const outcome = await withTransaction(async (transaction) => {
        await passwordResetModel.lockUserResetRequests(transaction, user.UserID);

        const stats = await passwordResetModel.getRecentRequestStats(transaction, user.UserID);

        if (stats.RequestsLastHour >= MAX_OTP_REQUESTS_PER_HOUR) {
            return { limited: "hourly_limit" };
        }

        if (stats.SecondsSinceLast !== null && stats.SecondsSinceLast < OTP_RESEND_GAP_SECONDS) {
            return { limited: "resend_gap" };
        }

        const superseded = await passwordResetModel.invalidateOpenRows(
            transaction, user.UserID, InvalidatedReason.SUPERSEDED
        );

        const resetId = await passwordResetModel.insertOtpRow(transaction, {
            userId: user.UserID,
            otpHash: hashOtp(user.UserID, otp),
            validMinutes: OTP_VALID_MINUTES,
            requestIp: ip ? String(ip).slice(0, 45) : null,
            userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        });

        return { resetId, superseded };
    });

    if (outcome.limited) {
        logEvent("warn", "rate_limited", { scope: outcome.limited, userId: user.UserID, ip });
        return;
    }

    logEvent("info", "otp_requested", {
        userId: user.UserID,
        resetId: outcome.resetId,
        supersededRows: outcome.superseded,
        ip,
    });

    sendPasswordResetOtpMail({ user, otp, validMinutes: OTP_VALID_MINUTES })
        .then(() => logEvent("info", "otp_mail_sent", { userId: user.UserID, resetId: outcome.resetId, ip }))
        .catch((error) => logEvent("error", "otp_mail_failed", {
            userId: user.UserID,
            resetId: outcome.resetId,
            ip,
            error: errorMessage(error),
        }));
};

/**
 * Step 2. Correct OTP -> returns a single-use reset token (only its hash is
 * stored). Wrong/expired/locked OTP -> AppError with a ResetErrorCode.
 * Unknown or inactive email answers exactly like a wrong OTP.
 */
const verifyOtp = async ({ email, otp, ip }) => {
    const normalizedEmail = normalizeEmail(email);
    const otpValue = typeof otp === "string" ? otp.trim() : String(otp ?? "");

    if (!OTP_PATTERN.test(otpValue)) {
        throw new AppError(ResetMessages.OTP_FORMAT, StatusCodes.BAD_REQUEST, [ResetErrorCode.VALIDATION]);
    }

    if (!verifyIpLimiter.hit(ip)) {
        logEvent("warn", "rate_limited", { scope: "verify_per_ip", email: normalizedEmail, ip });
        throw tooManyAttempts();
    }

    const pool = await poolPromise;
    const user = await passwordResetModel.findUserByEmail(pool, normalizedEmail);

    if (!user || !toBool(user.IsActive)) {
        logEvent("warn", "otp_wrong_attempt", {
            reason: user ? "user_inactive" : "email_not_found",
            userId: user ? user.UserID : null,
            email: user ? null : normalizedEmail,
            ip,
        });
        throw resetError(ResetErrorCode.OTP_INCORRECT);
    }

    const outcome = await withTransaction(async (transaction) => {
        const row = await passwordResetModel.getLatestRowForUpdate(transaction, user.UserID);

        if (!row) {
            return { result: ResetErrorCode.OTP_INCORRECT, reason: "no_otp_requested" };
        }

        const base = { resetId: row.ResetID };

        if (row.Status === ResetStatus.LOCKED) {
            return { ...base, result: ResetErrorCode.OTP_LOCKED, reason: "already_locked" };
        }

        if (row.Status === ResetStatus.EXPIRED) {
            return { ...base, result: ResetErrorCode.OTP_EXPIRED, reason: "already_expired" };
        }

        if (row.Status !== ResetStatus.PENDING) {
            return { ...base, result: ResetErrorCode.OTP_NOT_VALID, reason: `status_${row.Status}` };
        }

        if (toBool(row.IsOtpExpired)) {
            const expiredNow = await passwordResetModel.markExpired(transaction, row.ResetID, ResetStatus.PENDING);
            return { ...base, result: ResetErrorCode.OTP_EXPIRED, expiredNow };
        }

        if (!hashesMatch(row.OTPHash, hashOtp(user.UserID, otpValue))) {
            const attempt = await passwordResetModel.recordWrongAttempt(transaction, row.ResetID, MAX_OTP_ATTEMPTS);

            if (!attempt) {
                return { ...base, result: ResetErrorCode.OTP_NOT_VALID, reason: "no_longer_pending" };
            }

            return {
                ...base,
                result: attempt.Status === ResetStatus.LOCKED ? ResetErrorCode.OTP_LOCKED : ResetErrorCode.OTP_INCORRECT,
                wrongAttempt: true,
                attemptCount: attempt.AttemptCount,
                lockedNow: attempt.Status === ResetStatus.LOCKED,
            };
        }

        const resetToken = generateResetToken();
        const verified = await passwordResetModel.markVerified(
            transaction, row.ResetID, hashResetToken(resetToken), RESET_TOKEN_VALID_MINUTES
        );

        if (!verified) {
            return { ...base, result: ResetErrorCode.OTP_NOT_VALID, reason: "no_longer_pending" };
        }

        return { ...base, result: "VERIFIED", resetToken };
    });

    const logFields = { userId: user.UserID, resetId: outcome.resetId, ip };

    if (outcome.result === "VERIFIED") {
        logEvent("info", "otp_verified", logFields);
        return {
            resetToken: outcome.resetToken,
            expiresInSeconds: RESET_TOKEN_VALID_MINUTES * 60,
        };
    }

    if (outcome.wrongAttempt) {
        logEvent("warn", "otp_wrong_attempt", { ...logFields, attemptCount: outcome.attemptCount });
    } else if (outcome.expiredNow) {
        logEvent("warn", "otp_expired", logFields);
    } else {
        logEvent("warn", "otp_rejected", { ...logFields, reason: outcome.reason || outcome.result });
    }

    if (outcome.lockedNow) {
        logEvent("warn", "otp_locked", logFields);
    }

    throw resetError(outcome.result);
};

/**
 * Step 3. Needs a Verified, unexpired reset token. Sets the new password,
 * marks the row Used and invalidates the user's other open rows, all in
 * one transaction. The confirmation email is sent after commit; its
 * failure never undoes the password change.
 */
const resetPassword = async ({ resetToken, newPassword, confirmPassword, ip }) => {
    if (!resetIpLimiter.hit(ip)) {
        logEvent("warn", "rate_limited", { scope: "reset_per_ip", ip });
        throw tooManyAttempts();
    }

    if (!isResetTokenFormat(resetToken)) {
        logEvent("warn", "reset_rejected", { reason: "malformed_token", ip });
        throw resetError(ResetErrorCode.RESET_SESSION_INVALID);
    }

    const tokenHash = hashResetToken(resetToken);
    const passwordHash = await bcrypt.hash(newPassword, await bcrypt.genSalt(PASSWORD_SALT_ROUNDS));

    const outcome = await withTransaction(async (transaction) => {
        const row = await passwordResetModel.getRowByResetTokenForUpdate(transaction, tokenHash);

        if (!row || !hashesMatch(row.ResetTokenHash, tokenHash)) {
            return { result: ResetErrorCode.RESET_SESSION_INVALID, reason: "token_not_found" };
        }

        const base = { resetId: row.ResetID, userId: row.UserID };

        if (row.Status !== ResetStatus.VERIFIED) {
            return { ...base, result: ResetErrorCode.RESET_SESSION_INVALID, reason: `status_${row.Status}` };
        }

        if (toBool(row.IsTokenExpired)) {
            const expiredNow = await passwordResetModel.markExpired(transaction, row.ResetID, ResetStatus.VERIFIED);
            return { ...base, result: ResetErrorCode.RESET_SESSION_EXPIRED, expiredNow };
        }

        if (!toBool(row.IsActive)) {
            return { ...base, result: ResetErrorCode.RESET_SESSION_INVALID, reason: "user_inactive" };
        }

        // Password policy needs the user. Rejected before markUsed, so the
        // reset token stays usable for another try.
        const user = await passwordHistoryModel.getUserForPasswordChange(transaction, row.UserID, { forUpdate: true });
        const validation = await validateNewPassword({
            newPassword,
            confirmPassword,
            user,
            previousHashes: await passwordHistoryModel.getRecentHashes(transaction, row.UserID),
        });

        if (!validation.isValid) {
            return { ...base, result: ResetErrorCode.VALIDATION, errors: validation.errors };
        }

        if (!(await passwordResetModel.markUsed(transaction, row.ResetID))) {
            return { ...base, result: ResetErrorCode.RESET_SESSION_INVALID, reason: "no_longer_verified" };
        }

        const changedAt = await passwordResetModel.updateUserPassword(transaction, row.UserID, passwordHash);

        if (!changedAt) {
            // Rolls back markUsed too.
            throw resetError(ResetErrorCode.RESET_SESSION_INVALID);
        }

        await passwordHistoryModel.archivePassword(
            transaction, row.UserID, user.PasswordHash, toBool(user.DefaultPasswordFlag)
        );

        await passwordResetModel.invalidateOpenRows(
            transaction, row.UserID, InvalidatedReason.PASSWORD_RESET, row.ResetID
        );

        return {
            ...base,
            result: "RESET",
            changedAt,
            user: {
                UserID: row.UserID,
                Username: row.Username,
                FirstName: row.FirstName,
                LastName: row.LastName,
                Email: row.Email,
            },
        };
    });

    const logFields = { userId: outcome.userId, resetId: outcome.resetId, ip };

    if (outcome.result === ResetErrorCode.VALIDATION) {
        // errors[0] stays the machine-readable code, the failed rules follow.
        logEvent("warn", "reset_rejected", { ...logFields, reason: "password_policy" });
        throw new AppError(
            passwordErrorMessage(outcome.errors),
            StatusCodes.BAD_REQUEST,
            [ResetErrorCode.VALIDATION, ...outcome.errors]
        );
    }

    if (outcome.result !== "RESET") {
        if (outcome.expiredNow) {
            logEvent("warn", "reset_token_expired", logFields);
        } else {
            logEvent("warn", "reset_rejected", { ...logFields, reason: outcome.reason || outcome.result });
        }
        throw resetError(outcome.result);
    }

    logEvent("info", "password_reset_success", logFields);

    sendPasswordChangedMail({ user: outcome.user, changedAt: outcome.changedAt })
        .then(() => logEvent("info", "confirmation_mail_sent", logFields))
        .catch((error) => logEvent("error", "confirmation_mail_failed", { ...logFields, error: errorMessage(error) }));
};

/**
 * An old emailed reset link was opened. Only logged (rate limited per IP so
 * the log cannot be flooded); the link itself does nothing any more.
 */
const recordLegacyLinkOpened = ({ ip, userAgent }) => {
    if (!legacyLinkIpLimiter.hit(ip)) {
        return;
    }

    logEvent("warn", "legacy_reset_link_opened", {
        ip,
        userAgent: userAgent ? JSON.stringify(String(userAgent).slice(0, 200)) : null,
    });
};

module.exports = {
    requestOtp,
    verifyOtp,
    resetPassword,
    recordLegacyLinkOpened,
};
