const express = require('express');
const router = express.Router();
const {
    getGoals,
    getMyQuarterSummary,
    getAddGoalStatus,
    getBringForwardGoals,
    bringForwardGoal,
    getJointAccountabilityUsers,
    getJointGoals,
    getAllEmployeeGoals,
    getGoalById,
    createGoal, 
    getGoalSheet,
    saveGoalSheet,
    updateGoal,
    deleteGoal,
    changeGoalStatus,
    submitGoalReview,
    getGoalHistory,
    updateSubGoalStatus,
    completeLastSubGoalAndSubmit,
    getTeamGoals,
    updateJointAccountabilityStatus,
    requestGoalCompletion,
    approveGoalCompletion,
    rejectGoalCompletion,
    getPendingCompletionRequests,
} = require('../controllers/goalController');

const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

//get particular employee goals
router.get('/', getGoals);

// Employee dashboard quarter summary. Keep above router.get('/:id').
router.get('/dashboard/quarters', getMyQuarterSummary);

// Add Goal sheet: the user's Draft goals for the target quarter, saved
// together. Keep above the '/:id' routes.
router.get('/sheet', getGoalSheet);
router.put('/sheet', saveGoalSheet);

// Goal Management header: Add Goal availability and goals to bring
// forward. Keep above the '/:id' routes.
router.get('/add-status', getAddGoalStatus);
router.get('/bring-forward', getBringForwardGoals);

router.get('/joint-accountability-users', getJointAccountabilityUsers);
router.get('/joint-accountability', getJointGoals);
router.patch('/joint-accountability/:id/status', updateJointAccountabilityStatus);

//get all employee goals for CFO
router.get('/all-employee-goals', getAllEmployeeGoals);

//Get team goals
router.get("/team", verifyToken, getTeamGoals);

// Goal completion approval. Keep the GET above router.get('/:id').
router.get('/completion-requests/pending', getPendingCompletionRequests);
router.post('/:id/completion/request', requestGoalCompletion);
router.post('/:id/completion/approve', approveGoalCompletion);
router.post('/:id/completion/reject', rejectGoalCompletion);

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

// New End Date for a goal on the bring-forward list, submitted through the
// existing carry-forward approval.
router.put('/:id/bring-forward', bringForwardGoal);

router.put('/:id', updateGoal);
router.delete('/:id', deleteGoal);

router.put(
  "/:goalId/subgoals/:subGoalId/status",
  verifyToken,
  updateSubGoalStatus,
);

// Ticks the last pending sub-goal and submits the goal for completion approval.
router.post(
  "/:goalId/subgoals/:subGoalId/complete-and-submit",
  completeLastSubGoalAndSubmit,
);

module.exports = router;
