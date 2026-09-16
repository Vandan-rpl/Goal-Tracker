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
    submitGoalReview
} = require('../controllers/goalController');

const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken);

//get particular employee goals
router.get('/', getGoals);

router.get('/joint-accountability-users', getJointAccountabilityUsers);

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