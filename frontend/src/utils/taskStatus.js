import { formatIdeaDate, formatIdeaDateTime, getTodayKey } from "./ideaStatus";

// Task Tracker values (same as the backend's taskConstants.js).
export const TASK_STATUSES = ["Pending", "In Progress", "Done"];
export const TASK_PRIORITIES = ["Low", "Medium", "High"];

export const TASK_NAME_MAX = 500;
export const TASK_REMARKS_MAX = 2000;

// Self-added / Assigned filter (backend `source`).
export const TASK_SOURCES = [
  { value: "self", label: "Self-added" },
  { value: "assigned", label: "Assigned by Business Head" },
];

const STATUS_CLASSES = {
  Pending: "bg-gray-100 text-gray-700",
  "In Progress": "bg-blue-100 text-blue-800",
  Done: "bg-emerald-100 text-emerald-800",
};

const PRIORITY_CLASSES = {
  Low: "bg-slate-100 text-slate-700",
  Medium: "bg-amber-100 text-amber-800",
  High: "bg-red-100 text-red-800",
};

export const getTaskStatusClasses = (status) => STATUS_CLASSES[status] || STATUS_CLASSES.Pending;

export const getTaskPriorityClasses = (priority) => PRIORITY_CLASSES[priority] || PRIORITY_CLASSES.Low;

// Dates are shown the same way as in the Ideas module (DD/MM/YYYY, server
// time as stored).
export const formatTaskDate = formatIdeaDate;
export const formatTaskDateTime = formatIdeaDateTime;
export { getTodayKey };
