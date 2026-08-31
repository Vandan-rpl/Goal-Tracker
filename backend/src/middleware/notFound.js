const { errorResponse } = require("../utils/apiResponse");

/**
 * Handles requests for routes that do not exist.
 */
const notFound = (req, res) => {
  return errorResponse(
    res,
    404,
    "API endpoint not found.",
    [`${req.method} ${req.originalUrl} does not exist.`]
  );
};

module.exports = notFound;