import { useEffect, useState } from "react";
import api from "../../services/api";
import {
  createGoalRow,
  formatDateForDisplay,
  parseDateInput,
} from "../../utils/goalWorksheet";
import GoalSheetRow, {
  GoalWorksheet,
} from "../../components/GoalWorksheet/GoalWorksheet";

// Only the End Date changes when a goal is brought forward.
const EDITABLE_FIELDS = ["Timeline"];

// SQL DATE values arrive as 'YYYY-MM-DDT00:00:00.000Z'.
const toDateKey = (value) => (value ? String(value).slice(0, 10) : "");

const getTimelineError = (row, targetRange) => {
  const endDate = parseDateInput(row.Timeline);
  return !endDate || endDate < targetRange.min || endDate > targetRange.max
    ? `Enter an End Date as DD/MM/YYYY within ${targetRange.quarter} (${formatDateForDisplay(targetRange.min)} to ${formatDateForDisplay(targetRange.max)}).`
    : "";
};

// The Add Goal page's inline "Bring forward goals" sheet: every goal on the
// bring-forward list in the goal worksheet, read-only except for a new End
// Date. Goals given a new End Date are submitted for approval again; goals
// left blank are skipped.
// - goals: the GET /goals/bring-forward list.
// - targetRange: { quarter, min, max } the new End Date must fall in.
// - onBroughtForward(goalIds): called with the goals that were submitted.
const BringForwardSheet = ({ goals, targetRange, onBroughtForward }) => {
  const [rows, setRows] = useState([]);
  const [goalNumbers, setGoalNumbers] = useState({});
  const [currentEndDates, setCurrentEndDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [serverErrors, setServerErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // The list only has summary columns; load each goal in full for its cells.
  // Loaded once, when the sheet opens; submitted goals are removed locally.
  useEffect(() => {
    let ignore = false;

    const loadGoals = async () => {
      try {
        const responses = await Promise.all(
          goals.map((goal) => api.get(`/goals/${goal.GoalID}`)),
        );
        if (ignore) return;

        const numbers = {};
        const endDates = {};
        const loadedRows = responses
          .map((response) => response.data?.data)
          .filter(Boolean)
          .map((goal) => {
            // The new End Date starts empty: the current one is never inside
            // the target quarter.
            const row = createGoalRow({
              ...goal,
              StartDate: toDateKey(goal.StartDate),
              Timeline: "",
            });
            numbers[row.key] = goal.GoalNumber ?? "";
            endDates[row.key] = toDateKey(goal.Timeline);
            return row;
          });
        setGoalNumbers(numbers);
        setCurrentEndDates(endDates);
        setRows(loadedRows);
      } catch (err) {
        console.error("Failed to load goals to bring forward", err);
        if (!ignore) {
          setLoadError(
            err.response?.data?.message ||
              "Unable to load the goals to bring forward. Refresh and try again.",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadGoals();
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A blank End Date means "not this goal"; only entered dates are checked
  // (all of them once a submit is attempted).
  const getVisibleErrors = (row) => {
    const timelineError =
      row.Timeline && (attempted || row.touched.Timeline)
        ? getTimelineError(row, targetRange)
        : "";
    return { Timeline: serverErrors[row.key] || timelineError || "" };
  };

  const updateRow = (key, field, updater) => {
    setRows((previous) =>
      previous.map((row) =>
        row.key === key
          ? { ...updater(row), touched: { ...row.touched, [field]: true } }
          : row,
      ),
    );
    if (field === "Timeline") {
      setServerErrors((previous) => {
        if (!previous[key]) return previous;
        const next = { ...previous };
        delete next[key];
        return next;
      });
    }
    setSuccess("");
  };

  const submit = async () => {
    setError("");
    setSuccess("");
    setAttempted(true);

    const selectedRows = rows.filter((row) => row.Timeline.trim());
    if (selectedRows.length === 0) {
      setError("Enter a new End Date for each goal you want to bring forward.");
      return;
    }
    if (selectedRows.some((row) => getTimelineError(row, targetRange))) {
      setError("Fix the highlighted End Dates and try again.");
      return;
    }

    setSubmitting(true);
    const submittedKeys = [];
    const failedErrors = {};
    // One request per goal: each goes through its own approval reset.
    for (const row of selectedRows) {
      try {
        await api.put(`/goals/${row.GoalID}/bring-forward`, {
          Timeline: parseDateInput(row.Timeline),
        });
        submittedKeys.push(row.key);
      } catch (err) {
        const data = err.response?.data;
        failedErrors[row.key] =
          (typeof data?.errors?.Timeline === "string" &&
            data.errors.Timeline) ||
          data?.message ||
          "Server error. This goal was not submitted.";
      }
    }
    setSubmitting(false);

    const submittedIds = rows
      .filter((row) => submittedKeys.includes(row.key))
      .map((row) => row.GoalID);
    setRows((previous) =>
      previous.filter((row) => !submittedKeys.includes(row.key)),
    );
    setServerErrors(failedErrors);
    setAttempted(false);
    if (submittedIds.length > 0) {
      setSuccess(
        `${submittedIds.length} goal${submittedIds.length === 1 ? "" : "s"} brought forward and submitted for approval.`,
      );
      onBroughtForward(submittedIds);
    }
    if (Object.keys(failedErrors).length > 0) {
      setError("Some goals were not submitted. See the highlighted End Dates.");
    }
  };

  return (
    <section
      className="mt-6 flex flex-col gap-3.5 border-t border-slate-200 pt-6"
      aria-labelledby="bring-forward-heading"
    >
      <div>
        <h2
          id="bring-forward-heading"
          className="text-lg font-bold text-slate-900"
        >
          Bring forward goals
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Approved goals ending this quarter or earlier. Enter a new End Date
          within {targetRange.quarter} for each goal to bring forward; it goes
          back for approval and everything else stays as it is. Leave the End
          Date blank to skip a goal.
        </p>
      </div>

      {error && (
        <div
          className="border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          className="border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
          role="status"
        >
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading goals...</p>
      ) : loadError ? (
        <div
          className="border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900"
          role="status"
        >
          {loadError}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          There are no more goals to bring forward.
        </p>
      ) : (
        <>
          <span className="-mb-2 text-xs text-slate-500">
            Only the End Date can be changed. Scroll horizontally to see all
            columns.
          </span>
          <GoalWorksheet ariaLabel="Bring forward goals worksheet">
            {rows.map((row, index) => (
              <GoalSheetRow
                key={row.key}
                row={row}
                rowNumber={index + 1}
                goalNumber={goalNumbers[row.key]}
                editableFields={EDITABLE_FIELDS}
                onChange={(field, updater) =>
                  updateRow(row.key, field, updater)
                }
                errors={getVisibleErrors(row)}
                startDateRange={targetRange}
                endDateRange={{
                  min: targetRange.min,
                  max: targetRange.max,
                  hint: `Within ${targetRange.quarter} · currently ${formatDateForDisplay(currentEndDates[row.key])}`,
                }}
              />
            ))}
          </GoalWorksheet>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="w-full cursor-pointer bg-[#2c3e82] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2c61] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting ? "Submitting..." : "Submit brought-forward goals"}
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default BringForwardSheet;
