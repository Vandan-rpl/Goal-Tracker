/**
 * ==========================================================
 * API Response Utility
 * ==========================================================
 * Standardizes all API responses across the application.
 * ==========================================================
 */

/**
 * Send Success Response
 *
 * @param {Object} res - Express Response Object
 * @param {Number} statusCode - HTTP Status Code
 * @param {String} message - Success Message
 * @param {Object|Array|null} data - Response Data
 */
const successResponse = (
  res,
  statusCode = 200,
  message = "Success",
  data = null
) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send Error Response
 *
 * @param {Object} res - Express Response Object
 * @param {Number} statusCode - HTTP Status Code
 * @param {String} message - Error Message
 * @param {Array} errors - Validation/Error Details
 */
const errorResponse = (
  res,
  statusCode = 500,
  message = "Something went wrong.",
  errors = []
) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = {
  successResponse,
  errorResponse,
};