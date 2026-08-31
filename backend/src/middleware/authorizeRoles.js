const StatusCodes = require("../constants/statusCodes");
const Messages = require("../constants/messages");
const { errorResponse } = require("../utils/apiResponse");

/**
 * Role-Based Authorization Middleware
 *
 * Usage:
 * authorizeRoles("Admin")
 * authorizeRoles("Admin","HOD")
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(
        res,
        StatusCodes.UNAUTHORIZED,
        Messages.UNAUTHORIZED,
        ["Authentication required."]
      );
    }

    if (!allowedRoles.includes(req.user.Role)) {
      return errorResponse(
        res,
        StatusCodes.FORBIDDEN,
        "Access denied.",
        ["You do not have permission to access this resource."]
      );
    }

    next();
  };
};

module.exports = authorizeRoles;