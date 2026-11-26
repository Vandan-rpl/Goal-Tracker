const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const { requireGoalAccess } = require('../middleware/goalAccessMiddleware');
const evaluationController = require('../controllers/evaluationController');

// GET /api/v1/evaluation/:userId?fiscalYear=YYYY — self, CFO,
// HOD, reporting manager, or Business Head may view. Access is enforced in
// the controller because it depends on the target employee's hierarchy.
router.get('/:userId', verifyToken, requireGoalAccess, evaluationController.viewFinalEvaluation);

// POST /api/v1/evaluation/:userId/finalize — HOD/reporting manager/Business
// Head only. Computes the same evaluation and notifies the employee. See
// the big comment in evaluationController.js for why this doesn't persist
// an immutable record.
router.post('/:userId/finalize', verifyToken, requireGoalAccess, evaluationController.finalizeFinalEvaluation);

module.exports = router;
