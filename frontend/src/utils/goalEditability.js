const EDITABLE_STATUSES = new Set(["Draft", "Rejected"]);
const TERMINAL_STATUSES = new Set(["Completed", "Cancelled"]);
const TIMELINE_ONLY_EDIT_STATUSES = new Set([
  "HOD Approved",
  "Manager Approved",
  "Business Head Approved",
  "Reviewed By HOD",
  "Review By Business Head",
  "Approved",
]);

const getDateKey = (value) => {
  if (!value) return null;

  const match = String(value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const isTimelineOverdue = (timeline) => {
  const timelineDate = getDateKey(timeline);
  if (!timelineDate) return false;

  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return timelineDate < todayDate;
};

export const canEditGoal = (goal, isApprover = false) => {
  if (!goal) return false;
  if (TERMINAL_STATUSES.has(goal.GoalStatus)) return false;
  if (EDITABLE_STATUSES.has(goal.GoalStatus) || isApprover) return true;
  return canEditTimelineOnlyGoal(goal);
};

export const canEditTimelineOnlyGoal = (goal) =>
  Boolean(
    goal &&
      TIMELINE_ONLY_EDIT_STATUSES.has(goal.GoalStatus) &&
      Number(goal.CarryForwardCount || 0) === 0 &&
      isTimelineOverdue(goal.Timeline),
  );

export const isApproverRole = (role) => {
  const normalizedRole = String(role || "")
    .toLowerCase()
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

  return [
    "hod",
    "cfo",
    "admin",
    "businesshead",
    "business head",
    "manager",
  ].includes(normalizedRole);
};
