const Messages = Object.freeze({
  // Common
  SUCCESS: "Success.",
  INTERNAL_SERVER_ERROR: "Internal Server Error.",
  VALIDATION_FAILED: "Validation failed.",

  // Authentication
  LOGIN_SUCCESS: "Login successful.",
  REGISTER_SUCCESS: "User registered successfully.",

  INVALID_CREDENTIALS:
    "Invalid username/email or password.",

  ACCOUNT_INACTIVE:
    "Your account has been deactivated.",

  UNAUTHORIZED:
    "Unauthorized access.",

  INVALID_TOKEN:
    "Invalid or expired authentication token.",

  TOKEN_REQUIRED:
    "Authorization token is required.",

  DUPLICATE_EMPLOYEE:
    "Employee Code already exists.",

  DUPLICATE_USERNAME:
    "Username already exists.",

  DUPLICATE_EMAIL:
    "Email already exists.",

  // Routes
  ROUTE_NOT_FOUND:
    "API endpoint not found.",
});

module.exports = Messages;