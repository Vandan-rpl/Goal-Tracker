const express = require("express");
const router = express.Router();

const ideaController = require("../controllers/ideaController");
const { verifyToken } = require("../middleware/authMiddleware");

/**
 * ============================================================
 * Idea Routes
 * Base URL : /api/v1/ideas
 * ============================================================
 * Fixed paths (/purposes, /leads, /final-approvers, /my, /assigned, /team,
 * /all) are declared before
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
 * Get Reporting Manager Options (active Managers and HODs except the
 * logged-in user)
 * GET /api/v1/ideas/leads
 */
router.get(
    "/leads",
    verifyToken,
    ideaController.getLeadOptions
);

/**
 * Get Final Approver Options (active rows of dbo.IdeaFinalApprovers)
 * GET /api/v1/ideas/final-approvers
 */
router.get(
    "/final-approvers",
    verifyToken,
    ideaController.getFinalApproverOptions
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
 * Get Ideas Assigned To Me (logged-in user is the reporting manager or the
 * final approver)
 * GET /api/v1/ideas/assigned
 */
router.get(
    "/assigned",
    verifyToken,
    ideaController.getAssignedIdeas
);

/**
 * Get Team Ideas (users with direct reports)
 * GET /api/v1/ideas/team?search=&status=&purpose=&overdueOnly=&submittedFrom=
 *     &submittedTo=&memberId=&sortBy=&sortDir=&page=&pageSize=
 */
router.get(
    "/team",
    verifyToken,
    ideaController.getTeamIdeas
);

/**
 * Get Team Ideas Filter Options
 * GET /api/v1/ideas/team/filter-options
 */
router.get(
    "/team/filter-options",
    verifyToken,
    ideaController.getTeamIdeaFilterOptions
);

/**
 * Get All Ideas (CFO / Admin)
 * GET /api/v1/ideas/all?search=&status=&purpose=&overdueOnly=&submittedFrom=
 *     &submittedTo=&department=&leadId=&sortBy=&sortDir=&page=&pageSize=
 */
router.get(
    "/all",
    verifyToken,
    ideaController.getAllIdeas
);

/**
 * Get All Ideas Filter Options
 * GET /api/v1/ideas/all/filter-options
 */
router.get(
    "/all/filter-options",
    verifyToken,
    ideaController.getAllIdeaFilterOptions
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

/**
 * ------------------------------------------------------------
 * Approval and implementation actions (who may act and from which
 * status: IDEA_TRANSITIONS, checked in the service)
 * ------------------------------------------------------------
 */

/**
 * Manager Approve (Submitted -> Pending Final Approval)
 * POST /api/v1/ideas/:ideaId/manager-approve
 */
router.post(
    "/:ideaId/manager-approve",
    verifyToken,
    ideaController.managerApprove
);

/**
 * Manager Reject (Submitted -> Rejected)
 * POST /api/v1/ideas/:ideaId/manager-reject
 */
router.post(
    "/:ideaId/manager-reject",
    verifyToken,
    ideaController.managerReject
);

/**
 * Final Approve (Pending Final Approval -> Active)
 * POST /api/v1/ideas/:ideaId/final-approve
 */
router.post(
    "/:ideaId/final-approve",
    verifyToken,
    ideaController.finalApprove
);

/**
 * Final Reject (Pending Final Approval -> Rejected)
 * POST /api/v1/ideas/:ideaId/final-reject
 */
router.post(
    "/:ideaId/final-reject",
    verifyToken,
    ideaController.finalReject
);

/**
 * Start Implementation (Active -> In Implementation)
 * POST /api/v1/ideas/:ideaId/start-implementation
 */
router.post(
    "/:ideaId/start-implementation",
    verifyToken,
    ideaController.startImplementation
);

/**
 * Mark Implemented (In Implementation -> Implemented)
 * POST /api/v1/ideas/:ideaId/implement
 */
router.post(
    "/:ideaId/implement",
    verifyToken,
    ideaController.markImplemented
);

/**
 * Extend Timeline (Active / In Implementation, only when overdue)
 * POST /api/v1/ideas/:ideaId/extend-timeline
 */
router.post(
    "/:ideaId/extend-timeline",
    verifyToken,
    ideaController.extendTimeline
);

module.exports = router;
