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
 * Get Lead Options
 * GET /api/v1/ideas/leads
 */
exports.getLeadOptions = async (req, res) => {

    try {

        const leads = await ideaService.getLeadOptions(req.user.userId);

        return successResponse(res, 200, "Leads fetched successfully.", leads);

    } catch (error) {

        return handleError(res, error, "Get Idea Leads", "Failed to fetch leads.");

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
