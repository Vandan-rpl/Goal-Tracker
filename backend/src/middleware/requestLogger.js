const Logger = require("../utils/logger");

const requestLogger = (req, res, next) => {
  Logger.info(`${req.method} ${req.originalUrl}`);
  next();
};

module.exports = requestLogger;