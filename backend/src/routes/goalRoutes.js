const express = require('express');
const router = express.Router();
const { 
    getGoals,
    getAllEmployeeGoals,
    getGoalById,
    createGoal, 
    updateGoal,
    deleteGoal,
    changeGoalStatus,
    submitGoalReview
} = require('../controllers/goalController');

const { verifyToken } = require('../middleware/authMiddleware');

// ============================================
// PUBLIC ROUTES (no login required)
// Must be defined BEFORE router.use(verifyToken)
// AND before any wildcard '/:id' route.
// ============================================

// ============================================
// PROTECTED ROUTES (JWT required)
// ============================================
router.use(verifyToken);

//get particular employee goals
router.get('/', getGoals);

//get all employee goals for CFO
router.get('/all-employee-goals', getAllEmployeeGoals);

// Public: view a single goal via email link
router.get('/:id', getGoalById);

router.post('/', createGoal);

// Submit HOD / Business Head review (requires login, so req.user is populated)
router.post('/review', submitGoalReview);
// IMPORTANT: Keep status update route BEFORE router.put('/:id', updateGoal) 
// so '/status/:id' matches correctly instead of treating 'status' as an ID.
router.put('/status/:id', changeGoalStatus); 

router.put('/:id', updateGoal);
router.delete('/:id', deleteGoal);

module.exports = router;