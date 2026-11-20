// Edit rules (mirrors updateGoal on the server), dates included:
//  - Draft / Rejected: the employee (goal owner) only.
//  - Pending approval: the owner's Manager/HOD and CFO/Business Head, at any
//    pending stage, up to final approval. Never Admin.
//  - Finally Approved and later: no one.
const EDITABLE_STATUSES = new Set(["Draft", "Rejected"]);
const PENDING_APPROVAL_STATUSES = new Set([
  "Submitted",
  "Manager Approved",
  "HOD Approved",
  "Reviewed By HOD",
  "Review By Business Head",
  "Business Head Approved",
]);

const getDateKey = (value) => {
  if (!value) return null;

  const match = String(value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const isTimelineOverdue = (timeline) => {
  const timelineDate = getDateKey(timeline);
  if (!timelineDate) return false;

  const today = new Date();
  const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return timelineDate < todayDate;
};

const normalizeRole = (role) =>
  String(role || "")
    .toLowerCase()
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

export const isBusinessHeadRole = (role) =>
  ["businesshead", "business head"].includes(normalizeRole(role));

const isAdminRole = (role) => normalizeRole(role) === "admin";

// isApprover = true: the caller is acting as an approver on someone else's
// goal (pending stages only; never Admin). Otherwise the caller is the goal
// owner (callers check ownership): Draft / Rejected only.
export const canEditGoal = (goal, isApprover = false, role = "") => {
  if (!goal) return false;
  if (isApprover) {
    return (
      !isAdminRole(role) && PENDING_APPROVAL_STATUSES.has(goal.GoalStatus)
    );
  }
  return EDITABLE_STATUSES.has(goal.GoalStatus);
};

export const isApproverRole = (role) => {
  const normalizedRole = normalizeRole(role);

  return [
    "hod",
    "cfo",
    "admin",
    "businesshead",
    "business head",
    "manager",
  ].includes(normalizedRole);
};
