const calculateGoalProgress = (goal, subGoals) => {
    if (!subGoals || subGoals.length === 0) {
        return { completionPct: 0, earnedWeightage: 0 };
    }

    const completedWeightage = subGoals
        .filter((sg) => sg.Status === "Completed")
        .reduce((sum, sg) => sum + Number(sg.Weightage), 0);

    const completionPct = completedWeightage; // sub-goal weightages already sum to 100
    const earnedWeightage = Number(goal.Weightage) * (completionPct / 100);

    return { completionPct, earnedWeightage: Number(earnedWeightage.toFixed(2)) };
}

module.exports = { calculateGoalProgress };