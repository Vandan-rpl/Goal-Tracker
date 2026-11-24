const ideaService = require("../services/ideaService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Send an AppError's status/message/errors as-is; anything else is a 500.
 */
const handleError = (res, error, label, fallbackMessage) => {

    if (error.statusCode) {
        return errorResponse(res, error.statusCode, error.message, error.errors);
    }

    console.error(`${label} Error:`, error);

    return errorResponse(res, 500, fallbackMessage, [error.message]);
};

/**
 * Get Purpose List
 * GET /api/v1/ideas/purposes
 */
exports.getPurposes = async (req, res) => {

    try {

        const purposes = ideaService.getPurposes();

        return successResponse(res, 200, "Purposes fetched successfully.", purposes);

    } catch (error) {

        return handleError(res, error, "Get Idea Purposes", "Failed to fetch purposes.");

    }

};

/**
 * Get Reporting Manager Options
 * GET /api/v1/ideas/leads
 */
exports.getLeadOptions = async (req, res) => {

    try {

        const leads = await ideaService.getLeadOptions(req.user.userId);

        return successResponse(res, 200, "Reporting managers fetched successfully.", leads);

    } catch (error) {

        return handleError(res, error, "Get Idea Leads", "Failed to fetch reporting managers.");

    }

};

/**
 * Get Final Approver Options
 * GET /api/v1/ideas/final-approvers
 */
exports.getFinalApproverOptions = async (req, res) => {

    try {

        const approvers = await ideaService.getFinalApproverOptions();

        return successResponse(res, 200, "Final approvers fetched successfully.", approvers);

    } catch (error) {

        return handleError(res, error, "Get Idea Final Approvers", "Failed to fetch final approvers.");

    }

};

/**
 * Get Final Approver Settings (Admin)
 * GET /api/v1/ideas/final-approvers/settings
 */
exports.getFinalApproverSettings = async (req, res) => {

    try {

        const settings = await ideaService.getFinalApproverSettings();

        return successResponse(res, 200, "Final approver settings fetched successfully.", settings);

    } catch (error) {

        return handleError(res, error, "Get Idea Final Approver Settings", "Failed to fetch final approver settings.");

    }

};

/**
 * Add Final Approver (Admin)
 * POST /api/v1/ideas/final-approvers   body: { userId }
 */
exports.addFinalApprover = async (req, res) => {

    try {

        const settings = await ideaService.addFinalApprover(req.body);

        return successResponse(res, 200, "Final approver added successfully.", settings);

    } catch (error) {

        return handleError(res, error, "Add Idea Final Approver", "Failed to add final approver.");

    }

};

/**
 * Remove Final Approver (Admin)
 * DELETE /api/v1/ideas/final-approvers/:userId
 */
exports.removeFinalApprover = async (req, res) => {

    try {

        const settings = await ideaService.removeFinalApprover(req.params.userId);

        return successResponse(res, 200, "Final approver removed successfully.", settings);

    } catch (error) {

        return handleError(res, error, "Remove Idea Final Approver", "Failed to remove final approver.");

    }

};

/**
 * Get Dashboard (the logged-in user's own submitted ideas only)
 * GET /api/v1/ideas/dashboard
 */
exports.getDashboard = async (req, res) => {

    try {

        const dashboard = await ideaService.getDashboard(req.user);

        return successResponse(res, 200, "Dashboard fetched successfully.", dashboard);

    } catch (error) {

        return handleError(res, error, "Get Idea Dashboard", "Failed to fetch dashboard.");

    }

};

/**
 * Get Reports & Analytics (CFO only)
 * GET /api/v1/ideas/reports?scope=&fiscalYear=&departmentId=&employeeId=
 */
exports.getReport = async (req, res) => {

    try {

        const report = await ideaService.getReport(req.user, req.query);

        return successResponse(res, 200, "Idea report fetched successfully.", report);

    } catch (error) {

        return handleError(res, error, "Get Idea Report", "Failed to fetch idea report.");

    }

};

/**
 * Get My Ideas
 * GET /api/v1/ideas/my?status=
 */
exports.getMyIdeas = async (req, res) => {

    try {

        const ideas = await ideaService.getMyIdeas(req.user, req.query.status);

        return successResponse(res, 200, "Ideas fetched successfully.", ideas);

    } catch (error) {

        return handleError(res, error, "Get My Ideas", "Failed to fetch ideas.");

    }

};

/**
 * Get Idea Details
 * GET /api/v1/ideas/:ideaId
 */
exports.getIdeaById = async (req, res) => {

    try {

        const idea = await ideaService.getIdeaById(req.params.ideaId, req.user);

        return successResponse(res, 200, "Idea fetched successfully.", idea);

    } catch (error) {

        return handleError(res, error, "Get Idea", "Failed to fetch idea.");

    }

};

/**
 * Create Idea (Draft)
 * POST /api/v1/ideas
 */
exports.createDraft = async (req, res) => {

    try {

        const idea = await ideaService.createDraft(req.body, req.user);

        return successResponse(res, 201, "Idea saved as draft.", idea);

    } catch (error) {

        return handleError(res, error, "Create Idea", "Failed to save idea.");

    }

};

/**
 * Update Draft
 * PUT /api/v1/ideas/:ideaId
 */
exports.updateDraft = async (req, res) => {

    try {

        const idea = await ideaService.updateDraft(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Draft updated successfully.", idea);

    } catch (error) {

        return handleError(res, error, "Update Idea", "Failed to update idea.");

    }

};

/**
 * Delete Draft
 * DELETE /api/v1/ideas/:ideaId
 */
exports.deleteDraft = async (req, res) => {

    try {

        const result = await ideaService.deleteDraft(req.params.ideaId, req.user);

        return successResponse(res, 200, "Draft deleted successfully.", result);

    } catch (error) {

        return handleError(res, error, "Delete Idea", "Failed to delete idea.");

    }

};

/**
 * Submit Idea
 * POST /api/v1/ideas/:ideaId/submit
 */
exports.submitIdea = async (req, res) => {

    try {

        const idea = await ideaService.submitIdea(req.params.ideaId, req.user);

        return successResponse(res, 200, "Idea submitted successfully.", idea);

    } catch (error) {

        return handleError(res, error, "Submit Idea", "Failed to submit idea.");

    }

};

/**
 * Get Ideas Assigned To Me
 * GET /api/v1/ideas/assigned
 */
exports.getAssignedIdeas = async (req, res) => {

    try {

        const ideas = await ideaService.getAssignedIdeas(req.user);

        return successResponse(res, 200, "Assigned ideas fetched successfully.", ideas);

    } catch (error) {

        return handleError(res, error, "Get Assigned Ideas", "Failed to fetch assigned ideas.");

    }

};

/**
 * Ideas Review & Approval Team Members (Submitted By names)
 * GET /api/v1/ideas/assigned/team-members
 */
exports.getReviewTeamMembers = async (req, res) => {

    try {

        const members = await ideaService.getReviewTeamMembers(req.user);

        return successResponse(res, 200, "Team members fetched successfully.", members);

    } catch (error) {

        return handleError(res, error, "Get Review Team Members", "Failed to fetch team members.");

    }

};

/**
 * Manager Approve Idea
 * POST /api/v1/ideas/:ideaId/manager-approve
 */
exports.managerApprove = async (req, res) => {

    try {

        const idea = await ideaService.managerApprove(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Idea approved and sent for final approval.", idea);

    } catch (error) {

        return handleError(res, error, "Manager Approve Idea", "Failed to approve idea.");

    }

};

/**
 * Manager Reject Idea
 * POST /api/v1/ideas/:ideaId/manager-reject
 */
exports.managerReject = async (req, res) => {

    try {

        const idea = await ideaService.managerReject(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Idea rejected successfully.", idea);

    } catch (error) {

        return handleError(res, error, "Manager Reject Idea", "Failed to reject idea.");

    }

};

/**
 * Final Approve Idea
 * POST /api/v1/ideas/:ideaId/final-approve
 */
exports.finalApprove = async (req, res) => {

    try {

        const idea = await ideaService.finalApprove(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Idea approved successfully.", idea);

    } catch (error) {

        return handleError(res, error, "Final Approve Idea", "Failed to approve idea.");

    }

};

/**
 * Final Reject Idea
 * POST /api/v1/ideas/:ideaId/final-reject
 */
exports.finalReject = async (req, res) => {

    try {

        const idea = await ideaService.finalReject(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Idea rejected successfully.", idea);

    } catch (error) {

        return handleError(res, error, "Final Reject Idea", "Failed to reject idea.");

    }

};

/**
 * Start Implementation
 * POST /api/v1/ideas/:ideaId/start-implementation
 */
exports.startImplementation = async (req, res) => {

    try {

        const idea = await ideaService.startImplementation(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Implementation started successfully.", idea);

    } catch (error) {

        return handleError(res, error, "Start Implementation", "Failed to start implementation.");

    }

};

/**
 * Request Closure
 * POST /api/v1/ideas/:ideaId/request-closure
 */
exports.requestClosure = async (req, res) => {

    try {

        const idea = await ideaService.requestClosure(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Closure request sent to the reporting manager.", idea);

    } catch (error) {

        return handleError(res, error, "Request Closure", "Failed to send the closure request.");

    }

};

/**
 * Approve Closure
 * POST /api/v1/ideas/:ideaId/approve-closure
 */
exports.approveClosure = async (req, res) => {

    try {

        const idea = await ideaService.approveClosure(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Closure approved. The idea is now Implemented.", idea);

    } catch (error) {

        return handleError(res, error, "Approve Closure", "Failed to approve the closure.");

    }

};

/**
 * Reject Closure
 * POST /api/v1/ideas/:ideaId/reject-closure
 */
exports.rejectClosure = async (req, res) => {

    try {

        const idea = await ideaService.rejectClosure(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Closure request rejected.", idea);

    } catch (error) {

        return handleError(res, error, "Reject Closure", "Failed to reject the closure request.");

    }

};

/**
 * Request Extension
 * POST /api/v1/ideas/:ideaId/request-extension
 */
exports.requestExtension = async (req, res) => {

    try {

        const idea = await ideaService.requestExtension(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Extension request sent to the reporting manager.", idea);

    } catch (error) {

        return handleError(res, error, "Request Extension", "Failed to send the extension request.");

    }

};

/**
 * Approve Extension
 * POST /api/v1/ideas/:ideaId/approve-extension
 */
exports.approveExtension = async (req, res) => {

    try {

        const idea = await ideaService.approveExtension(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Extension approved. The target date has been updated.", idea);

    } catch (error) {

        return handleError(res, error, "Approve Extension", "Failed to approve the extension.");

    }

};

/**
 * Reject Extension
 * POST /api/v1/ideas/:ideaId/reject-extension
 */
exports.rejectExtension = async (req, res) => {

    try {

        const idea = await ideaService.rejectExtension(req.params.ideaId, req.body, req.user);

        return successResponse(res, 200, "Extension request rejected.", idea);

    } catch (error) {

        return handleError(res, error, "Reject Extension", "Failed to reject the extension request.");

    }

};

/**
 * Get Team Ideas
 * GET /api/v1/ideas/team
 */
exports.getTeamIdeas = async (req, res) => {

    try {

        const result = await ideaService.getTeamIdeas(req.user, req.query);

        return successResponse(res, 200, "Team ideas fetched successfully.", result);

    } catch (error) {

        return handleError(res, error, "Get Team Ideas", "Failed to fetch team ideas.");

    }

};

/**
 * Get Team Ideas Filter Options
 * GET /api/v1/ideas/team/filter-options
 */
exports.getTeamIdeaFilterOptions = async (req, res) => {

    try {

        const options = await ideaService.getTeamIdeaFilterOptions(req.user);

        return successResponse(res, 200, "Filter options fetched successfully.", options);

    } catch (error) {

        return handleError(res, error, "Get Team Idea Filter Options", "Failed to fetch filter options.");

    }

};

/**
 * Get All Ideas
 * GET /api/v1/ideas/all
 */
exports.getAllIdeas = async (req, res) => {

    try {

        const result = await ideaService.getAllIdeas(req.user, req.query);

        return successResponse(res, 200, "Ideas fetched successfully.", result);

    } catch (error) {

        return handleError(res, error, "Get All Ideas", "Failed to fetch ideas.");

    }

};

/**
 * Get All Ideas Filter Options
 * GET /api/v1/ideas/all/filter-options
 */
exports.getAllIdeaFilterOptions = async (req, res) => {

    try {

        const options = await ideaService.getAllIdeaFilterOptions(req.user);

        return successResponse(res, 200, "Filter options fetched successfully.", options);

    } catch (error) {

        return handleError(res, error, "Get All Idea Filter Options", "Failed to fetch filter options.");

    }

};

