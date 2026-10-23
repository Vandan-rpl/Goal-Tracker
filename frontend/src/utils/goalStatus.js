// Display labels for goal statuses. Statuses not listed here are shown as-is.
const GOAL_STATUS_LABELS = {
  "Completion Submitted": "Pending Completion Approval",
  Completed: "Completion Approved",
};

export const getGoalStatusLabel = (status) =>
  GOAL_STATUS_LABELS[status] || status || "Draft";

const pad2 = (value) => String(value).padStart(2, "0");

const getTodayKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// 'YYYY-MM-DD' of the goal's StartDate (SQL DATE values arrive as UTC midnight
// ISO strings, so the date part is taken as-is).
export const getGoalStartDateKey = (goal) => {
  const match = String(goal?.StartDate || "").match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

// A goal approved ahead of its quarter (e.g. a Q4 goal approved during Q3)
// cannot be worked on until its start date arrives.
export const hasGoalStarted = (goal, date = new Date()) => {
  const startKey = getGoalStartDateKey(goal);
  return !startKey || getTodayKey(date) >= startKey;
};

// Final-approved, started goal the owner is actively working on: sub-goals
// can be ticked and completion can be requested.
export const isGoalActiveForOwner = (goal) =>
  goal?.GoalStatus === "Approved" && hasGoalStarted(goal);

// StartDate as DD/MM/YYYY for messages.
export const formatGoalStartDate = (goal) => {
  const startKey = getGoalStartDateKey(goal);
  if (!startKey) return "";
  const [year, month, day] = startKey.split("-");
  return `${day}/${month}/${year}`;
};

// Approved goal whose start date is still in the future.
export const isGoalAwaitingStart = (goal) =>
  goal?.GoalStatus === "Approved" && !hasGoalStarted(goal);

// Completion was rejected: the goal is back in Approved with the approver's remark.
export const getCompletionRejectionRemark = (goal) =>
  goal?.GoalStatus === "Approved" && goal?.CompletionRemark
    ? goal.CompletionRemark
    : null;
