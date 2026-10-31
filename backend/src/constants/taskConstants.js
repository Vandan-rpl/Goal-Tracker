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

// Match the column sizes in dbo.Tasks.
const TASK_NAME_MAX_LENGTH = 500;
const TASK_REMARKS_MAX_LENGTH = 2000;

// With no Status filter, lists show every task not Done plus tasks Done in
// the last this many days.
const TASK_DONE_RECENT_DAYS = 30;

module.exports = {
  TASK_PRIORITIES,
  TaskStatus,
  TASK_STATUSES,
  TaskAction,
  TaskMailEvent,
  TASK_BUSINESS_HEAD_ROLE,
  TASK_VIEW_ALL_ROLES,
  TASK_NAME_MAX_LENGTH,
  TASK_REMARKS_MAX_LENGTH,
  TASK_DONE_RECENT_DAYS,
};
