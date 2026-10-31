/**
 * ============================================================
 * Password Policy and Login Lockout Constants
 * ============================================================
 */

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 64;

// bcrypt ignores everything after the first 72 bytes (UTF-8).
const PASSWORD_MAX_BYTES = 72;

// At least this many of: uppercase, lowercase, digit, special character.
const PASSWORD_MIN_CHAR_TYPES = 3;

// New passwords may not reuse any of this many previous passwords.
const PASSWORD_HISTORY_COUNT = 3;

// Personal words shorter than this are ignored.
const PERSONAL_WORD_MIN_LENGTH = 3;

const BLOCKED_WORDS = Object.freeze(["rubamin", "goaltracker"]);

const BCRYPT_SALT_ROUNDS = 10;

// Login lockout
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

const PasswordMessages = Object.freeze({
    NOT_ACCEPTED: "Your new password does not meet the password requirements.",
    REQUIRED: "New password is required.",
    MISMATCH: "New password and confirm password do not match.",
    LENGTH: `Password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters long.`,
    TOO_LONG: "Password is too long.",
    ONLY_SPACES: "Password cannot be only spaces.",
    CHAR_TYPES: `Password must contain at least ${PASSWORD_MIN_CHAR_TYPES} of these 4: uppercase letter, lowercase letter, number, special character.`,
    TOO_COMMON: "This password is too common or easy to guess.",
    SAME_AS_CURRENT: "New password must be different from your current password.",
    IN_HISTORY: `New password cannot be the same as any of your last ${PASSWORD_HISTORY_COUNT} passwords.`,
    CURRENT_REQUIRED: "Current password is required.",
    CURRENT_INCORRECT: "Current password is incorrect.",
    CHANGED_ELSEWHERE: "Your password was changed in another session. Please try again.",
});

const LoginMessages = Object.freeze({
    INVALID_CREDENTIALS: "Invalid username/email or password.",
    LOCKED_OUT: `Too many failed attempts. Try again after ${LOCKOUT_MINUTES} minutes or use Forgot Password.`,
});

module.exports = {
    PASSWORD_MIN_LENGTH,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MAX_BYTES,
    PASSWORD_MIN_CHAR_TYPES,
    PASSWORD_HISTORY_COUNT,
    PERSONAL_WORD_MIN_LENGTH,
    BLOCKED_WORDS,
    BCRYPT_SALT_ROUNDS,
    MAX_FAILED_LOGINS,
    LOCKOUT_MINUTES,
    PasswordMessages,
    LoginMessages,
};
