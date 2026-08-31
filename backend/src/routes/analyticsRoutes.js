const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { verifyToken } = require('../middleware/authMiddleware');

// Analytics & Dashboard Summary Endpoints
router.get('/dashboard-stats', verifyToken, analyticsController.getDashboardStats);
router.get('/department-stats', verifyToken, analyticsController.getDepartmentStats);
router.get('/quarter-trends', verifyToken, analyticsController.getQuarterCompletionTrend);

module.exports = router;