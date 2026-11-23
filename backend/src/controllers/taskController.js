const taskService = require("../services/taskService");
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

// Assign / CFO remark: say so when the email did not go out.
const withMailWarning = (successMessage) => (result) =>
    result.mailWarning ? `${successMessage} ${result.mailWarning}` : successMessage;

/**
 * Get Tasks Menu Access And Unseen Count
 * GET /api/v1/tasks/access
 */
exports.getAccess = handle(
    "Get Task Access", "Failed to fetch task access.", 200, "Task access fetched successfully.",
    (req) => taskService.getAccess(req.user)
);

/**
 * Get Unseen Task Count (badge)
 * GET /api/v1/tasks/unseen-count
 */
exports.getUnseenCount = handle(
    "Get Unseen Task Count", "Failed to fetch unseen task count.", 200, "Unseen task count fetched successfully.",
    async (req) => ({ count: await taskService.getUnseenCount(req.user) })
);

/**
 * Get Dashboard (the logged-in user's own tasks only)
 * GET /api/v1/tasks/dashboard
 */
exports.getDashboard = handle(
    "Get Task Dashboard", "Failed to fetch dashboard.", 200, "Dashboard fetched successfully.",
    (req) => taskService.getDashboard(req.user)
);

/**
 * Get Reports & Analytics (CFO only)
 * GET /api/v1/tasks/reports?scope=&fiscalYear=&departmentId=&employeeId=
 */
exports.getReport = handle(
    "Get Task Report", "Failed to fetch task report.", 200, "Task report fetched successfully.",
    (req) => taskService.getReport(req.user, req.query)
);

/**
 * Get My Tasks
 * GET /api/v1/tasks/my
 */
exports.getMyTasks = handle(
    "Get My Tasks", "Failed to fetch tasks.", 200, "Tasks fetched successfully.",
    (req) => taskService.getMyTasks(req.user, req.query)
);

/**
 * Mark My Tasks As Seen
 * POST /api/v1/tasks/my/mark-seen
 */
exports.markTasksSeen = handle(
    "Mark Tasks Seen", "Failed to mark tasks as seen.", 200, "Tasks marked as seen.",
    (req) => taskService.markTasksSeen(req.user, req.body)
);

/**
 * Get Team Tasks
 * GET /api/v1/tasks/team
 */
exports.getTeamTasks = handle(
    "Get Team Tasks", "Failed to fetch team tasks.", 200, "Team tasks fetched successfully.",
    (req) => taskService.getTeamTasks(req.user, req.query)
);

/**
 * Get Team Tasks Filter Options
 * GET /api/v1/tasks/team/filter-options
 */
exports.getTeamFilterOptions = handle(
    "Get Team Task Filter Options", "Failed to fetch filter options.", 200, "Filter options fetched successfully.",
    (req) => taskService.getTeamFilterOptions(req.user)
);

/**
 * Get All Tasks
 * GET /api/v1/tasks/all
 */
exports.getAllTasks = handle(
    "Get All Tasks", "Failed to fetch tasks.", 200, "Tasks fetched successfully.",
    (req) => taskService.getAllTasks(req.user, req.query)
);

/**
 * Get All Tasks Filter Options
 * GET /api/v1/tasks/all/filter-options
 */
exports.getAllFilterOptions = handle(
    "Get All Task Filter Options", "Failed to fetch filter options.", 200, "Filter options fetched successfully.",
    (req) => taskService.getAllFilterOptions(req.user)
);

/**
 * Get All Tasks Employees View (every active user with task counts)
 * GET /api/v1/tasks/all/employees
 */
exports.getEmployeeTaskSummary = handle(
    "Get Employee Task Summary", "Failed to fetch employees.", 200, "Employees fetched successfully.",
    (req) => taskService.getEmployeeTaskSummary(req.user)
);

/**
 * Get Assign Task Employee Options
 * GET /api/v1/tasks/employees
 */
exports.getAssignableEmployees = handle(
    "Get Assignable Employees", "Failed to fetch employees.", 200, "Employees fetched successfully.",
    (req) => taskService.getAssignableEmployees(req.user)
);

/**
 * Projects I am a member of (My Tasks' Project column)
 * GET /api/v1/tasks/my-projects
 */
exports.getMyProjects = handle(
    "Get My Projects", "Failed to fetch projects.", 200, "Projects fetched successfully.",
    (req) => taskService.getMyProjects(req.user)
);

/**
 * Projects an employee is a member of (Assign Task's Project column)
 * GET /api/v1/tasks/employees/:userId/projects
 */
exports.getEmployeeProjects = handle(
    "Get Employee Projects", "Failed to fetch projects.", 200, "Projects fetched successfully.",
    (req) => taskService.getEmployeeProjects(req.params.userId, req.user)
);

/**
 * Assign Task (Business Head)
 * POST /api/v1/tasks/assign
 */
exports.assignTask = handle(
    "Assign Task", "Failed to assign task.", 201, withMailWarning("Task assigned successfully."),
    (req) => taskService.assignTask(req.body, req.user)
);

/**
 * Tasks I Assigned In A Month (Business Head, Assign Task page)
 * GET /api/v1/tasks/assign/month?fromMonth=YYYY-MM&toMonth=YYYY-MM (or ?month=YYYY-MM)
 */
exports.getAssignedByMonth = handle(
    "Get Assigned Tasks", "Failed to fetch assigned tasks.", 200, "Assigned tasks fetched successfully.",
    (req) => taskService.getAssignedByMonth(req.user, req.query)
);

/**
 * Assign Several Tasks (Business Head)
 * POST /api/v1/tasks/assign/bulk   body: { tasks: [{ employeeId, projectId?, taskName, priority, dueDate }] }
 */
exports.assignTasks = handle(
    "Assign Tasks", "Failed to assign tasks.", 201,
    withMailWarning((result) => `${result.assignedCount} task(s) assigned successfully.`),
    (req) => taskService.assignTasks(req.body, req.user)
);

/**
 * Add Task (self-added)
 * POST /api/v1/tasks
 */
exports.createTask = handle(
    "Create Task", "Failed to add task.", 201, "Task added successfully.",
    (req) => taskService.createTask(req.body, req.user)
);

/**
 * Get Task
 * GET /api/v1/tasks/:taskId
 */
exports.getTaskById = handle(
    "Get Task", "Failed to fetch task.", 200, "Task fetched successfully.",
    (req) => taskService.getTaskById(req.params.taskId, req.user)
);

/**
 * Update Task
 * PUT /api/v1/tasks/:taskId
 */
exports.updateTask = handle(
    "Update Task", "Failed to update task.", 200, "Task updated successfully.",
    (req) => taskService.updateTask(req.params.taskId, req.body, req.user)
);

/**
 * Submit CFO's Remarks (Business Head)
 * POST /api/v1/tasks/:taskId/cfo-remarks
 */
exports.submitCFORemarks = handle(
    "Submit CFO Remarks", "Failed to save CFO's Remarks.", 200, withMailWarning("CFO's Remarks saved successfully."),
    (req) => taskService.submitCFORemarks(req.params.taskId, req.body, req.user)
);

/**
 * Delete Task (soft delete)
 * DELETE /api/v1/tasks/:taskId
 */
exports.deleteTask = handle(
    "Delete Task", "Failed to delete task.", 200, "Task deleted successfully.",
    (req) => taskService.deleteTask(req.params.taskId, req.user)
);
