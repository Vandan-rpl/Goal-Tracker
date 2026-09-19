const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { getTeamMembers, getUserGoals, updateStatus } = require('../controllers/teamController');

// Get team members reporting to logged-in HOD/Manager
router.get('/members', verifyToken, getTeamMembers);
router.get("/members/:userId", verifyToken, getTeamMembers);
router.get('/user-goals/:userId', verifyToken, getUserGoals);
router.put('/goal-status/:goalId', verifyToken, updateStatus);

module.exports = router;