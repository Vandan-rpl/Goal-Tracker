// SQL predicates shared by every per-quarter goal summary (employee
// dashboard, quarter goal details, Final Evaluation, analytics). All take the
// goal table alias so they can be dropped into any query.
//
//   Allocated:  a goal counts in its own quarter (Goals.Quarter) only once it
//               is finally Approved (or later in the lifecycle). A goal whose
//               extension is awaiting approval was approved before, so it
//               stays allocated.
//   Brought forward: only goals the owner extended (carry-forward, i.e.
//               CarryForwardCount > 0). A goal created with an End Date in a
//               later quarter is NOT brought forward; it simply belongs to its
//               own quarter.
//   Achieved:   an extended goal completed after its own quarter ended counts
//               only as brought forward achieved in the quarter it was
//               completed in, never as Achieved in its own quarter.

const ALLOCATED_STATUSES_SQL =
  "'Approved', 'Running', 'Postpone', 'Completion Submitted', 'Completed'";

const isExtended = (alias = "g") => `ISNULL(${alias}.CarryForwardCount, 0) > 0`;

const isAllocatedGoal = (alias = "g") => `(
  ${alias}.GoalStatus IN (${ALLOCATED_STATUSES_SQL})
  OR (${isExtended(alias)}
      AND ${alias}.GoalStatus NOT IN ('Draft', 'Rejected', 'Cancelled'))
)`;

const isCompletedAfterOwnQuarter = (alias = "g") =>
  `${alias}.CompletedDate >= DATEADD(DAY, 1, ${alias}.QuarterEndDate)`;

// Achieved weightage the goal contributes to its own quarter.
const ownAchievedWeightage = (alias = "g") => `CASE
  WHEN ${isExtended(alias)} AND ${isCompletedAfterOwnQuarter(alias)} THEN 0
  ELSE COALESCE(${alias}.AchievedWeightage, 0)
END`;

// Extended goal from an earlier quarter, still open, End Date in [start, end].
const isBroughtForwardPending = (alias, startParam, endParam) => `(
  ${isExtended(alias)}
  AND ${alias}.QuarterEndDate < ${startParam}
  AND ${alias}.Timeline >= ${startParam}
  AND ${alias}.Timeline < DATEADD(DAY, 1, ${endParam})
  AND ${alias}.GoalStatus NOT IN ('Completed', 'Draft', 'Rejected', 'Cancelled')
)`;

// Extended goal from an earlier quarter, completed in [start, end].
const isBroughtForwardAchieved = (alias, startParam, endParam) => `(
  ${isExtended(alias)}
  AND ${alias}.QuarterEndDate < ${startParam}
  AND ${alias}.CompletedDate >= ${startParam}
  AND ${alias}.CompletedDate < DATEADD(DAY, 1, ${endParam})
)`;

module.exports = {
  isExtended,
  isAllocatedGoal,
  isCompletedAfterOwnQuarter,
  ownAchievedWeightage,
  isBroughtForwardPending,
  isBroughtForwardAchieved,
};
