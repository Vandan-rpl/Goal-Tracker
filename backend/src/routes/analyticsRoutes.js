const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { verifyToken } = require('../middleware/authMiddleware');
const { requireGoalAccess } = require('../middleware/goalAccessMiddleware');

// Analytics & Dashboard Summary Endpoints
router.get('/dashboard-stats', verifyToken, requireGoalAccess, analyticsController.getDashboardStats);
router.get('/department-stats', verifyToken, requireGoalAccess, analyticsController.getDepartmentStats);
router.get('/team-stats', verifyToken, requireGoalAccess, analyticsController.getTeamStats);
router.get('/team-performance', verifyToken, requireGoalAccess, analyticsController.getTeamPerformance);
router.get('/quarter-trends', verifyToken, requireGoalAccess, analyticsController.getQuarterCompletionTrend);

module.exports = router;