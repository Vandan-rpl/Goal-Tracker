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
  // Only ideas final-approved before 2026-11-02 are Active (the reporting
  // manager still starts their implementation); final approval now goes
  // straight to In Implementation.
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
  CLOSURE_REQUESTED: "Closure Requested",
  CLOSURE_REJECTED: "Closure Rejected",
  EXTENSION_REQUESTED: "Extension Requested",
  EXTENSION_REJECTED: "Extension Rejected",
});

// Owner requests (close / extend) that the reporting manager approves or
// rejects. No dbo.Ideas columns hold them: a request is pending while the
// newest IdeaActivityLog row among `actions` is its `requested` action
// (approved = IMPLEMENTED / TIMELINE_EXTENDED, the same actions the
// reporting manager used to log directly). Status does not change while a
// request is pending, so a rejection leaves the idea in its previous status.
const IdeaRequestType = Object.freeze({
  CLOSE: "Close",
  EXTEND: "Extend",
});

const IDEA_REQUESTS = Object.freeze({
  [IdeaRequestType.CLOSE]: {
    requested: IdeaAction.CLOSURE_REQUESTED,
    approved: IdeaAction.IMPLEMENTED,
    rejected: IdeaAction.CLOSURE_REJECTED,
  },
  [IdeaRequestType.EXTEND]: {
    requested: IdeaAction.EXTENSION_REQUESTED,
    approved: IdeaAction.TIMELINE_EXTENDED,
    rejected: IdeaAction.EXTENSION_REJECTED,
  },
});

// An Extension Requested log remark is written as
// "<prefix>DD/MM/YYYY<separator><reason>" so the requested date and the
// reason can be read back from it (ideaModel PENDING_REQUEST_APPLY).
const IDEA_EXTENSION_DATE_PREFIX = "Requested target date: ";
const IDEA_EXTENSION_REASON_SEPARATOR = ". Reason: ";

// Who may act on an idea. The model maps each to its dbo.Ideas column
// (SUBMITTER -> UserID, MANAGER -> AssignedLeadID, FINAL_APPROVER ->
// FinalApproverID).
const IdeaActor = Object.freeze({
  SUBMITTER: "submitter",
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
  CLOSURE_REQUESTED: "closureRequested",
  CLOSURE_APPROVED: "closureApproved",
  CLOSURE_REJECTED: "closureRejected",
  EXTENSION_REQUESTED: "extensionRequested",
  EXTENSION_APPROVED: "extensionApproved",
  EXTENSION_REJECTED: "extensionRejected",
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
    to: IdeaStatus.IN_IMPLEMENTATION,
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
  // Older Active ideas only (see IdeaStatus.ACTIVE).
  startImplementation: {
    from: [IdeaStatus.ACTIVE],
    to: IdeaStatus.IN_IMPLEMENTATION,
    actor: IdeaActor.MANAGER,
    action: IdeaAction.IMPLEMENTATION_STARTED,
  },
  // Close = Mark Implemented: the owner requests it, the reporting manager
  // approves (-> Implemented) or rejects (status unchanged).
  requestClosure: {
    from: [IdeaStatus.IN_IMPLEMENTATION],
    to: null,
    actor: IdeaActor.SUBMITTER,
    action: IdeaAction.CLOSURE_REQUESTED,
    mailEvent: IdeaMailEvent.CLOSURE_REQUESTED,
  },
  approveClosure: {
    from: [IdeaStatus.IN_IMPLEMENTATION],
    to: IdeaStatus.IMPLEMENTED,
    actor: IdeaActor.MANAGER,
    action: IdeaAction.IMPLEMENTED,
    mailEvent: IdeaMailEvent.CLOSURE_APPROVED,
  },
  rejectClosure: {
    from: [IdeaStatus.IN_IMPLEMENTATION],
    to: null,
    actor: IdeaActor.MANAGER,
    action: IdeaAction.CLOSURE_REJECTED,
    mailEvent: IdeaMailEvent.CLOSURE_REJECTED,
  },
  // Extend timeline: the owner requests a new target date (only when
  // overdue), the reporting manager approves or rejects. Status unchanged.
  requestExtension: {
    from: [IdeaStatus.ACTIVE, IdeaStatus.IN_IMPLEMENTATION],
    to: null,
    actor: IdeaActor.SUBMITTER,
    action: IdeaAction.EXTENSION_REQUESTED,
    mailEvent: IdeaMailEvent.EXTENSION_REQUESTED,
  },
  approveExtension: {
    from: [IdeaStatus.ACTIVE, IdeaStatus.IN_IMPLEMENTATION],
    to: null,
    actor: IdeaActor.MANAGER,
    action: IdeaAction.TIMELINE_EXTENDED,
    mailEvent: IdeaMailEvent.EXTENSION_APPROVED,
  },
  rejectExtension: {
    from: [IdeaStatus.ACTIVE, IdeaStatus.IN_IMPLEMENTATION],
    to: null,
    actor: IdeaActor.MANAGER,
    action: IdeaAction.EXTENSION_REJECTED,
    mailEvent: IdeaMailEvent.EXTENSION_REJECTED,
  },
});

// Manager approve timeline days.
const IDEA_TIMELINE_DAYS_MIN = 1;
const IDEA_TIMELINE_DAYS_MAX = 365;

// Action remarks / closure remarks / extension reasons. Kept under the
// 1000-character Remark columns so the activity log text ("Final approver:
// ... Timeline: N days. ..." or "Requested target date: ... Reason: ...")
// still fits.
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
  IdeaRequestType,
  IDEA_REQUESTS,
  IDEA_EXTENSION_DATE_PREFIX,
  IDEA_EXTENSION_REASON_SEPARATOR,
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
