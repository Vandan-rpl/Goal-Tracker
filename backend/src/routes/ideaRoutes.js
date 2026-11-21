const express = require("express");
const router = express.Router();

const ideaController = require("../controllers/ideaController");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const Roles = require("../constants/roles");

/**
 * ============================================================
 * Idea Routes
 * Base URL : /api/v1/ideas
 * ============================================================
 * Fixed paths (/purposes, /leads, /final-approvers, /dashboard, /reports, /my, /assigned, /team,
 * /all, /track) are declared before
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
 * Final Approver Settings (Admin only): current final approvers plus the
 * active users who can be added
 * GET /api/v1/ideas/final-approvers/settings
 */
router.get(
    "/final-approvers/settings",
    verifyToken,
    verifyRole([Roles.ADMIN]),
    ideaController.getFinalApproverSettings
);

/**
 * Add Final Approver (Admin only)   body: { userId }
 * POST /api/v1/ideas/final-approvers
 */
router.post(
    "/final-approvers",
    verifyToken,
    verifyRole([Roles.ADMIN]),
    ideaController.addFinalApprover
);

/**
 * Remove Final Approver (Admin only)
 * DELETE /api/v1/ideas/final-approvers/:userId
 */
router.delete(
    "/final-approvers/:userId",
    verifyToken,
    verifyRole([Roles.ADMIN]),
    ideaController.removeFinalApprover
);

/**
 * Dashboard (the logged-in user's own submitted ideas; no params, so no
 * other user's data can be asked for)
 * GET /api/v1/ideas/dashboard
 */
router.get(
    "/dashboard",
    verifyToken,
    ideaController.getDashboard
);

/**
 * Reports & Analytics (CFO only; 403 for anyone else)
 * GET /api/v1/ideas/reports?scope=team|organisation&fiscalYear=&departmentId=&employeeId=
 */
router.get(
    "/reports",
    verifyToken,
    ideaController.getReport
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
 * Track Idea (users with direct reports, CFO / Admin; only ideas they may
 * see, never Drafts). Filled-in filters must all match.
 * GET /api/v1/ideas/track?ideaNumber=&ideaName=&submittedDate=&initiatedBy=&page=&pageSize=
 */
router.get(
    "/track",
    verifyToken,
    ideaController.trackIdeas
);

/**
 * Track Idea Initiated By Options
 * GET /api/v1/ideas/track/initiators
 */
router.get(
    "/track/initiators",
    verifyToken,
    ideaController.getTrackIdeaInitiators
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
 * Request Closure (idea owner; In Implementation)
 * POST /api/v1/ideas/:ideaId/request-closure
 */
router.post(
    "/:ideaId/request-closure",
    verifyToken,
    ideaController.requestClosure
);

/**
 * Approve Closure (reporting manager; In Implementation -> Implemented)
 * POST /api/v1/ideas/:ideaId/approve-closure
 */
router.post(
    "/:ideaId/approve-closure",
    verifyToken,
    ideaController.approveClosure
);

/**
 * Reject Closure (reporting manager; status unchanged)
 * POST /api/v1/ideas/:ideaId/reject-closure
 */
router.post(
    "/:ideaId/reject-closure",
    verifyToken,
    ideaController.rejectClosure
);

/**
 * Request Extension (idea owner; Active / In Implementation, only when overdue)
 * POST /api/v1/ideas/:ideaId/request-extension
 */
router.post(
    "/:ideaId/request-extension",
    verifyToken,
    ideaController.requestExtension
);

/**
 * Approve Extension (reporting manager; requested date becomes the target date)
 * POST /api/v1/ideas/:ideaId/approve-extension
 */
router.post(
    "/:ideaId/approve-extension",
    verifyToken,
    ideaController.approveExtension
);

/**
 * Reject Extension (reporting manager; target date unchanged)
 * POST /api/v1/ideas/:ideaId/reject-extension
 */
router.post(
    "/:ideaId/reject-extension",
    verifyToken,
    ideaController.rejectExtension
);

module.exports = router;
