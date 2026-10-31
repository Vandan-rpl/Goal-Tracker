const express = require("express");
const router = express.Router();

const taskController = require("../controllers/taskController");
const { verifyToken } = require("../middleware/authMiddleware");

/**
 * ============================================================
 * Task Routes
 * Base URL : /api/v1/tasks
 * ============================================================
 * Fixed paths (/access, /unseen-count, /my, /team, /all, /employees,
 * /assign) are declared before /:taskId so they aren't captured as an id.
 * Who may do what is checked in taskService (403 otherwise).
 */

/**
 * Tasks Menu Access And Unseen Count
 * GET /api/v1/tasks/access
 */
router.get("/access", verifyToken, taskController.getAccess);

/**
 * Unseen Task Count (badge)
 * GET /api/v1/tasks/unseen-count
 */
router.get("/unseen-count", verifyToken, taskController.getUnseenCount);

/**
 * My Tasks
 * GET /api/v1/tasks/my?status=&priority=&dueFrom=&dueTo=&source=
 */
router.get("/my", verifyToken, taskController.getMyTasks);

/**
 * Mark My Tasks As Seen
 * POST /api/v1/tasks/my/mark-seen   body: { taskIds: [] }
 */
router.post("/my/mark-seen", verifyToken, taskController.markTasksSeen);

/**
 * Team Tasks (users with direct reports)
 * GET /api/v1/tasks/team?employeeId=&status=&dueFrom=&dueTo=
 */
router.get("/team", verifyToken, taskController.getTeamTasks);

/**
 * Team Tasks Filter Options
 * GET /api/v1/tasks/team/filter-options
 */
router.get("/team/filter-options", verifyToken, taskController.getTeamFilterOptions);

/**
 * All Tasks (Business Head / Admin)
 * GET /api/v1/tasks/all?department=&employeeId=&status=&priority=&dueFrom=&dueTo=&source=
 */
router.get("/all", verifyToken, taskController.getAllTasks);

/**
 * All Tasks Filter Options
 * GET /api/v1/tasks/all/filter-options
 */
router.get("/all/filter-options", verifyToken, taskController.getAllFilterOptions);

/**
 * All Tasks Employees View: every active user with task counts, including
 * users with no tasks (Business Head / Admin)
 * GET /api/v1/tasks/all/employees
 */
router.get("/all/employees", verifyToken, taskController.getEmployeeTaskSummary);

/**
 * Assign Task Employee Options (Business Head)
 * GET /api/v1/tasks/employees
 */
router.get("/employees", verifyToken, taskController.getAssignableEmployees);

/**
 * Assign Task (Business Head)
 * POST /api/v1/tasks/assign
 */
router.post("/assign", verifyToken, taskController.assignTask);

/**
 * Add Task (self-added)
 * POST /api/v1/tasks
 */
router.post("/", verifyToken, taskController.createTask);

/**
 * Get Task
 * GET /api/v1/tasks/:taskId
 */
router.get("/:taskId", verifyToken, taskController.getTaskById);

/**
 * Update Task (Task Name / Priority / Due Date / Status / User's Remarks)
 * PUT /api/v1/tasks/:taskId
 */
router.put("/:taskId", verifyToken, taskController.updateTask);

/**
 * Submit CFO's Remarks (Business Head)
 * POST /api/v1/tasks/:taskId/cfo-remarks
 */
router.post("/:taskId/cfo-remarks", verifyToken, taskController.submitCFORemarks);

/**
 * Delete Task (soft delete)
 * DELETE /api/v1/tasks/:taskId
 */
router.delete("/:taskId", verifyToken, taskController.deleteTask);

module.exports = router;
