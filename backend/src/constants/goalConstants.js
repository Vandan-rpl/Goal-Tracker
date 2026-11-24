/**
 * ============================================================
 * Goal Module Constants
 * ============================================================
 */

// Goal email events. Recipient, subject and body text for each live in
// GOAL_MAIL_EVENTS (services/goalMailService.js).
const GoalMailEvent = Object.freeze({
  SUBMITTED: "submitted",
  APPROVED: "approved",
  REJECTED: "rejected",
  REVIEWED: "reviewed",
  CFO_REVIEWED: "cfoReviewed",
  CFO_REVIEWED_APPROVER: "cfoReviewedApprover",
  COMPLETION_REQUESTED: "completionRequested",
  COMPLETION_APPROVED: "completionApproved",
  COMPLETION_REJECTED: "completionRejected",
  QUARTERLY_UPDATE_SUBMITTED: "quarterlyUpdateSubmitted",
  HOD_RATING_SUBMITTED: "hodRatingSubmitted",
  FINAL_EVALUATION_GENERATED: "finalEvaluationGenerated",
  DUE_REMINDER: "dueReminder",
  WINDOW_REMINDER: "windowReminder",
});

// Goal windows the window reminder job (jobs/goalWindowReminderJob.js)
// emails about: who gets it, and what they do in it. The dates come from
// utils/fiscalQuarter.js (last month of each quarter).
const GoalWindow = Object.freeze({
  ADD_GOAL: "addGoal",
  MANAGER_HOD_APPROVAL: "managerHodApproval",
  CFO_APPROVAL: "cfoApproval",
});

// Reminder stages: the day before a window opens, and 2 days before it closes.
const GoalWindowReminderStage = Object.freeze({
  OPENING: { key: "opening", daysBeforeStart: 1 },
  CLOSING: { key: "closing", daysBeforeEnd: 2 },
});

// Goal end-date reminders sent by jobs/goalDueReminderJob.js. Each stage is
// sent once per goal, when the days left to Goal.Timeline fall in
// (nextStage.daysBefore, daysBefore]. The window (not an exact day) means a
// day the server was down is caught up on the next run.
const GoalDueReminderStages = Object.freeze([
  { daysBefore: 5, notificationType: "GOAL_DUE_REMINDER_5" },
  { daysBefore: 2, notificationType: "GOAL_DUE_REMINDER_2" },
]);

// Goals in these statuses are finished or not running, so they get no reminder.
const GOAL_STATUSES_WITHOUT_DUE_REMINDER = Object.freeze([
  "Draft",
  "Rejected",
  "Completion Submitted",
  "Completed",
  "Cancelled",
]);

// Display labels for goal statuses (same as the frontend's
// utils/goalStatus.js). Stored values are unchanged.
const GOAL_STATUS_LABELS = {
  Approved: "Final Approved",
  "Completion Submitted": "Pending Completion Approval",
  Completed: "Completion Approved",
  "Business Head Approved": "CFO Approved",
  "Review By Business Head": "Review By CFO",
};

const getGoalStatusLabel = (status) =>
  GOAL_STATUS_LABELS[status] || status || "Draft";

module.exports = {
  GoalMailEvent,
  getGoalStatusLabel,
  GoalWindow,
  GoalWindowReminderStage,
  GoalDueReminderStages,
  GOAL_STATUSES_WITHOUT_DUE_REMINDER,
};
