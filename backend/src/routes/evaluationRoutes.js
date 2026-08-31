const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const evaluationController = require('../controllers/evaluationController');

// GET /api/v1/evaluation/:userId?cycle=YYYY — self, HOD, reporting manager,
// or Business Head of the target employee may view. Access rule enforced
// inside the controller (canAccessEvaluation), not here, since it depends
// on the specific target employee's hierarchy, not just a static role.
router.get('/:userId', verifyToken, evaluationController.viewFinalEvaluation);

// POST /api/v1/evaluation/:userId/finalize — HOD/reporting manager/Business
// Head only. Computes the same evaluation and notifies the employee. See
// the big comment in evaluationController.js for why this doesn't persist
// an immutable record.
router.post('/:userId/finalize', verifyToken, evaluationController.finalizeFinalEvaluation);

module.exports = router;
