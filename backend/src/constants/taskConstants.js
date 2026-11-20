/**
 * ============================================================
 * Task Tracker Module Constants
 * ============================================================
 */

// Match CK_Tasks_Priority / CK_Tasks_Status in dbo.Tasks.
const TASK_PRIORITIES = Object.freeze(["Low", "Medium", "High"]);

// Order = workflow order (shown in dropdowns). COMPLETED is the closed state:
// it sets CompletedDate; every other status counts as open.
const TaskStatus = Object.freeze({
  NOT_STARTED: "Not Started",
  STARTED: "Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
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

// Users.Role 'Manager', upper-cased.
const TASK_MANAGER_ROLE = "MANAGER";
// Who can create projects: the Business Head always, plus the people Admin
// puts on dbo.ProjectCreators (any role). A non-Business-Head creator runs
// only the projects they created, with their own reportees as members.

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

module.exports = {
  TASK_PRIORITIES,
  TaskStatus,
  TASK_STATUSES,
  TaskAction,
  TaskMailEvent,
  TASK_BUSINESS_HEAD_ROLE,
  TASK_VIEW_ALL_ROLES,
  TASK_MANAGER_ROLE,
  TASK_NAME_MAX_LENGTH,
  TASK_REMARKS_MAX_LENGTH,
  TASK_DONE_RECENT_DAYS,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_DESCRIPTION_MAX_LENGTH,
};
