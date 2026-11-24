import { canEditGoal } from "./goalEditability";
import {
  getCfoApprovalWindow,
  getManagerHodApprovalWindow,
} from "./fiscalQuarter";

// Approver actions on someone else's goal: the same rules the goal page
// (ViewGoal) uses for its Edit / Approve / Reject buttons. `goal` needs
// GoalStatus, Quarter, CanApproveOrReject and ApprovalWindowExempt (sent by
// GET /goals/:id and GET /teams/user-goals/:userId).

const CFO_REVIEW_STATUSES = [
  "HOD Approved",
  "Manager Approved",
  "Reviewed By HOD",
  "Review By Business Head",
];

const normalizeRole = (role) =>
  String(role || "")
    .toLowerCase()
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

export const getGoalReviewActions = (goal, role) => {
  const normalizedRole = normalizeRole(role);
  const isCfo = ["cfo", "businesshead", "business head"].includes(normalizedRole);
  const isManagerHod = ["manager", "hod"].includes(normalizedRole);
  const isApprover = isCfo || isManagerHod;

  const approvalWindow = isCfo
    ? getCfoApprovalWindow()
    : isManagerHod
      ? getManagerHodApprovalWindow()
      : null;
  const isWindowOpen =
    approvalWindow?.isOpen === true ||
    (Boolean(approvalWindow) && goal?.ApprovalWindowExempt === true);

  const isOwner = goal?.IsGoalOwner === true;
  const canApproveReject =
    Boolean(goal) &&
    !isOwner &&
    isWindowOpen &&
    ((isCfo && CFO_REVIEW_STATUSES.includes(goal.GoalStatus)) ||
      (goal.CanApproveOrReject === true && goal.GoalStatus === "Submitted"));

  return {
    canEdit:
      canApproveReject &&
      canEditGoal(goal, isApprover && !isOwner && isWindowOpen, normalizedRole),
    canApproveReject,
    // Status a Manager/HOD approval moves the goal to; the CFO approves finally.
    approveStatus: isCfo
      ? "Approved"
      : normalizedRole === "manager"
        ? "Manager Approved"
        : "HOD Approved",
  };
};
