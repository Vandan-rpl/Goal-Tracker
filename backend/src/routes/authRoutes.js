const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * ============================================================
 * Authentication Routes
 * Enterprise Goal Tracker Management System
 * ============================================================
 */

// User Login Route
router.post('/login', authController.login);

// Forgot Password Request Route
router.post('/forgot-password', authController.forgotPassword);

// Public route for completing forgot-password reset via email token
router.post('/reset-password-token', authController.resetPasswordWithToken);

// Protected route for logged-in user forced reset
router.post('/reset-password', verifyToken, authController.forceResetPassword);

module.exports = router;