// Helpers for the YearlyPerformance object returned by the evaluation
// calculation (Final Evaluation page and Reports & Analytics).

// Quarter rows in the shape QuarterSummaryTable expects (same as the
// employee dashboard's quarter summary).
export const toSummaryQuarters = (yearlyPerformance) =>
  (yearlyPerformance?.Quarters || []).map((quarter) => ({
    quarter: `${quarter.Quarter}-${yearlyPerformance.FiscalYear}`,
    isFuture: quarter.isFuture,
    allocated: quarter.SummaryAllocated,
    achieved: quarter.SummaryAchieved,
    completedCount: quarter.CompletedCount,
    countedGoalCount: quarter.CountedGoalCount,
    broughtForwardPending: quarter.BroughtForwardPending,
    broughtForwardAchieved: quarter.BroughtForwardAchieved,
    quarterCompletion: quarter.QuarterCompletionPercentage,
  }));

// Server-calculated percentage (Year Score, Quarter Completion); "—" when
// there is nothing to divide by.
export const formatScorePercent = (value) =>
  value == null ? "—" : `${Number(value).toFixed(2)}%`;

export const QUARTER_COMPLETION_TITLE =
  "Share of all work due in this quarter (new + brought forward) that was completed. Not used in the Year Score.";
