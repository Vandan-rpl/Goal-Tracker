const calculateGoalProgress = (subGoals) => {
    const completedWeightage = (Array.isArray(subGoals) ? subGoals : [])
        .filter((subGoal) => subGoal.Status === "Completed")
        .reduce((sum, subGoal) => sum + Number(subGoal.Weightage || 0), 0);

    return Number(completedWeightage.toFixed(2));
};

module.exports = { calculateGoalProgress };