import { Fragment, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import QuarterGoalDetails from "../QuarterGoalDetails/QuarterGoalDetails";

// Quarter summary table shared by the employee dashboard and Final Evaluation.
// Future quarters show only Allocated and Brought forward (pending).
// Clicking a row expands the goals behind its numbers (one quarter at a time).
// The expanded quarter lives in the URL (?quarter=) so it is still open after
// visiting a goal and coming back.
//
// quarters: [{ quarter, isFuture, allocated, achieved, completedCount,
//              countedGoalCount, broughtForwardPending, broughtForwardAchieved }]
// employeeId / achievementRule: passed to QuarterGoalDetails.
// children: extra rows rendered after the quarters (e.g. a yearly average).
const QUARTER_SUMMARY_COLUMNS = [
  "Allocated",
  "Achieved",
  "Completed",
  "Brought forward (pending)",
  "Brought forward achieved",
];

function formatPercent(value) {
  return `${Number(Number(value || 0).toFixed(2))}%`;
}

export default function QuarterSummaryTable({
  quarters,
  currentQuarter,
  employeeId,
  achievementRule,
  children,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const expandedQuarter = searchParams.get("quarter");
  const toggleQuarter = useCallback(
    (quarter) =>
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          if (next.get("quarter") === quarter) next.delete("quarter");
          else next.set("quarter", quarter);
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-gray-100 text-xs text-gray-400">
          <tr>
            <th className="pb-2 pr-4 font-medium">Quarter</th>
            {QUARTER_SUMMARY_COLUMNS.map((column) => (
              <th key={column} className="pb-2 px-3 font-medium last:pr-0">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {quarters.map((quarter) => {
            const isCurrent = quarter.quarter === currentQuarter;
            // Goals can be set (or moved) before a quarter starts, so a
            // future quarter still shows its allocation and pending
            // brought-forward weightage; the rest is "–".
            const cells = quarter.isFuture
              ? [
                  formatPercent(quarter.allocated),
                  "–",
                  "–",
                  formatPercent(quarter.broughtForwardPending),
                  "–",
                ]
              : [
                  formatPercent(quarter.allocated),
                  formatPercent(quarter.achieved),
                  `${quarter.completedCount} of ${quarter.countedGoalCount}`,
                  formatPercent(quarter.broughtForwardPending),
                  formatPercent(quarter.broughtForwardAchieved),
                ];
            const isExpanded = quarter.quarter === expandedQuarter;
            const ToggleIcon = isExpanded ? ChevronDown : ChevronRight;
            return (
              <Fragment key={quarter.quarter}>
                <tr
                  className={`cursor-pointer hover:bg-gray-50 ${isCurrent ? "bg-indigo-50/60" : ""}`}
                  aria-current={isCurrent ? "true" : undefined}
                  aria-expanded={isExpanded}
                  tabIndex={0}
                  onClick={() => toggleQuarter(quarter.quarter)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      toggleQuarter(quarter.quarter);
                    }
                  }}
                >
                  <th className="py-3 pl-2 pr-4 font-medium text-gray-700 whitespace-nowrap">
                    <ToggleIcon className="mr-1 inline h-4 w-4 text-gray-400" aria-hidden="true" />
                    {quarter.quarter}
                    {isCurrent && (
                      <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        Current
                      </span>
                    )}
                  </th>
                  {cells.map((value, index) => (
                    <td
                      key={QUARTER_SUMMARY_COLUMNS[index]}
                      className={`px-3 py-3 whitespace-nowrap ${
                        index === 1 && !quarter.isFuture
                          ? "font-medium text-indigo-700"
                          : "text-gray-600"
                      }`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={QUARTER_SUMMARY_COLUMNS.length + 1} className="bg-gray-50 p-0">
                      <QuarterGoalDetails
                        quarter={quarter.quarter}
                        employeeId={employeeId}
                        achievementRule={achievementRule}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {children}
        </tbody>
      </table>
    </div>
  );
}
