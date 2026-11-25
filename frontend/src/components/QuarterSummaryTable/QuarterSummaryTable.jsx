import { Fragment, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import QuarterGoalDetails from "../QuarterGoalDetails/QuarterGoalDetails";
import { formatFiscalQuarterLabel } from "../../utils/fiscalQuarter";

// Quarter summary table shared by the employee dashboard and Final Evaluation.
// Future quarters show only Allocated and Brought forward (pending).
// Clicking a row expands the goals behind its numbers (one quarter at a time).
// The expanded quarter lives in the URL (?quarter=) so it is still open after
// visiting a goal and coming back.
//
// quarters: [{ quarter, isFuture, allocated, achieved, completedCount,
//              countedGoalCount, overdueAchieved,
//              broughtForwardOverdueAchieved, broughtForwardAchieved }]
// employeeId / achievementRule: passed to QuarterGoalDetails.
// children: extra rows rendered after the quarters (e.g. a yearly average).
// columns: optional [{ label, title, getValue(quarter), emphasize }] replacing
//   the default (employee dashboard) columns; Final Evaluation and Team
//   Reports pass their category columns.
// extraColumn: optional { label, title, getValue(quarter) } shown last.
function formatPercent(value) {
  return `${Number(Number(value || 0).toFixed(2))}%`;
}

// Goals can be set before a quarter starts, so a future quarter still shows
// its allocation; the rest is "–".
const DEFAULT_COLUMNS = [
  { label: "Allocated", getValue: (quarter) => formatPercent(quarter.allocated) },
  {
    label: "Achieved (%)",
    emphasize: true,
    getValue: (quarter) =>
      quarter.isFuture ? "–" : formatPercent(quarter.achieved),
  },
  {
    label: "Achieved (Count)",
    getValue: (quarter) =>
      quarter.isFuture
        ? "–"
        : `${quarter.completedCount} of ${quarter.countedGoalCount}`,
  },
  {
    label: "Overdue achieved",
    title: "Goals ending in their own quarter, completed in this later quarter.",
    getValue: (quarter) =>
      quarter.isFuture ? "–" : formatPercent(quarter.overdueAchieved),
  },
  {
    label: "Brought forward overdue achieved",
    title:
      "Goals whose End Date is in a later quarter, completed in this quarter, after their End Date's quarter.",
    getValue: (quarter) =>
      quarter.isFuture ? "–" : formatPercent(quarter.broughtForwardOverdueAchieved),
  },
  {
    label: "Brought forward achieved",
    getValue: (quarter) =>
      quarter.isFuture ? "–" : formatPercent(quarter.broughtForwardAchieved),
  },
];

export default function QuarterSummaryTable({
  quarters,
  currentQuarter,
  employeeId,
  achievementRule,
  columns = DEFAULT_COLUMNS,
  extraColumn,
  children,
}) {
  const columnCount = columns.length + (extraColumn ? 1 : 0);
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
            {columns.map((column) => (
              <th
                key={column.label}
                className="pb-2 px-3 font-medium last:pr-0"
                title={column.title}
              >
                {column.label}
              </th>
            ))}
            {extraColumn && (
              <th className="pb-2 px-3 font-medium last:pr-0" title={extraColumn.title}>
                {extraColumn.label}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {quarters.map((quarter) => {
            const isCurrent = quarter.quarter === currentQuarter;
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
                    {formatFiscalQuarterLabel(quarter.quarter)}
                    {isCurrent && (
                      <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        Current
                      </span>
                    )}
                  </th>
                  {columns.map((column) => (
                    <td
                      key={column.label}
                      className={`px-3 py-3 whitespace-nowrap ${
                        column.emphasize && !quarter.isFuture
                          ? "font-medium text-indigo-700"
                          : "text-gray-600"
                      }`}
                    >
                      {column.getValue(quarter)}
                    </td>
                  ))}
                  {extraColumn && (
                    <td className="px-3 py-3 whitespace-nowrap text-gray-600">
                      {extraColumn.getValue(quarter)}
                    </td>
                  )}
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={columnCount + 1} className="bg-gray-50 p-0">
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
