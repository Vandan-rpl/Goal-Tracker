const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const {
    PASSWORD_MIN_LENGTH,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MAX_BYTES,
    PASSWORD_MIN_CHAR_TYPES,
    PERSONAL_WORD_MIN_LENGTH,
    BLOCKED_WORDS,
    PasswordMessages,
} = require("../constants/passwordPolicyConstants");

/**
 * ============================================================
 * New Password Validation
 * The single place that decides whether a password a USER chose is
 * acceptable: forced change on first login, Forgot Password (OTP) reset
 * and Profile > Change Password. System temporary passwords do not come
 * through here.
 *
 * Validates exactly the string that will be hashed (no trimming) and
 * returns every failed rule. Never logs the password or puts it in an
 * error message.
 * ============================================================
 */

// Top 10,000 common passwords (SecLists 10k-most-common.txt), bundled so
// there are no runtime internet calls. Compared case-insensitively.
const COMMON_PASSWORDS = new Set(
    fs.readFileSync(path.join(__dirname, "../data/commonPasswords.txt"), "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean)
);

// Uppercase, lowercase, digit, special (anything that is not a letter,
// digit or whitespace). The frontend checklist uses the same definitions.
const CHAR_TYPE_PATTERNS = [/\p{Lu}/u, /\p{Ll}/u, /\p{Nd}/u, /[^\p{L}\p{N}\s]/u];

const countCharTypes = (password) =>
    CHAR_TYPE_PATTERNS.filter((pattern) => pattern.test(password)).length;

/**
 * Lower-cased words the password may not contain: first name, last name,
 * username, employee code, the email before @ (each whole and split into
 * parts), plus BLOCKED_WORDS. Words shorter than PERSONAL_WORD_MIN_LENGTH
 * are ignored.
 */
const personalWords = (user) => {
    const words = new Set(BLOCKED_WORDS);

    if (!user) {
        return [...words];
    }

    const emailLocalPart = user.Email ? String(user.Email).split("@")[0] : "";
    const values = [user.FirstName, user.LastName, user.Username, user.EmployeeCode, emailLocalPart];

    for (const value of values) {
        if (!value) continue;

        const text = String(value).trim().toLowerCase();

        for (const word of [text, ...text.split(/[^\p{L}\p{N}]+/u)]) {
            if (word.length >= PERSONAL_WORD_MIN_LENGTH) {
                words.add(word);
            }
        }
    }

    return [...words];
};

const matchesAnyHash = async (password, hashes) => {
    const results = await Promise.all(
        hashes.filter(Boolean).map((hash) => bcrypt.compare(password, hash))
    );
    return results.some(Boolean);
};

/**
 * @param {Object}   params
 * @param {string}   params.newPassword
 * @param {string}   params.confirmPassword
 * @param {Object}   [params.user]            Users row: FirstName, LastName, Username,
 *                                            EmployeeCode, Email, PasswordHash
 * @param {string[]} [params.previousHashes]  last PasswordHistory hashes
 * @returns {Promise<{ isValid: boolean, errors: string[] }>}
 */
const validateNewPassword = async ({ newPassword, confirmPassword, user = null, previousHashes = [] }) => {
    const errors = [];
    const result = () => ({ isValid: errors.length === 0, errors });

    if (typeof newPassword !== "string" || newPassword === "") {
        errors.push(PasswordMessages.REQUIRED);
        return result();
    }

    if (newPassword !== confirmPassword) {
        errors.push(PasswordMessages.MISMATCH);
    }

    if (newPassword.trim() === "") {
        errors.push(PasswordMessages.ONLY_SPACES);
        return result();
    }

    // Count characters (code points), not UTF-16 units.
    const length = [...newPassword].length;
    const byteLength = Buffer.byteLength(newPassword, "utf8");

    if (length < PASSWORD_MIN_LENGTH || length > PASSWORD_MAX_LENGTH) {
        errors.push(PasswordMessages.LENGTH);
    } else if (byteLength > PASSWORD_MAX_BYTES) {
        errors.push(PasswordMessages.TOO_LONG);
    }

    if (countCharTypes(newPassword) < PASSWORD_MIN_CHAR_TYPES) {
        errors.push(PasswordMessages.CHAR_TYPES);
    }

    const lower = newPassword.toLowerCase();

    if (COMMON_PASSWORDS.has(lower) || personalWords(user).some((word) => lower.includes(word))) {
        errors.push(PasswordMessages.TOO_COMMON);
    }

    // bcrypt ignores bytes after 72, so a longer password could falsely
    // "match" an old one; it is already rejected above.
    if (byteLength <= PASSWORD_MAX_BYTES) {
        if (user && user.PasswordHash && (await bcrypt.compare(newPassword, user.PasswordHash))) {
            errors.push(PasswordMessages.SAME_AS_CURRENT);
        } else if (await matchesAnyHash(newPassword, previousHashes)) {
            errors.push(PasswordMessages.IN_HISTORY);
        }
    }

    return result();
};

/**
 * `message` for a rejected password; the full list goes in `errors`.
 */
const passwordErrorMessage = (errors) =>
    errors.length === 1 ? errors[0] : PasswordMessages.NOT_ACCEPTED;

module.exports = {
    validateNewPassword,
    passwordErrorMessage,
};
