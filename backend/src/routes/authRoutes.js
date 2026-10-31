const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passwordResetController = require('../controllers/passwordResetController');
const { verifyTokenForPasswordChange } = require('../middleware/authMiddleware');

/**
 * ============================================================
 * Authentication Routes
 * Enterprise Goal Tracker Management System
 * ============================================================
 */

// User Login Route
router.post('/login', authController.login);

// Forgot Password (emailed OTP) - public routes
router.post('/forgot-password/request-otp', passwordResetController.requestOtp);
router.post('/forgot-password/verify-otp', passwordResetController.verifyOtp);
router.post('/forgot-password/reset-password', passwordResetController.resetPassword);

// Old emailed reset links no longer work; the page only reports that it was opened
router.post('/forgot-password/legacy-link-opened', passwordResetController.legacyLinkOpened);

// Protected route for logged-in user forced reset. The only protected route
// a user on a temporary password (DefaultPasswordFlag = 1) can reach.
router.post('/reset-password', verifyTokenForPasswordChange, authController.forceResetPassword);

module.exports = router;
