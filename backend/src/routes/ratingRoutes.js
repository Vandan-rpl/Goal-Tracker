const express = require('express');
const router = express.Router();
const { submitQuarterlyUpdate, submitHODRating, getQuarterlyUpdates } = require('../controllers/ratingController');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');
const Roles = require('../constants/roles');

// NOTE ON ROLE MIDDLEWARE:
// There are two role-check middlewares in this codebase: authMiddleware.js's
// verifyRole() (checks req.user.role, lowercase) and middleware/authorizeRoles.js
// (checks req.user.Role, capital R). The JWT payload actually issued at login
// (see authController.js) only ever sets a lowercase `role` field, so
// authorizeRoles.js's capital-R check would never match and would 403 every
// request. verifyRole() is used here because it matches the real token shape.
// This is flagged in my response — worth fixing/consolidating separately.

// Employee submits their own quarterly progress update.
router.post('/quarterly-update', verifyToken, verifyRole([Roles.EMPLOYEE]), submitQuarterlyUpdate);

// HOD (or Business Head, who can also sit above an HOD) submits a rating + feedback.
// Fine-grained "is this actually the goal owner's HOD/manager" check happens
// inside the controller itself, since that requires looking up the specific goal.
router.post('/hod-rating', verifyToken, verifyRole([Roles.HOD, Roles.BUSINESS_HEAD]), submitHODRating);

// Quarterly update history for a specific goal — no route existed for this
// before (the frontend had nothing to fetch a goal's history from). Open to
// any authenticated role; the controller itself restricts the response to
// the goal owner or their HOD/reporting manager.
router.get('/quarterly-updates/:goalId', verifyToken, getQuarterlyUpdates);

module.exports = router;
