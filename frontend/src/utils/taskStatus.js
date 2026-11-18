import { formatIdeaDate, formatIdeaDateTime, getTodayKey } from "./ideaStatus";

// Task Tracker values (same as the backend's taskConstants.js).
// Order = workflow order. "Completed" is the closed state; the rest are open.
export const TASK_STATUS = {
  NOT_STARTED: "Not Started",
  STARTED: "Started",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};
export const TASK_STATUSES = Object.values(TASK_STATUS);

export const isTaskCompleted = (task) => task?.Status === TASK_STATUS.COMPLETED;
export const TASK_PRIORITIES = ["Low", "Medium", "High"];

export const TASK_NAME_MAX = 500;
export const TASK_REMARKS_MAX = 2000;

// Self-added / Assigned filter (backend `source`).
export const TASK_SOURCES = [
  { value: "self", label: "Self-added" },
  { value: "assigned", label: "Assigned (CFO)" },
];

// Who assigned a task: the Business Head, or a Manager in their project.
export const getAssignerLabel = (task) =>
  String(task?.AssignedByRole || "").toLowerCase() === "manager"
    ? `${task.AssignedByName || "Manager"} (Manager)`
    : "CFO";

// Remarks column / label: "Manager / CFO Remarks" on project tasks.
export const PROJECT_REMARKS_LABEL = "Manager / CFO Remarks";

const STATUS_CLASSES = {
  "Not Started": "bg-gray-100 text-gray-700",
  Started: "bg-amber-100 text-amber-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-emerald-100 text-emerald-800",
};

const PRIORITY_CLASSES = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-amber-100 text-amber-800",
  High: "bg-red-100 text-red-800",
};

export const getTaskStatusClasses = (status) => STATUS_CLASSES[status] || STATUS_CLASSES["Not Started"];

export const getTaskPriorityClasses = (priority) => PRIORITY_CLASSES[priority] || PRIORITY_CLASSES.Low;

// Dates are shown the same way as in the Ideas module (DD/MM/YYYY, server
// time as stored).
export const formatTaskDate = formatIdeaDate;
export const formatTaskDateTime = formatIdeaDateTime;
export { getTodayKey };
