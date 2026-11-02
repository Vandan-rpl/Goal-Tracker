const express = require("express");
const router = express.Router();

const taskController = require("../controllers/taskController");
const projectController = require("../controllers/projectController");
const { verifyToken } = require("../middleware/authMiddleware");

/**
 * ============================================================
 * Task Routes
 * Base URL : /api/v1/tasks
 * ============================================================
 * Fixed paths (/access, /unseen-count, /my, /team, /all, /employees,
 * /assign, /projects) are declared before /:taskId so they aren't captured
 * as an id.
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
 * ------------------------------------------------------------
 * Projects (who may do what: projectService)
 * ------------------------------------------------------------
 */

/**
 * Projects: Business Head / Admin all, members their own
 * GET /api/v1/tasks/projects
 */
router.get("/projects", verifyToken, projectController.getProjects);

/**
 * Create Project (Business Head)
 * POST /api/v1/tasks/projects   body: { projectName, description, memberIds: [] }
 */
router.post("/projects", verifyToken, projectController.createProject);

/**
 * Users that can be added as members (Business Head)
 * GET /api/v1/tasks/projects/member-options
 */
router.get("/projects/member-options", verifyToken, projectController.getMemberOptions);

/**
 * Project details, members and tasks
 * GET /api/v1/tasks/projects/:projectId
 */
router.get("/projects/:projectId", verifyToken, projectController.getProject);

/**
 * Update Project name / description (Business Head)
 * PUT /api/v1/tasks/projects/:projectId
 */
router.put("/projects/:projectId", verifyToken, projectController.updateProject);

/**
 * Add Members (Business Head; re-adding reactivates the old row)
 * POST /api/v1/tasks/projects/:projectId/members   body: { userIds: [] }
 */
router.post("/projects/:projectId/members", verifyToken, projectController.addMembers);

/**
 * Remove Member (Business Head)
 * DELETE /api/v1/tasks/projects/:projectId/members/:userId
 */
router.delete("/projects/:projectId/members/:userId", verifyToken, projectController.removeMember);

/**
 * Add own task to the project (member)
 * POST /api/v1/tasks/projects/:projectId/tasks
 */
router.post("/projects/:projectId/tasks", verifyToken, projectController.createProjectTask);

/**
 * Assign project task (Business Head)
 * POST /api/v1/tasks/projects/:projectId/assign
 *   body: { assignTo: userId | "all", responsiblePersonId, taskName, priority, dueDate, cfoRemarks }
 */
router.post("/projects/:projectId/assign", verifyToken, projectController.assignProjectTask);

/**
 * Change / delete an "All members" task for every copy (Business Head)
 * PUT    /api/v1/tasks/projects/:projectId/groups/:groupId
 * DELETE /api/v1/tasks/projects/:projectId/groups/:groupId
 */
router.put("/projects/:projectId/groups/:groupId", verifyToken, projectController.updateGroup);
router.delete("/projects/:projectId/groups/:groupId", verifyToken, projectController.deleteGroup);

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
