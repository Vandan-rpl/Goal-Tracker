const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { verifyToken } = require('../middleware/authMiddleware'); // ખાતરી કરો કે verifyToken અથવા authMiddleware સાચી રીતે ઇમ્પોર્ટ થાય છે
const upload = require('../middleware/uploadMiddleware');

// Get Logged-in User Profile
router.get('/', verifyToken, profileController.getProfile);

// Update Profile
router.put('/', verifyToken, profileController.updateProfile);

// Change Password
router.put('/change-password', verifyToken, profileController.changePassword);

// Upload Profile Photo
router.post('/avatar', verifyToken, upload.single('avatar'), profileController.uploadAvatar);

// Remove Profile Photo
router.delete('/avatar', verifyToken, profileController.removeAvatar);

// Login History
router.get('/login-history', verifyToken, profileController.getLoginHistory);

module.exports = router;