// SQL predicates shared by every per-quarter goal summary (employee
// dashboard, quarter goal details, Final Evaluation, analytics). All take the
// goal table alias so they can be dropped into any query. Everything is
// calculated from existing columns; nothing is stored.
//
//   Start quarter (S): Goals.Quarter / Goals.QuarterEndDate (from StartDate).
//   End quarter (E):   the fiscal quarter of Goals.Timeline (End Date).
//   Completion quarter (C): the quarter of the date the USER marked the goal
//               complete (CompletionRequestedDate). Weightage only counts once
//               the completion is approved (GoalStatus = 'Completed').
//   Allocated:  a goal counts in its own quarter only once it is finally
//               Approved (or later in the lifecycle).
//   Brought forward: a goal whose End Date is after its start quarter ends
//               (E later than S). No user action is involved.

const ALLOCATED_STATUSES_SQL =
  "'Approved', 'Running', 'Postpone', 'Completion Submitted', 'Completed'";

// End Date falls in a later quarter than the start quarter.
const isBroughtForwardGoal = (alias = "g") =>
  `${alias}.Timeline > ${alias}.QuarterEndDate`;

// Date the user marked the goal complete. CompletedDate (approval date) is
// only a fallback for rows completed before CompletionRequestedDate existed.
const completionMarkedDate = (alias = "g") =>
  `COALESCE(${alias}.CompletionRequestedDate, ${alias}.CompletedDate)`;

const isAllocatedGoal = (alias = "g") =>
  `(${alias}.GoalStatus IN (${ALLOCATED_STATUSES_SQL}))`;

const isCompletedAfterOwnQuarter = (alias = "g") =>
  `${completionMarkedDate(alias)} >= DATEADD(DAY, 1, ${alias}.QuarterEndDate)`;

// Approved completion marked within [start, end] (inclusive dates).
const isCompletedWithin = (alias, startParam, endParam) => `(
  ${alias}.GoalStatus = 'Completed'
  AND ${completionMarkedDate(alias)} >= ${startParam}
  AND ${completionMarkedDate(alias)} < DATEADD(DAY, 1, ${endParam})
)`;

// Achieved weightage the goal contributes to its own quarter on the employee
// dashboard. A brought-forward goal completed after its own quarter counts
// only as brought forward achieved, in the quarter it was completed in.
const ownAchievedWeightage = (alias = "g") => `CASE
  WHEN ${alias}.GoalStatus <> 'Completed' THEN 0
  WHEN ${isBroughtForwardGoal(alias)} AND ${isCompletedAfterOwnQuarter(alias)} THEN 0
  ELSE COALESCE(${alias}.AchievedWeightage, ${alias}.Weightage, 0)
END`;

// Brought-forward goal from an earlier quarter, completed in [start, end].
const isBroughtForwardAchieved = (alias, startParam, endParam) => `(
  ${isBroughtForwardGoal(alias)}
  AND ${alias}.QuarterEndDate < ${startParam}
  AND ${isCompletedWithin(alias, startParam, endParam)}
)`;

// Final Evaluation category of a goal completed within the quarter that
// starts on startParam (use together with isCompletedWithin):
//   S = C                        -> Achieved
//   E > S, S < C <= E            -> BroughtForward
//   E > S, C > E                 -> BroughtForwardOverdue
//   E = S, C > S                 -> OverdueAchieved
// "C <= E" is "End Date on or after the completion quarter's first day".
const evaluationCategory = (alias, startParam) => `CASE
  WHEN ${alias}.QuarterEndDate >= ${startParam} THEN 'Achieved'
  WHEN ${isBroughtForwardGoal(alias)} AND ${alias}.Timeline >= ${startParam} THEN 'BroughtForward'
  WHEN ${isBroughtForwardGoal(alias)} THEN 'BroughtForwardOverdue'
  ELSE 'OverdueAchieved'
END`;

// Overdue: End Date has passed and the user has not marked it complete.
// Only finally Approved goals can be marked complete, so only they can be
// overdue. todayParam is a DATE.
const isOverdueGoal = (alias, todayParam) =>
  `(${alias}.GoalStatus IN ('Approved', 'Running', 'Postpone') AND ${alias}.Timeline < ${todayParam})`;

module.exports = {
  ALLOCATED_STATUSES_SQL,
  isBroughtForwardGoal,
  completionMarkedDate,
  isAllocatedGoal,
  isCompletedAfterOwnQuarter,
  isCompletedWithin,
  ownAchievedWeightage,
  isBroughtForwardAchieved,
  evaluationCategory,
  isOverdueGoal,
};
