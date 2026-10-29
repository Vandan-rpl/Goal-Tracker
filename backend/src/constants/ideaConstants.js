/**
 * ============================================================
 * Ideas Module Constants
 * ============================================================
 */

// Single source for the Purpose dropdown (served by GET /ideas/purposes)
// and for backend validation.
const IDEA_PURPOSES = Object.freeze([
  "Process Improvement",
  "Cost Saving",
  "Quality Improvement",
  "Safety",
  "Productivity",
  "Digital / IT",
  "Other",
]);

const IdeaStatus = Object.freeze({
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  IN_IMPLEMENTATION: "In Implementation",
  IMPLEMENTED: "Implemented",
});

const IDEA_STATUSES = Object.freeze(Object.values(IdeaStatus));

// Ideas in these statuses are never flagged overdue.
const IDEA_CLOSED_STATUSES = Object.freeze([
  IdeaStatus.IMPLEMENTED,
  IdeaStatus.REJECTED,
]);

// Values written to IdeaActivityLog.Action.
const IdeaAction = Object.freeze({
  CREATED: "Created",
  SUBMITTED: "Submitted",
});

// Roles that may view any idea. BusinessHead is the CFO role in this app.
const IDEA_VIEW_ALL_ROLES = Object.freeze(["ADMIN", "BUSINESSHEAD"]);

// Match the column sizes in dbo.Ideas.
const IDEA_TITLE_MAX_LENGTH = 200;
const IDEA_DESCRIPTION_MAX_LENGTH = 4000;

module.exports = {
  IDEA_PURPOSES,
  IdeaStatus,
  IDEA_STATUSES,
  IDEA_CLOSED_STATUSES,
  IdeaAction,
  IDEA_VIEW_ALL_ROLES,
  IDEA_TITLE_MAX_LENGTH,
  IDEA_DESCRIPTION_MAX_LENGTH,
};
