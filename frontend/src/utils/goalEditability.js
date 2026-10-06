const EDITABLE_STATUSES = new Set(["Draft", "Rejected"]);
const TERMINAL_STATUSES = new Set(["Completed", "Cancelled"]);

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

export const canEditGoal = (goal) => {
  if (!goal) return false;
  if (EDITABLE_STATUSES.has(goal.GoalStatus)) return true;
  if (TERMINAL_STATUSES.has(goal.GoalStatus)) return false;
  return isTimelineOverdue(goal.Timeline);
};
