const crypto = require("crypto");
const { OTP_LENGTH } = require("../constants/passwordResetConstants");

/**
 * ============================================================
 * Forgot Password crypto helpers
 * OTPs and reset tokens are stored only as HMAC-SHA256 hashes keyed with
 * OTP_SECRET (backend .env). A plain hash of a 6-digit OTP could be
 * reversed in microseconds by anyone who can read the table; a keyed hash
 * cannot without the secret.
 * ============================================================
 */

const MIN_SECRET_LENGTH = 32;

// base64url of 32 random bytes
const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

let otpSecret = null;

/**
 * Called once at startup (server.js). Throws if OTP_SECRET is missing or
 * too short, so the backend never runs with an unkeyed or weak hash.
 */
const requireOtpSecret = () => {
    const secret = String(process.env.OTP_SECRET || "").trim();

    if (secret.length < MIN_SECRET_LENGTH) {
        throw new Error(
            `OTP_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters in backend .env. ` +
            "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }

    otpSecret = secret;
};

const keyedHash = (value) => {
    if (!otpSecret) {
        requireOtpSecret();
    }

    return crypto.createHmac("sha256", otpSecret).update(value, "utf8").digest("hex");
};

// The OTP hash is tied to the user, so the same code for two users never
// gives the same hash.
const hashOtp = (userId, otp) => keyedHash(`otp:${userId}:${otp}`);

const hashResetToken = (token) => keyedHash(`reset-token:${token}`);

/**
 * Timing-safe comparison of two hex hashes.
 */
const hashesMatch = (expectedHex, actualHex) => {
    const expected = Buffer.from(String(expectedHex || ""), "hex");
    const actual = Buffer.from(String(actualHex || ""), "hex");

    if (expected.length === 0 || expected.length !== actual.length) {
        return false;
    }

    return crypto.timingSafeEqual(expected, actual);
};

/**
 * 6-digit OTP from the cryptographically secure generator (leading zeros kept).
 */
const generateOtp = () =>
    String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

const generateResetToken = () => crypto.randomBytes(32).toString("base64url");

const isResetTokenFormat = (token) => typeof token === "string" && RESET_TOKEN_PATTERN.test(token);

module.exports = {
    requireOtpSecret,
    hashOtp,
    hashResetToken,
    hashesMatch,
    generateOtp,
    generateResetToken,
    isResetTokenFormat,
};
