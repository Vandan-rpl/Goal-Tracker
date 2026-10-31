const { sendEmail } = require("./notifyService");
const logger = require("../utils/logger");

/**
 * ============================================================
 * Auth Mail Service
 * Forgot Password emails (the OTP, and "your password was changed") and the
 * welcome email with a temporary password (new users, Resend Credentials).
 *
 * Each send function throws on failure; the caller logs it. Never logs the
 * OTP or the temporary password.
 *
 * Config (backend .env):
 *   EMAIL_*                 sending (shared transporter in notifyService)
 *   FRONTEND_URL            base URL for the login link in the welcome email
 *   AUTH_MAIL_REDIRECT_TO   test mode: every auth email goes to this address
 *                           instead of the real recipient. Independent of
 *                           IDEA_MAIL_REDIRECT_TO. Empty = real recipients.
 * ============================================================
 */

const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const redirectAddress = () => String(process.env.AUTH_MAIL_REDIRECT_TO || "").trim();

/**
 * Called once at startup (server.js).
 */
const logAuthMailMode = () => {
    const redirectTo = redirectAddress();

    if (redirectTo) {
        logger.warn(`[AUTH MAIL] Redirect is ON: every OTP, password changed and welcome email goes to ${redirectTo} (AUTH_MAIL_REDIRECT_TO).`);
    } else {
        logger.info("[AUTH MAIL] Redirect is OFF: OTP, password changed and welcome emails go to the real recipients.");
    }
};

const displayName = (user) =>
    [user.FirstName, user.LastName].filter(Boolean).join(" ").trim() || user.Username || "there";

/**
 * The mssql driver returns DATETIME/DATETIME2 values with the SQL Server's
 * local wall-clock time in the UTC fields (GETDATE() -> useUTC), so read
 * them back with the UTC getters: DD/MM/YYYY hh:mm AM/PM, server time.
 */
const formatServerDateTime = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const pad = (n) => String(n).padStart(2, "0");
    const hours = date.getUTCHours();

    return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} ` +
        `${pad(hours % 12 || 12)}:${pad(date.getUTCMinutes())} ${hours < 12 ? "AM" : "PM"}`;
};

const loginUrl = () =>
    `${String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "")}/login`;

/**
 * Send to the user, or to AUTH_MAIL_REDIRECT_TO in test mode with the real
 * recipient named in the subject and in a banner at the top of the body.
 * greetingHtml replaces the default "Hello <name>," heading.
 */
const sendAuthMail = async ({ user, subject, bodyHtml, greetingHtml }) => {
    const recipient = String(user.Email || "").trim();

    if (!recipient) {
        throw new Error("User has no email address.");
    }

    const redirectTo = redirectAddress();

    const testBanner = redirectTo
        ? `<p style="padding: 10px 12px; background-color: #fde8e8; border: 1px dashed #d33;">TEST MODE: this email would have been sent to ${escapeHtml(displayName(user))} &lt;${escapeHtml(recipient)}&gt;.</p>`
        : "";

    await sendEmail({
        to: redirectTo || recipient,
        subject: redirectTo ? `[TEST] ${subject} (for ${recipient})` : subject,
        html: `
            <div style="font-family: Arial, sans-serif; font-size: 14px; color: #222;">
                ${testBanner}
                ${greetingHtml || `<h3>Hello ${escapeHtml(displayName(user))},</h3>`}
                ${bodyHtml}
                <p style="color: #777; font-size: 12px;">This is an automated email from Goal Tracker. Please do not reply.</p>
            </div>
        `,
    });
};

/**
 * @param {object} params
 * @param {object} params.user   { UserID, Username, FirstName, LastName, Email }
 * @param {string} params.otp
 * @param {number} params.validMinutes
 */
const sendPasswordResetOtpMail = ({ user, otp, validMinutes }) =>
    sendAuthMail({
        user,
        subject: "Password Reset OTP",
        bodyHtml: `
                <p>We received a request to reset your Goal Tracker password. Your one-time password (OTP) is:</p>
                <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 16px 0;">${escapeHtml(otp)}</p>
                <p>This OTP is valid for <strong>${escapeHtml(validMinutes)} minutes</strong>. Do not share it with anyone.</p>
                <p style="padding: 10px 12px; background-color: #eef6ee; border-left: 4px solid #4CAF50;">If you did not request this, ignore this email; your password will not change.</p>
        `,
    });

/**
 * @param {object} params
 * @param {object} params.user       { UserID, Username, FirstName, LastName, Email }
 * @param {Date}   params.changedAt  Users.PasswordChangedDate after the reset
 */
// Restored: passwordResetService calls this after every successful reset;
// while it was commented out that call threw a TypeError after the commit.
const sendPasswordChangedMail = ({ user, changedAt }) =>
    sendAuthMail({
        user,
        subject: "Your Goal Tracker password was changed",
        bodyHtml: `
                <p>The password for your Goal Tracker account was changed using Forgot Password on <strong>${escapeHtml(formatServerDateTime(changedAt))}</strong>.</p>
                <p style="padding: 10px 12px; background-color: #fff4e5; border-left: 4px solid #f59e0b;"><strong>If this was not you, contact IT immediately.</strong></p>
        `,
    });

/**
 * Welcome email with the temporary password: new users and Resend Credentials.
 * Callers send it only after the password is committed.
 *
 * @param {object} params
 * @param {object} params.user               { UserID, Username, FirstName, LastName, Email }
 * @param {string} params.temporaryPassword  plain text; never logged
 */
const sendWelcomeMail = ({ user, temporaryPassword }) => {
    const name = [user.FirstName, user.LastName].filter(Boolean).join(" ").trim() || user.Username;
    const link = loginUrl();

    return sendAuthMail({
        user,
        subject: "Your Goal Tracker account has been created",
        greetingHtml: `<p>Dear ${escapeHtml(name)},</p>`,
        bodyHtml: `
                <p>Your Goal Tracker account has been created.</p>
                <p>
                    Login ID: <strong>${escapeHtml(user.Email)}</strong><br>
                    Temporary Password: <strong style="font-family: Consolas, monospace; font-size: 16px;">${escapeHtml(temporaryPassword)}</strong><br>
                    Login here: <a href="${escapeHtml(link)}">${escapeHtml(link)}</a>
                </p>
                <p>For your security, you will be asked to change this password when you log in for the first time.</p>
                <p>Please do not share your password with anyone.</p>
                <p>Regards,<br>Rubamin Pvt. Ltd.</p>
        `,
    });
};

module.exports = {
    logAuthMailMode,
    sendPasswordResetOtpMail,
    sendPasswordChangedMail,
    sendWelcomeMail,
};
