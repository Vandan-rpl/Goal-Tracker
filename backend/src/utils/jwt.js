const jwt = require("jsonwebtoken");

/**
 * Generate JWT Access Token
 * @param {Object} payload
 * @returns {String} JWT Token
 */
const generateToken = (payload) => {
  try {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN,
    });
  } catch (error) {
    throw new Error("Failed to generate authentication token.");
  }
};

/**
 * Verify JWT Token
 * @param {String} token
 * @returns {Object} Decoded Payload
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid or expired authentication token.");
  }
};

module.exports = {
  generateToken,
  verifyToken,
};