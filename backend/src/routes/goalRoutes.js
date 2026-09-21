const express = require('express');
const router = express.Router();
const { 
    getGoals,
    getJointAccountabilityUsers,
    getAllEmployeeGoals,
    getGoalById,
    createGoal, 
    updateGoal,
    deleteGoal,
    changeGoalStatus,
    submitGoalReview,
    getGoalHistory,
    updateSubGoalStatus
} = require('../controllers/goalController');

const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

//get particular employee goals
router.get('/', getGoals);

router.get('/joint-accountability-users', getJointAccountabilityUsers);

//get all employee goals for CFO
router.get('/all-employee-goals', getAllEmployeeGoals);

//Get goal history for a particular goal
router.get("/:id/history", getGoalHistory);

// Authenticated and hierarchy-authorized single-goal view.
router.get('/:id', getGoalById);

router.post('/', createGoal);

// Submit HOD / Business Head review (requires login, so req.user is populated)
router.post('/review', submitGoalReview);
// IMPORTANT: Keep status update route BEFORE router.put('/:id', updateGoal) 
// so '/status/:id' matches correctly instead of treating 'status' as an ID.
router.put('/status/:id', changeGoalStatus); 

router.put('/:id', updateGoal);
router.delete('/:id', deleteGoal);

router.put(
  "/:goalId/subgoals/:subGoalId/status",
  verifyToken,
  updateSubGoalStatus,
);

module.exports = router;
