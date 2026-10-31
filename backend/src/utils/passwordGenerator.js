const crypto = require("crypto");

/**
 * Temporary passwords for new users and Resend Credentials.
 *
 * 12 characters from a CSPRNG (crypto.randomInt), with at least one
 * uppercase, lowercase, digit and special character, positions shuffled.
 * Look-alike characters 0 O o 1 l I are excluded so the password can be
 * typed from the welcome email without guessing.
 */
const TEMP_PASSWORD_LENGTH = 12;

const CHARSETS = {
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ", // no I, O
  lower: "abcdefghijkmnpqrstuvwxyz", // no l, o
  digit: "23456789", // no 0, 1
  special: "@#$%&*!?-",
};

const ALL_CHARS = Object.values(CHARSETS).join("");

const pick = (chars) => chars[crypto.randomInt(chars.length)];

const generateTemporaryPassword = () => {
  // One from each class guarantees the composition rule; the rest from all classes.
  const chars = Object.values(CHARSETS).map(pick);
  while (chars.length < TEMP_PASSWORD_LENGTH) chars.push(pick(ALL_CHARS));

  // Fisher-Yates so the guaranteed characters are not always at the front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
};

module.exports = {
  generateTemporaryPassword,
  TEMP_PASSWORD_LENGTH,
};
