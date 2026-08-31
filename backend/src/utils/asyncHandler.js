/**
 * ==========================================================
 * Async Handler Utility
 * ==========================================================
 * Wraps async controller functions and forwards
 * any errors to the global error handler.
 * ==========================================================
 */

const asyncHandler = (handler) => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

module.exports = asyncHandler;