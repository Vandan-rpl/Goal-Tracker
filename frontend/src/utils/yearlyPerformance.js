// Helpers for the YearlyPerformance object returned by the evaluation
// calculation (Final Evaluation page and Reports & Analytics).

// Quarter rows in the shape QuarterSummaryTable expects.
export const toSummaryQuarters = (yearlyPerformance) =>
  (yearlyPerformance?.Quarters || []).map((quarter) => ({
    quarter: `${quarter.Quarter}-${yearlyPerformance.FiscalYear}`,
    isFuture: quarter.isFuture,
    allocated: quarter.SummaryAllocated,
    completedCount: quarter.CompletedCount,
    countedGoalCount: quarter.CountedGoalCount,
    categoryAchieved: quarter.CategoryAchieved,
    categoryBroughtForward: quarter.CategoryBroughtForward,
    categoryBroughtForwardOverdue: quarter.CategoryBroughtForwardOverdue,
    categoryOverdueAchieved: quarter.CategoryOverdueAchieved,
    categoryTotal: quarter.CategoryTotal,
    overdueCount: quarter.OverdueCount,
    quarterScore: quarter.QuarterScorePercentage,
  }));

// Server-calculated percentage (Year Score, Quarter Score); "—" when there
// is nothing to divide by.
export const formatScorePercent = (value) =>
  value == null ? "—" : `${Number(value).toFixed(2)}%`;

const formatWeightPercent = (value) =>
  `${Number(Number(value || 0).toFixed(2))}%`;

export const QUARTER_SCORE_FORMULA =
  "(Achieved + Brought Forward + Brought Forward Overdue + Overdue Achieved) ÷ Allocated";

export const QUARTER_SCORE_TITLE = `Quarter Score = ${QUARTER_SCORE_FORMULA} for this quarter.`;

export const YEAR_SCORE_FORMULA =
  "(Achieved + Brought Forward + Brought Forward Overdue + Overdue Achieved) ÷ Allocated, totalled over the quarters that have started";

// Kept for existing imports (Team Reports column titles).
export const QUARTER_COMPLETION_TITLE = QUARTER_SCORE_TITLE;

// A future quarter has nothing completed yet.
const futureDash = (getValue) => (quarter) =>
  quarter.isFuture ? "–" : getValue(quarter);

// Final Evaluation / Team Reports quarter table columns.
export const EVALUATION_COLUMNS = [
  {
    label: "Allocated",
    title: "Approved goals that start in this quarter.",
    getValue: (quarter) => formatWeightPercent(quarter.allocated),
  },
  {
    label: "Achieved",
    title: "Completed in the goal's own (start) quarter.",
    emphasize: true,
    getValue: futureDash((quarter) => formatWeightPercent(quarter.categoryAchieved)),
  },
  {
    label: "Brought Forward",
    title:
      "Goals whose End Date is in a later quarter, completed in this quarter, after their start quarter and no later than their End Date's quarter.",
    getValue: futureDash((quarter) => formatWeightPercent(quarter.categoryBroughtForward)),
  },
  {
    label: "Brought Forward Overdue",
    title:
      "Goals whose End Date is in a later quarter, completed in this quarter, after their End Date's quarter.",
    getValue: futureDash((quarter) =>
      formatWeightPercent(quarter.categoryBroughtForwardOverdue),
    ),
  },
  {
    label: "Overdue Achieved",
    title:
      "Goals ending in their own quarter, completed in this later quarter.",
    getValue: futureDash((quarter) => formatWeightPercent(quarter.categoryOverdueAchieved)),
  },
  {
    label: "Overdue",
    title: "This quarter's goals past their End Date and not marked complete (count).",
    getValue: futureDash((quarter) => String(quarter.overdueCount ?? 0)),
  },
  {
    label: "Quarter Score",
    title: QUARTER_SCORE_TITLE,
    emphasize: true,
    getValue: futureDash((quarter) => formatScorePercent(quarter.quarterScore)),
  },
];
