import { useCallback, useEffect, useState } from "react";
import api from "../../services/api";
import MarkCompleteButton from "../../components/GoalCompletion/MarkCompleteButton";
import { formatDateForDisplay } from "../../utils/goalWorksheet";
import { formatQuarterLabel } from "../../utils/fiscalQuarter";

// Add Goal page, below the goal sheet: the user's pending goals
// (GET /goals/pending), in this order:
//   Overdue (needs action): finally Approved goals from any quarter whose End
//     Date has passed and that are not marked complete. Each row can be
//     marked complete through the existing completion approval flow.
//   Will be brought forward (information only): Approved, not-completed
//     goals from an earlier quarter whose End Date falls in the target
//     quarter.
// Nothing here blocks adding or submitting new goals.

const COLUMNS = [
  "Goal No.",
  "Goal Title",
  "Quarter",
  "Start Date",
  "End Date",
  "Weightage %",
  "Status",
];

const formatWeightage = (value) => `${Number(Number(value || 0).toFixed(2))}%`;

const PendingGoalTable = ({ goals, renderStatus, renderAction }) => (
  <div className="overflow-x-auto border border-[#c6cedc]">
    <table className="min-w-full text-left text-sm">
      <thead className="bg-[#f4f6fa] text-xs font-semibold text-slate-600">
        <tr>
          {COLUMNS.map((column) => (
            <th
              key={column}
              scope="col"
              className="border-b border-[#d5dce5] px-3 py-2 whitespace-nowrap"
            >
              {column}
            </th>
          ))}
          {renderAction && (
            <th
              scope="col"
              className="border-b border-[#d5dce5] px-3 py-2 text-right whitespace-nowrap"
            >
              Action
            </th>
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#e3e8ef] bg-white">
        {goals.map((goal) => (
          <tr key={goal.GoalID}>
            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
              {goal.GoalNumber ?? "–"}
            </td>
            <td className="px-3 py-2 font-medium text-slate-900">
              {goal.GoalTitle}
            </td>
            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
              {goal.Quarter ? formatQuarterLabel(goal.Quarter) : "–"}
            </td>
            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
              {formatDateForDisplay(goal.StartDate) || "–"}
            </td>
            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
              {formatDateForDisplay(goal.Timeline) || "–"}
            </td>
            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
              {formatWeightage(goal.Weightage)}
            </td>
            <td className="px-3 py-2 whitespace-nowrap">{renderStatus(goal)}</td>
            {renderAction && (
              <td className="px-3 py-2 text-right whitespace-nowrap">
                {renderAction(goal)}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const GroupHeading = ({ title, hint }) => (
  <div className="mb-2">
    <h3 className="text-sm font-bold text-slate-800">{title}</h3>
    {hint && <p className="text-xs text-slate-500">{hint}</p>}
  </div>
);

const EmptyGroup = ({ children }) => (
  <p className="border border-dashed border-[#c6cedc] bg-[#f8fafc] px-3 py-2.5 text-xs text-slate-500">
    {children}
  </p>
);

const PendingGoalsSection = ({ targetQuarter }) => {
  const [pending, setPending] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Bumped after a goal is marked complete, to reload the lists.
  const [reloadKey, setReloadKey] = useState(0);
  const reloadPending = useCallback(() => setReloadKey((key) => key + 1), []);

  // The Add Goal page remounts this section whenever the sheet (and so the
  // target quarter) reloads, so the initial loading state is enough.
  useEffect(() => {
    let ignore = false;

    const loadPending = async () => {
      try {
        const response = await api.get("/goals/pending", {
          params: targetQuarter ? { quarter: targetQuarter } : {},
        });
        if (ignore) return;
        setPending(response.data?.data || null);
        setError("");
      } catch (err) {
        console.error("Failed to load pending goals", err);
        if (!ignore) {
          setError(
            err.response?.data?.message || "Unable to load your pending goals.",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadPending();
    return () => {
      ignore = true;
    };
  }, [targetQuarter, reloadKey]);

  const overdueGoals = pending?.overdue || [];
  const broughtForwardGoals = pending?.broughtForward || [];
  const quarterLabel = formatQuarterLabel(
    pending?.targetQuarter?.quarter || targetQuarter,
  );

  return (
    <section
      aria-labelledby="pending-goals-heading"
      className="mt-8 border-t border-slate-200 pt-8"
    >
      <h2
        id="pending-goals-heading"
        className="mb-1 text-lg font-bold text-slate-900"
      >
        Pending Goals
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        For your information. Pending goals do not stop you from adding or
        submitting new goals.
      </p>

      {loading ? (
        <p className="text-sm text-slate-500">Loading your pending goals...</p>
      ) : error ? (
        <p className="border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : overdueGoals.length === 0 && broughtForwardGoals.length === 0 ? (
        <EmptyGroup>You have no overdue or brought-forward goals.</EmptyGroup>
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <GroupHeading
              title={`Overdue (needs action) · ${overdueGoals.length}`}
              hint="Approved goals whose End Date has passed and that are not marked complete yet."
            />
            {overdueGoals.length > 0 ? (
              <PendingGoalTable
                goals={overdueGoals}
                renderStatus={(goal) => (
                  <span className="inline-flex border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                    Overdue by {goal.DaysOverdue}{" "}
                    {goal.DaysOverdue === 1 ? "day" : "days"}
                  </span>
                )}
                renderAction={(goal) => (
                  <MarkCompleteButton
                    goalId={goal.GoalID}
                    goalTitle={goal.GoalTitle}
                    onCompleted={reloadPending}
                    compact
                  />
                )}
              />
            ) : (
              <EmptyGroup>No overdue goals.</EmptyGroup>
            )}
          </div>

          <div>
            <GroupHeading
              title={`Will be brought forward · ${broughtForwardGoals.length}`}
              hint={`Approved goals from earlier quarters that end in ${quarterLabel}. They are not part of ${quarterLabel}'s 100%.`}
            />
            {broughtForwardGoals.length > 0 ? (
              <PendingGoalTable
                goals={broughtForwardGoals}
                renderStatus={() => (
                  <span className="inline-flex border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-[#2c3e82]">
                    Brought Forward
                  </span>
                )}
              />
            ) : (
              <EmptyGroup>No goals will be brought forward into {quarterLabel}.</EmptyGroup>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default PendingGoalsSection;
