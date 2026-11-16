// Statuses the backend accepts a review in (goalController statusFlow): a goal
// must be approved first. Without this, a goal entered for a past quarter
// (go-live opening) would show Review as soon as it is submitted, because its
// quarter end has already passed. Current-quarter goals follow the same rule.
export const REVIEWABLE_GOAL_STATUSES = Object.freeze([
  "HOD Approved",
  "Reviewed By HOD",
  "Completed",
]);

export const isGoalReviewWindowOpen = (goal, currentDate = new Date()) => {
  if (!goal) return false;
  if (!REVIEWABLE_GOAL_STATUSES.includes(goal.GoalStatus)) return false;

  // Review opens early once the goal's completion has been approved.
  // Sub-goals do not drive this.
  if (goal.GoalStatus === "Completed") {
    return true;
  }

  const quarterEndDate = goal.QuarterEndDate || goal.QuarterEnd;
  if (!quarterEndDate) return false;

  const endDate = new Date(quarterEndDate);
  if (Number.isNaN(endDate.getTime())) return false;

  const reviewWindowStart = new Date(endDate);
  reviewWindowStart.setDate(endDate.getDate() - 10);

  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);
  return today >= reviewWindowStart;
};
