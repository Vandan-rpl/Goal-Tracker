const projectService = require("../services/projectService");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Send an AppError's status/message/errors as-is; anything else is a 500.
 * (Same as taskController.)
 */
const handleError = (res, error, label, fallbackMessage) => {

    if (error.statusCode) {
        return errorResponse(res, error.statusCode, error.message, error.errors);
    }

    console.error(`${label} Error:`, error);

    return errorResponse(res, 500, fallbackMessage, [error.message]);
};

/**
 * Wrap a service call: (req) => service result, sent with `status` and
 * `message` (a string, or a function of the result).
 */
const handle = (label, fallbackMessage, status, message, run) => async (req, res) => {

    try {

        const result = await run(req);

        return successResponse(res, status, typeof message === "function" ? message(result) : message, result);

    } catch (error) {

        return handleError(res, error, label, fallbackMessage);

    }

};

// Assign: say so when an email did not go out.
const withMailWarning = (successMessage) => (result) =>
    result.mailWarning ? `${successMessage} ${result.mailWarning}` : successMessage;

/**
 * Project Creator Settings (Admin)
 * GET /api/v1/tasks/projects/creators
 */
exports.getCreatorSettings = handle(
    "Get Project Creators", "Failed to fetch project creators.", 200, "Project creators fetched successfully.",
    () => projectService.getCreatorSettings()
);

/**
 * Add Project Creator (Admin)
 * POST /api/v1/tasks/projects/creators   body: { userId }
 */
exports.addCreator = handle(
    "Add Project Creator", "Failed to add project creator.", 200, "Project creator added successfully.",
    (req) => projectService.addCreator(req.body)
);

/**
 * Remove Project Creator (Admin)
 * DELETE /api/v1/tasks/projects/creators/:userId
 */
exports.removeCreator = handle(
    "Remove Project Creator", "Failed to remove project creator.", 200, "Project creator removed successfully.",
    (req) => projectService.removeCreator(req.params.userId)
);

/**
 * Get Projects
 * GET /api/v1/tasks/projects
 */
exports.getProjects = handle(
    "Get Projects", "Failed to fetch projects.", 200, "Projects fetched successfully.",
    (req) => projectService.getProjects(req.user)
);

/**
 * Get Project Member Options (Business Head)
 * GET /api/v1/tasks/projects/member-options
 */
exports.getMemberOptions = handle(
    "Get Project Member Options", "Failed to fetch employees.", 200, "Employees fetched successfully.",
    (req) => projectService.getMemberOptions(req.user)
);

/**
 * Create Project (Business Head)
 * POST /api/v1/tasks/projects
 */
exports.createProject = handle(
    "Create Project", "Failed to create project.", 201, "Project created successfully.",
    (req) => projectService.createProject(req.body, req.user)
);

/**
 * Get Project (details, members, tasks)
 * GET /api/v1/tasks/projects/:projectId
 */
exports.getProject = handle(
    "Get Project", "Failed to fetch project.", 200, "Project fetched successfully.",
    (req) => projectService.getProjectDetails(req.params.projectId, req.user)
);

/**
 * Update Project (Business Head)
 * PUT /api/v1/tasks/projects/:projectId
 */
exports.updateProject = handle(
    "Update Project", "Failed to update project.", 200, "Project updated successfully.",
    (req) => projectService.updateProject(req.params.projectId, req.body, req.user)
);

/**
 * Add Project Members (Business Head)
 * POST /api/v1/tasks/projects/:projectId/members
 */
exports.addMembers = handle(
    "Add Project Members", "Failed to add members.", 200, "Members added successfully.",
    (req) => projectService.addMembers(req.params.projectId, req.body, req.user)
);

/**
 * Remove Project Member (Business Head)
 * DELETE /api/v1/tasks/projects/:projectId/members/:userId
 */
exports.removeMember = handle(
    "Remove Project Member", "Failed to remove member.", 200, "Member removed successfully.",
    (req) => projectService.removeMember(req.params.projectId, req.params.userId, req.user)
);

/**
 * Add Project Task (member, self-added)
 * POST /api/v1/tasks/projects/:projectId/tasks
 */
exports.createProjectTask = handle(
    "Create Project Task", "Failed to add task.", 201, "Task added successfully.",
    (req) => projectService.createProjectTask(req.params.projectId, req.body, req.user)
);

/**
 * Assign Project Task (whoever runs the project; one member)
 * POST /api/v1/tasks/projects/:projectId/assign
 */
exports.assignProjectTask = handle(
    "Assign Project Task", "Failed to assign task.", 201,
    withMailWarning("Task assigned successfully."),
    (req) => projectService.assignProjectTask(req.params.projectId, req.body, req.user)
);

/**
 * Update "All members" Task (Business Head; every copy)
 * PUT /api/v1/tasks/projects/:projectId/groups/:groupId
 */
exports.updateGroup = handle(
    "Update Group Task", "Failed to update task.", 200, "Task updated for every member.",
    (req) => projectService.updateGroup(req.params.projectId, req.params.groupId, req.body, req.user)
);

/**
 * Delete "All members" Task (Business Head; every copy)
 * DELETE /api/v1/tasks/projects/:projectId/groups/:groupId
 */
exports.deleteGroup = handle(
    "Delete Group Task", "Failed to delete task.", 200, "Task deleted for every member.",
    (req) => projectService.deleteGroup(req.params.projectId, req.params.groupId, req.user)
);
