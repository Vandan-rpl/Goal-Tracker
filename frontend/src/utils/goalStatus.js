// Display labels for goal statuses. Statuses not listed here are shown as-is.
const GOAL_STATUS_LABELS = {
  "Completion Submitted": "Pending Completion Approval",
  Completed: "Completion Approved",
};

export const getGoalStatusLabel = (status) =>
  GOAL_STATUS_LABELS[status] || status || "Draft";

// Final-approved goal the owner is actively working on: sub-goals can be
// ticked and completion can be requested.
export const isGoalActiveForOwner = (goal) => goal?.GoalStatus === "Approved";

// Completion was rejected: the goal is back in Approved with the approver's remark.
export const getCompletionRejectionRemark = (goal) =>
  goal?.GoalStatus === "Approved" && goal?.CompletionRemark
    ? goal.CompletionRemark
    : null;
