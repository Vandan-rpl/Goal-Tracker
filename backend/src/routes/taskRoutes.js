const express = require("express");
const router = express.Router();

const taskController = require("../controllers/taskController");
const projectController = require("../controllers/projectController");
const { verifyToken, verifyRole } = require("../middleware/authMiddleware");
const { verifyTaskUser } = require("../middleware/projectCreatorMiddleware");
const Roles = require("../constants/roles");

/**
 * ============================================================
 * Task Routes
 * Base URL : /api/v1/tasks
 * ============================================================
 * Fixed paths (/access, /unseen-count, /dashboard, /reports, /my, /team, /all, /employees,
 * /assign, /projects) are declared before /:taskId so they aren't captured
 * as an id.
 * Who may do what is checked in taskService (403 otherwise). verifyTaskUser =
 * verifyToken plus the user's project-creator flag (see
 * middleware/projectCreatorMiddleware).
 */

/**
 * Tasks Menu Access And Unseen Count
 * GET /api/v1/tasks/access
 */
router.get("/access", verifyTaskUser, taskController.getAccess);

/**
 * Unseen Task Count (badge)
 * GET /api/v1/tasks/unseen-count
 */
router.get("/unseen-count", verifyTaskUser, taskController.getUnseenCount);

/**
 * Dashboard (the logged-in user's own tasks; no params, so no other
 * user's data can be asked for)
 * GET /api/v1/tasks/dashboard
 */
router.get("/dashboard", verifyTaskUser, taskController.getDashboard);

/**
 * Reports & Analytics (CFO only; 403 for anyone else)
 * GET /api/v1/tasks/reports?scope=team|organisation&fiscalYear=&departmentId=&employeeId=
 */
router.get("/reports", verifyTaskUser, taskController.getReport);

/**
 * My Tasks
 * GET /api/v1/tasks/my?status=&priority=&dueFrom=&dueTo=&source=
 */
router.get("/my", verifyTaskUser, taskController.getMyTasks);

/**
 * Mark My Tasks As Seen
 * POST /api/v1/tasks/my/mark-seen   body: { taskIds: [] }
 */
router.post("/my/mark-seen", verifyTaskUser, taskController.markTasksSeen);

/**
 * Team Tasks (users with direct reports)
 * GET /api/v1/tasks/team?employeeId=&status=&dueFrom=&dueTo=
 */
router.get("/team", verifyTaskUser, taskController.getTeamTasks);

/**
 * Team Tasks Filter Options
 * GET /api/v1/tasks/team/filter-options
 */
router.get("/team/filter-options", verifyTaskUser, taskController.getTeamFilterOptions);

/**
 * All Tasks (Business Head / Admin)
 * GET /api/v1/tasks/all?department=&employeeId=&status=&priority=&dueFrom=&dueTo=&source=
 */
router.get("/all", verifyTaskUser, taskController.getAllTasks);

/**
 * All Tasks Filter Options
 * GET /api/v1/tasks/all/filter-options
 */
router.get("/all/filter-options", verifyTaskUser, taskController.getAllFilterOptions);

/**
 * All Tasks Employees View: every active user with task counts, including
 * users with no tasks (Business Head / Admin)
 * GET /api/v1/tasks/all/employees
 */
router.get("/all/employees", verifyTaskUser, taskController.getEmployeeTaskSummary);

/**
 * Assign Task Employee Options (Business Head)
 * GET /api/v1/tasks/employees
 */
router.get("/employees", verifyTaskUser, taskController.getAssignableEmployees);

/**
 * Assign Task (Business Head)
 * POST /api/v1/tasks/assign
 */
router.post("/assign", verifyTaskUser, taskController.assignTask);

/**
 * Tasks the Business Head assigned in a month (Assign Task page)
 * GET /api/v1/tasks/assign/month?month=YYYY-MM
 */
router.get("/assign/month", verifyTaskUser, taskController.getAssignedByMonth);

/**
 * Assign Several Tasks, one employee per row (Business Head)
 * POST /api/v1/tasks/assign/bulk   body: { tasks: [{ employeeId, taskName, priority, dueDate }] }
 */
router.post("/assign/bulk", verifyTaskUser, taskController.assignTasks);

/**
 * ------------------------------------------------------------
 * Projects (who may do what: projectService)
 * ------------------------------------------------------------
 */

/**
 * Projects: Business Head / Admin all, members their own
 * GET /api/v1/tasks/projects
 */
router.get("/projects", verifyTaskUser, projectController.getProjects);

/**
 * Project Creator Settings (Admin only): who besides the CFO can create
 * projects, plus the active users who can be added
 * GET    /api/v1/tasks/projects/creators
 * POST   /api/v1/tasks/projects/creators          body: { userId }
 * DELETE /api/v1/tasks/projects/creators/:userId
 */
router.get("/projects/creators", verifyToken, verifyRole([Roles.ADMIN]), projectController.getCreatorSettings);
router.post("/projects/creators", verifyToken, verifyRole([Roles.ADMIN]), projectController.addCreator);
router.delete("/projects/creators/:userId", verifyToken, verifyRole([Roles.ADMIN]), projectController.removeCreator);

/**
 * Create Project (CFO or someone on the project creator list)
 * POST /api/v1/tasks/projects   body: { projectName, description, memberIds: [] }
 */
router.post("/projects", verifyTaskUser, projectController.createProject);

/**
 * Users that can be added as members (Business Head)
 * GET /api/v1/tasks/projects/member-options
 */
router.get("/projects/member-options", verifyTaskUser, projectController.getMemberOptions);

/**
 * Project details, members and tasks
 * GET /api/v1/tasks/projects/:projectId
 */
router.get("/projects/:projectId", verifyTaskUser, projectController.getProject);

/**
 * Update Project name / description (Business Head)
 * PUT /api/v1/tasks/projects/:projectId
 */
router.put("/projects/:projectId", verifyTaskUser, projectController.updateProject);

/**
 * Add Members (Business Head; re-adding reactivates the old row)
 * POST /api/v1/tasks/projects/:projectId/members   body: { userIds: [] }
 */
router.post("/projects/:projectId/members", verifyTaskUser, projectController.addMembers);

/**
 * Remove Member (Business Head)
 * DELETE /api/v1/tasks/projects/:projectId/members/:userId
 */
router.delete("/projects/:projectId/members/:userId", verifyTaskUser, projectController.removeMember);

/**
 * Add own task to the project (member)
 * POST /api/v1/tasks/projects/:projectId/tasks
 */
router.post("/projects/:projectId/tasks", verifyTaskUser, projectController.createProjectTask);

/**
 * Assign project task (Business Head)
 * POST /api/v1/tasks/projects/:projectId/assign
 *   body: { assignTo: userId, taskName, priority, dueDate, cfoRemarks }
 */
router.post("/projects/:projectId/assign", verifyTaskUser, projectController.assignProjectTask);

/**
 * Change / delete an "All members" task for every copy (Business Head)
 * PUT    /api/v1/tasks/projects/:projectId/groups/:groupId
 * DELETE /api/v1/tasks/projects/:projectId/groups/:groupId
 */
router.put("/projects/:projectId/groups/:groupId", verifyTaskUser, projectController.updateGroup);
router.delete("/projects/:projectId/groups/:groupId", verifyTaskUser, projectController.deleteGroup);

/**
 * Add Task (self-added)
 * POST /api/v1/tasks
 */
router.post("/", verifyTaskUser, taskController.createTask);

/**
 * Get Task
 * GET /api/v1/tasks/:taskId
 */
router.get("/:taskId", verifyTaskUser, taskController.getTaskById);

/**
 * Update Task (Task Name / Priority / Due Date / Status / User's Remarks)
 * PUT /api/v1/tasks/:taskId
 */
router.put("/:taskId", verifyTaskUser, taskController.updateTask);

/**
 * Submit CFO's Remarks (Business Head)
 * POST /api/v1/tasks/:taskId/cfo-remarks
 */
router.post("/:taskId/cfo-remarks", verifyTaskUser, taskController.submitCFORemarks);

/**
 * Delete Task (soft delete)
 * DELETE /api/v1/tasks/:taskId
 */
router.delete("/:taskId", verifyTaskUser, taskController.deleteTask);

module.exports = router;
