export const isGoalReviewWindowOpen = (goal, currentDate = new Date()) => {
  if (!goal) return false;

  const completion = Number(
    goal.CompletionPercentage ?? goal.CompletionPct ?? 0,
  );
  if (Number.isFinite(completion) && completion >= 100) {
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
