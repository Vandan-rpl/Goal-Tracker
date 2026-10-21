// Sub-goal rules shared by the Add/Edit Goal forms. The backend enforces the
// same rules (goalController getSubGoalValidationError).
export const MAX_SUB_GOALS = 5;

const toHundredths = (weightage) => Math.round(Number(weightage || 0) * 100);

// Sub-goal weightage is a % of its own goal, so the total is always out of 100.
export const getSubGoalWeightageSummary = (subGoals) => {
  const allocatedHundredths = subGoals.reduce(
    (total, subGoal) => total + toHundredths(subGoal.Weightage),
    0,
  );
  return {
    allocated: allocatedHundredths / 100,
    remaining: (10000 - allocatedHundredths) / 100,
    isComplete: allocatedHundredths === 10000,
  };
};

// Returns an error message, or null when the sub-goals are valid.
// Sub-goals are optional, so an empty list is valid.
export const getSubGoalError = (titledSubGoals) => {
  if (titledSubGoals.length > MAX_SUB_GOALS) {
    return `A goal can have no more than ${MAX_SUB_GOALS} sub-goals.`;
  }
  if (titledSubGoals.length === 0) return null;

  const hasInvalidWeightage = titledSubGoals.some((subGoal) => {
    const weightage = Number(subGoal.Weightage);
    return (
      subGoal.Weightage === "" ||
      !Number.isFinite(weightage) ||
      weightage <= 0 ||
      weightage > 100
    );
  });
  if (hasInvalidWeightage) {
    return "Each sub-goal needs a weightage greater than 0% and up to 100%.";
  }

  const { allocated, isComplete } = getSubGoalWeightageSummary(titledSubGoals);
  return isComplete
    ? null
    : `Sub-goal weightages must add up to exactly 100% (currently ${allocated.toFixed(2)}%).`;
};
