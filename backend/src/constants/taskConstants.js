/**
 * ============================================================
 * Task Tracker Module Constants
 * ============================================================
 */

// Match CK_Tasks_Priority / CK_Tasks_Status in dbo.Tasks.
const TASK_PRIORITIES = Object.freeze(["Low", "Medium", "High"]);

const TaskStatus = Object.freeze({
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
});

const TASK_STATUSES = Object.freeze(Object.values(TaskStatus));

// Values written to TaskActivityLog.Action.
const TaskAction = Object.freeze({
  CREATED: "Created",
  ASSIGNED: "Assigned",
  UPDATED: "Updated",
  STATUS_CHANGED: "StatusChanged",
  CFO_REMARK_ADDED: "CFORemarkAdded",
  CFO_REMARK_UPDATED: "CFORemarkUpdated",
  USER_REMARK_UPDATED: "UserRemarkUpdated",
  DELETED: "Deleted",
});

// Task email events (subjects and bodies in services/taskMailService.js).
const TaskMailEvent = Object.freeze({
  ASSIGNED: "assigned",
  CFO_REMARK: "cfoRemark",
});

// Same roles as the Ideas module (IDEA_VIEW_ALL_ROLES), upper-cased.
// BusinessHead is the CFO role in this app.
const TASK_BUSINESS_HEAD_ROLE = "BUSINESSHEAD";
const TASK_VIEW_ALL_ROLES = Object.freeze(["ADMIN", TASK_BUSINESS_HEAD_ROLE]);

// Users.Role 'Manager', upper-cased. Managers (and the Business Head) can
// create projects; a Manager runs only the projects they created, with
// their own reportees as members.
const TASK_MANAGER_ROLE = "MANAGER";
const PROJECT_CREATOR_ROLES = Object.freeze([TASK_BUSINESS_HEAD_ROLE, TASK_MANAGER_ROLE]);

// Match the column sizes in dbo.Tasks.
const TASK_NAME_MAX_LENGTH = 500;
const TASK_REMARKS_MAX_LENGTH = 2000;

// With no Status filter, lists show every task not Done plus tasks Done in
// the last this many days.
const TASK_DONE_RECENT_DAYS = 30;

// Projects: dbo.Projects.ProjectName size; Description is NVARCHAR(MAX) but
// capped here like the remarks.
const PROJECT_NAME_MAX_LENGTH = 200;
const PROJECT_DESCRIPTION_MAX_LENGTH = 2000;

// Assign a project task to every current member (one copy each, linked by
// AssignmentGroupID) instead of one member.
const PROJECT_ASSIGN_ALL = "all";

module.exports = {
  TASK_PRIORITIES,
  TaskStatus,
  TASK_STATUSES,
  TaskAction,
  TaskMailEvent,
  TASK_BUSINESS_HEAD_ROLE,
  TASK_VIEW_ALL_ROLES,
  TASK_MANAGER_ROLE,
  PROJECT_CREATOR_ROLES,
  TASK_NAME_MAX_LENGTH,
  TASK_REMARKS_MAX_LENGTH,
  TASK_DONE_RECENT_DAYS,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_ASSIGN_ALL,
};
