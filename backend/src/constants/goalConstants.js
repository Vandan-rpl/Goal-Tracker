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
});

module.exports = {
  GoalMailEvent,
};
