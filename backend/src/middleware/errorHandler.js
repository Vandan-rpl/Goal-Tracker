const { errorResponse } = require("../utils/apiResponse");

/**
 * ==========================================================
 * Global Error Handler Middleware
 * ==========================================================
 * Handles all application errors in one place.
 * ==========================================================
 */

const errorHandler = (err, req, res, next) => {
  console.error("======================================");
  console.error("Application Error");
  console.error("URL:", req.originalUrl);
  console.error("Method:", req.method);
  console.error("Message:", err.message);
  console.error("Stack:", err.stack);
  console.error("======================================");

  const statusCode = err.statusCode || 500;

  return errorResponse(
    res,
    statusCode,
    err.message || "Internal Server Error.",
    [err.message]
  );
};

module.exports = errorHandler;