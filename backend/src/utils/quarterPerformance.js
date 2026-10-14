const calculateQuarterAllocationAndAchievement = (goals) => {
  const weightageOf = (goal) => {
    const weightage = Number(goal.Weightage);
    return Number.isFinite(weightage) ? weightage : 0;
  };
  const allocatedPercentage = goals.reduce(
    (total, goal) => total + weightageOf(goal),
    0,
  );
  const achievedPercentage = goals.reduce((total, goal) => {
    const weightage = weightageOf(goal);
    const completion = Number(goal.SubGoalCompletionPercentage);
    const completionPercentage = Number.isFinite(completion)
      ? Math.max(0, Math.min(100, completion))
      : 0;
    return total + (weightage * completionPercentage) / 100;
  }, 0);

  return {
    allocatedPercentage,
    achievedPercentage,
    performancePercentage: allocatedPercentage > 0
      ? (achievedPercentage / allocatedPercentage) * 100
      : null,
  };
};

module.exports = { calculateQuarterAllocationAndAchievement };
