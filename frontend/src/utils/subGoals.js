// Sub-goal rules shared by the Add/Edit Goal forms. The backend enforces the
// same rules (goalController getSubGoalValidationError).
export const MAX_SUB_GOALS = 5;

const MIN_GOAL_WEIGHTAGE = 5;
const MAX_GOAL_WEIGHTAGE = 100;

const toHundredths = (weightage) => Math.round(Number(weightage || 0) * 100);

// The goal's weightage in hundredths, or null while it is not a valid goal
// weightage (the goal's own Weightage error covers that case).
const getGoalHundredths = (goalWeightage) => {
  if (goalWeightage === "" || goalWeightage === null || goalWeightage === undefined) {
    return null;
  }
  const weightage = Number(goalWeightage);
  if (
    !Number.isFinite(weightage) ||
    weightage < MIN_GOAL_WEIGHTAGE ||
    weightage > MAX_GOAL_WEIGHTAGE
  ) {
    return null;
  }
  return toHundredths(weightage);
};

// Sub-goals split their goal's weightage, so their total must equal the
// goal's own weightage (e.g. a 25% goal's sub-goals must add up to 25%).
// `target` is null while the goal weightage is not valid yet.
export const getSubGoalWeightageSummary = (subGoals, goalWeightage) => {
  const allocatedHundredths = subGoals.reduce(
    (total, subGoal) => total + toHundredths(subGoal.Weightage),
    0,
  );
  const targetHundredths = getGoalHundredths(goalWeightage);
  return {
    allocated: allocatedHundredths / 100,
    target: targetHundredths === null ? null : targetHundredths / 100,
    remaining:
      targetHundredths === null
        ? null
        : (targetHundredths - allocatedHundredths) / 100,
    isComplete:
      targetHundredths !== null && allocatedHundredths === targetHundredths,
  };
};

// Returns an error message, or null when the sub-goals are valid.
// Sub-goals are optional, so an empty list is valid.
export const getSubGoalError = (titledSubGoals, goalWeightage) => {
  if (titledSubGoals.length > MAX_SUB_GOALS) {
    return `A goal can have no more than ${MAX_SUB_GOALS} sub-goals.`;
  }
  if (titledSubGoals.length === 0) return null;

  const { allocated, target } = getSubGoalWeightageSummary(
    titledSubGoals,
    goalWeightage,
  );
  const maxWeightage = target ?? MAX_GOAL_WEIGHTAGE;

  const hasInvalidWeightage = titledSubGoals.some((subGoal) => {
    const weightage = Number(subGoal.Weightage);
    return (
      subGoal.Weightage === "" ||
      !Number.isFinite(weightage) ||
      weightage <= 0 ||
      weightage > maxWeightage
    );
  });
  if (hasInvalidWeightage) {
    return `Each sub-goal needs a weightage greater than 0% and up to ${maxWeightage.toFixed(2)}%.`;
  }

  // An invalid goal weightage is reported on the goal's Weightage field.
  if (target === null) return null;
  return toHundredths(allocated) === toHundredths(target)
    ? null
    : `Sub-goal weightages must add up to exactly the goal weightage of ${target.toFixed(2)}% (currently ${allocated.toFixed(2)}%).`;
};
