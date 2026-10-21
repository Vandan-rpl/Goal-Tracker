export const isGoalReviewWindowOpen = (goal, currentDate = new Date()) => {
  if (!goal) return false;

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
