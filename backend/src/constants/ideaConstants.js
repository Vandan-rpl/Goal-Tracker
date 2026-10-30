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
  PENDING_FINAL_APPROVAL: "Pending Final Approval",
  ACTIVE: "Active",
  IN_IMPLEMENTATION: "In Implementation",
  IMPLEMENTED: "Implemented",
  REJECTED: "Rejected",
});

const IDEA_STATUSES = Object.freeze(Object.values(IdeaStatus));

// Overdue = status is one of these AND TargetDate is before today (dates
// only). Used by every API that returns an overdue flag.
const IDEA_OVERDUE_STATUSES = Object.freeze([
  IdeaStatus.ACTIVE,
  IdeaStatus.IN_IMPLEMENTATION,
]);

// Values written to IdeaActivityLog.Action.
const IdeaAction = Object.freeze({
  CREATED: "Created",
  SUBMITTED: "Submitted",
  MANAGER_APPROVED: "Manager Approved",
  MANAGER_REJECTED: "Manager Rejected",
  FINAL_APPROVED: "Final Approved",
  FINAL_REJECTED: "Final Rejected",
  IMPLEMENTATION_STARTED: "Implementation Started",
  IMPLEMENTED: "Implemented",
  TIMELINE_EXTENDED: "Timeline Extended",
});

// Who may act on an idea. The model maps each to its dbo.Ideas column
// (MANAGER -> AssignedLeadID, FINAL_APPROVER -> FinalApproverID).
const IdeaActor = Object.freeze({
  MANAGER: "manager",
  FINAL_APPROVER: "finalApprover",
});

// Values written to dbo.Ideas.RejectedStage.
const IdeaRejectedStage = Object.freeze({
  MANAGER: "Manager",
  FINAL: "Final",
});

// Idea email events. Recipient, subject and template for each live in
// IDEA_MAIL_EVENTS (services/ideaMailService.js).
const IdeaMailEvent = Object.freeze({
  SUBMITTED: "submitted",
  MANAGER_APPROVED: "managerApproved",
  MANAGER_REJECTED: "managerRejected",
  FINAL_APPROVED: "finalApproved",
  FINAL_REJECTED: "finalRejected",
});

// Every status change after submit: allowed current statuses, the new status
// (null = unchanged), who may act, the activity log action, and the email
// sent once it has committed (none when mailEvent is absent).
const IDEA_TRANSITIONS = Object.freeze({
  managerApprove: {
    from: [IdeaStatus.SUBMITTED],
    to: IdeaStatus.PENDING_FINAL_APPROVAL,
    actor: IdeaActor.MANAGER,
    action: IdeaAction.MANAGER_APPROVED,
    mailEvent: IdeaMailEvent.MANAGER_APPROVED,
  },
  managerReject: {
    from: [IdeaStatus.SUBMITTED],
    to: IdeaStatus.REJECTED,
    actor: IdeaActor.MANAGER,
    action: IdeaAction.MANAGER_REJECTED,
    mailEvent: IdeaMailEvent.MANAGER_REJECTED,
  },
  finalApprove: {
    from: [IdeaStatus.PENDING_FINAL_APPROVAL],
    to: IdeaStatus.ACTIVE,
    actor: IdeaActor.FINAL_APPROVER,
    action: IdeaAction.FINAL_APPROVED,
    mailEvent: IdeaMailEvent.FINAL_APPROVED,
  },
  finalReject: {
    from: [IdeaStatus.PENDING_FINAL_APPROVAL],
    to: IdeaStatus.REJECTED,
    actor: IdeaActor.FINAL_APPROVER,
    action: IdeaAction.FINAL_REJECTED,
    mailEvent: IdeaMailEvent.FINAL_REJECTED,
  },
  startImplementation: {
    from: [IdeaStatus.ACTIVE],
    to: IdeaStatus.IN_IMPLEMENTATION,
    actor: IdeaActor.MANAGER,
    action: IdeaAction.IMPLEMENTATION_STARTED,
  },
  markImplemented: {
    from: [IdeaStatus.IN_IMPLEMENTATION],
    to: IdeaStatus.IMPLEMENTED,
    actor: IdeaActor.MANAGER,
    action: IdeaAction.IMPLEMENTED,
  },
  extendTimeline: {
    from: [IdeaStatus.ACTIVE, IdeaStatus.IN_IMPLEMENTATION],
    to: null,
    actor: IdeaActor.MANAGER,
    action: IdeaAction.TIMELINE_EXTENDED,
  },
});

// Manager approve timeline days and Extend Timeline additional days.
const IDEA_TIMELINE_DAYS_MIN = 1;
const IDEA_TIMELINE_DAYS_MAX = 365;

// Action remarks / extension reasons. Kept under the 1000-character Remark
// columns so the activity log text ("Final approver: ... Timeline: N days.
// ..." or "Extended by N days. New target date: ... Reason: ...") still fits.
const IDEA_LEAD_REMARK_MAX_LENGTH = 900;

// dbo.IdeaActivityLog.Remark column size.
const IDEA_ACTIVITY_REMARK_MAX_LENGTH = 1000;

// Roles that may view any idea. BusinessHead is the CFO role in this app.
const IDEA_VIEW_ALL_ROLES = Object.freeze(["ADMIN", "BUSINESSHEAD"]);

// dbo.Users.Role values that can be picked as an idea's reporting manager
// (the lead).
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
  IdeaActor,
  IdeaRejectedStage,
  IdeaMailEvent,
  IDEA_TRANSITIONS,
  IDEA_TIMELINE_DAYS_MIN,
  IDEA_TIMELINE_DAYS_MAX,
  IDEA_LEAD_REMARK_MAX_LENGTH,
  IDEA_ACTIVITY_REMARK_MAX_LENGTH,
  IDEA_VIEW_ALL_ROLES,
  IDEA_LEAD_ROLES,
  IDEA_TITLE_MAX_LENGTH,
  IDEA_DESCRIPTION_MAX_LENGTH,
};
