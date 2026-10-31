// Password rules shown as a live checklist while the user types.
//
// Guidance only: the backend (backend/src/validations/passwordValidation.js)
// is the authority and also rejects common passwords, personal words, the
// current password and the last 3 passwords. Keep these definitions in
// step with it.

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 64;
export const PASSWORD_MIN_CHAR_TYPES = 3;

export const CHAR_TYPES = [
  { key: 'upper', label: 'Uppercase', pattern: /\p{Lu}/u },
  { key: 'lower', label: 'Lowercase', pattern: /\p{Ll}/u },
  { key: 'digit', label: 'Number', pattern: /\p{Nd}/u },
  { key: 'special', label: 'Special', pattern: /[^\p{L}\p{N}\s]/u },
];

export const checkPassword = (password = '', confirmPassword = '') => {
  // Characters (code points), the same count as the backend.
  const length = [...password].length;
  const charTypes = CHAR_TYPES.map((type) => ({ ...type, met: type.pattern.test(password) }));

  return {
    length: length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH,
    charTypes,
    enoughCharTypes: charTypes.filter((type) => type.met).length >= PASSWORD_MIN_CHAR_TYPES,
    matches: confirmPassword !== '' && password === confirmPassword,
  };
};

// Every rule the backend rejected, from a { success, message, errors } body.
// The Forgot Password API puts a machine-readable code first (e.g.
// "VALIDATION"); pass it as `code` so it is left out.
export const passwordErrorsFrom = (data, code = null) => {
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  return (code && errors[0] === code ? errors.slice(1) : errors).filter(
    (item) => typeof item === 'string' && item.trim() !== '',
  );
};
