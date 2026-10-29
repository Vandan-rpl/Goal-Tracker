const express = require("express");
const router = express.Router();

const ideaController = require("../controllers/ideaController");
const { verifyToken } = require("../middleware/authMiddleware");

/**
 * ============================================================
 * Idea Routes
 * Base URL : /api/v1/ideas
 * ============================================================
 * Fixed paths (/purposes, /leads, /my) are declared before
 * /:ideaId so they aren't captured as an id.
 */

/**
 * Get Purpose List
 * GET /api/v1/ideas/purposes
 */
router.get(
    "/purposes",
    verifyToken,
    ideaController.getPurposes
);

/**
 * Get Lead Options (active users except the logged-in user)
 * GET /api/v1/ideas/leads
 */
router.get(
    "/leads",
    verifyToken,
    ideaController.getLeadOptions
);

/**
 * Get Logged-in User's Ideas
 * GET /api/v1/ideas/my?status=
 */
router.get(
    "/my",
    verifyToken,
    ideaController.getMyIdeas
);

/**
 * Create Idea As Draft
 * POST /api/v1/ideas
 */
router.post(
    "/",
    verifyToken,
    ideaController.createDraft
);

/**
 * Get Idea Details With Activity Log
 * GET /api/v1/ideas/:ideaId
 */
router.get(
    "/:ideaId",
    verifyToken,
    ideaController.getIdeaById
);

/**
 * Update Draft
 * PUT /api/v1/ideas/:ideaId
 */
router.put(
    "/:ideaId",
    verifyToken,
    ideaController.updateDraft
);

/**
 * Delete Draft
 * DELETE /api/v1/ideas/:ideaId
 */
router.delete(
    "/:ideaId",
    verifyToken,
    ideaController.deleteDraft
);

/**
 * Submit Idea (Draft -> Submitted)
 * POST /api/v1/ideas/:ideaId/submit
 */
router.post(
    "/:ideaId/submit",
    verifyToken,
    ideaController.submitIdea
);

module.exports = router;
