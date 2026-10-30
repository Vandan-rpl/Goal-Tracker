/**
 * ============================================================
 * Ideas Module Constants
 * ============================================================
 */

// Single source for the Purpose dropdown 
// and for backend validation.
const IDEA_PURPOSES = Object.freeze([
  "Process Improvement",
  "Reduce Manual Intervention",
  "Automation",
  "Statutory Requirement",
  "Management's Suggestion",
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

// Overdue = status is one of these AND TargetDate is before today (dates
// only). Used by every API that returns an overdue flag.
const IDEA_OVERDUE_STATUSES = Object.freeze([
  IdeaStatus.ACCEPTED,
  IdeaStatus.IN_IMPLEMENTATION,
]);

// Values written to IdeaActivityLog.Action.
const IdeaAction = Object.freeze({
  CREATED: "Created",
  SUBMITTED: "Submitted",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  IMPLEMENTATION_STARTED: "Implementation Started",
  IMPLEMENTED: "Implemented",
  TIMELINE_EXTENDED: "Timeline Extended",
});

// Accept timeline days and Extend Timeline additional days.
const IDEA_TIMELINE_DAYS_MIN = 1;
const IDEA_TIMELINE_DAYS_MAX = 365;

// Lead remarks / extension reasons. Kept under the 1000-character Remark
// columns so the activity log text ("Timeline: N days. ..." or
// "Extended by N days. New target date: ... Reason: ...") still fits.
const IDEA_LEAD_REMARK_MAX_LENGTH = 900;

// Roles that may view any idea. BusinessHead is the CFO role in this app.
const IDEA_VIEW_ALL_ROLES = Object.freeze(["ADMIN", "BUSINESSHEAD"]);

// dbo.Users.Role values that can be picked as an idea's Lead.
const IDEA_LEAD_ROLES = Object.freeze(["Manager", "HOD"]);

// Match the column sizes in dbo.Ideas.
const IDEA_TITLE_MAX_LENGTH = 200;
const IDEA_DESCRIPTION_MAX_LENGTH = 4000;

module.exports = {
  IDEA_PURPOSES,
  IdeaStatus,
  IDEA_STATUSES,
  IDEA_OVERDUE_STATUSES,
  IdeaAction,
  IDEA_TIMELINE_DAYS_MIN,
  IDEA_TIMELINE_DAYS_MAX,
  IDEA_LEAD_REMARK_MAX_LENGTH,
  IDEA_VIEW_ALL_ROLES,
  IDEA_LEAD_ROLES,
  IDEA_TITLE_MAX_LENGTH,
  IDEA_DESCRIPTION_MAX_LENGTH,
};
