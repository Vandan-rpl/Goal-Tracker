const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireGoalAccess } = require('../middleware/goalAccessMiddleware');
const { getTeamMembers, getUserGoals, updateStatus } = require('../controllers/teamController');

// Get team members reporting to logged-in HOD/Manager
// Open to every grade: Ideas uses it to tell whether the user has reportees.
router.get('/members', verifyToken, getTeamMembers);
router.get("/members/:userId", verifyToken, requireGoalAccess, getTeamMembers);
router.get('/user-goals/:userId', verifyToken, requireGoalAccess, getUserGoals);
router.put('/goal-status/:goalId', verifyToken, requireGoalAccess, updateStatus);

module.exports = router;