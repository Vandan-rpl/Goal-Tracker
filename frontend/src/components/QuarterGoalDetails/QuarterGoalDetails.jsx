import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getQuarterGoalDetails } from "../../services/dashboardService";
import { getGoalStatusLabel } from "../../utils/goalStatus";
import { formatDateForDisplay } from "../../utils/goalWorksheet";

// The goals behind one row of the quarter summary. Reusable: pass employeeId
// to show a team member's goals (Final Evaluation); omit it for the logged-in
// user. achievementRule="evaluation" totals Achieved like the Final
// Evaluation summary. Section totals come from the server with the same filters as the
// summary, so the footers always match the summary row.

const COLUMNS = ["Goal No.", "Title", "Weightage", "End Date", "Status", "Sub-goals", "Note"];

function formatPercent(value) {
  return `${Number(Number(value || 0).toFixed(2))}%`;
}

// One short line: the first rule that applies.
function getGoalNote(goal, section) {
  if (goal.status === "Completed" && goal.completedDate) {
    return `Completed on ${formatDateForDisplay(goal.completedDate)}`;
  }
  if (goal.status === "Approved" && goal.completionRemark) {
    return `Completion rejected: ${goal.completionRemark}`;
  }
  if (section === "own" && goal.movedToQuarter) {
    return `Moved to ${goal.movedToQuarter}`;
  }
  if (section === "broughtForward") {
    return goal.carryForwardCount > 0
      ? `From ${goal.fromQuarter} · carried forward ${goal.carryForwardCount}×`
      : `From ${goal.fromQuarter}`;
  }
  return "";
}

function GoalSection({ title, goals, section, footer, emptyMessage, onOpenGoal }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </h3>
      {goals.length ? (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-400">
              <tr>
                {COLUMNS.map((column) => (
                  <th key={column} className="px-3 py-2 font-medium whitespace-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {goals.map((goal) => (
                <tr
                  key={goal.goalId}
                  onClick={() => onOpenGoal(goal.goalId)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") onOpenGoal(goal.goalId);
                  }}
                  tabIndex={0}
                  className="cursor-pointer hover:bg-indigo-50/60 focus:bg-indigo-50/60 focus:outline-none"
                >
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{goal.goalNumber ?? "–"}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{goal.title}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatPercent(goal.weightage)}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {goal.endDate ? formatDateForDisplay(goal.endDate) : "–"}
                  </td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{getGoalStatusLabel(goal.status)}</td>
                  <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                    {goal.totalSubGoals
                      ? `${goal.completedSubGoals}/${goal.totalSubGoals} steps done`
                      : "–"}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">{getGoalNote(goal, section)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-gray-100 px-3 py-2 text-xs font-medium text-gray-600">
            {footer}
          </p>
        </div>
      ) : (
        <p className="rounded-xl bg-white p-3 text-sm text-gray-400">{emptyMessage}</p>
      )}
    </div>
  );
}

export default function QuarterGoalDetails({ employeeId, quarter, achievementRule }) {
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetails(await getQuarterGoalDetails(quarter, employeeId, achievementRule));
    } catch (err) {
      setError(err?.response?.data?.message || "Couldn't load this quarter's goals.");
    } finally {
      setLoading(false);
    }
  }, [quarter, employeeId, achievementRule]);

  useEffect(() => {
    load();
  }, [load]);

  const openGoal = (goalId) => navigate(`/goals/view/${goalId}`);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading {quarter} goals...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 text-sm text-red-600">
        {error}
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const { ownGoals, broughtForward } = details;
  return (
    <div className="space-y-4 p-4">
      <GoalSection
        title="This quarter's goals"
        section="own"
        goals={ownGoals.goals}
        footer={`Total ${formatPercent(ownGoals.allocated)} · Achieved ${formatPercent(
          ownGoals.achieved,
        )} · Completed ${ownGoals.completedCount}`}
        emptyMessage="No goals set for this quarter"
        onOpenGoal={openGoal}
      />
      <GoalSection
        title="Brought forward into this quarter"
        section="broughtForward"
        goals={broughtForward.goals}
        footer={`Pending ${formatPercent(broughtForward.pending)} · Achieved ${formatPercent(
          broughtForward.achieved,
        )}`}
        emptyMessage="No goals brought forward into this quarter"
        onOpenGoal={openGoal}
      />
    </div>
  );
}
