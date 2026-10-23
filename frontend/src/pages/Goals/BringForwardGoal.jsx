import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../services/api";
import {
  getGoalCreationWindow,
  getNextFiscalQuarterDateRange,
} from "../../utils/fiscalQuarter";
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

// Bring one goal from the Goal Management "Bring forward goals" panel into
// the next quarter: the goal in the Add Goal worksheet, read-only except for
// a new End Date, which is submitted for approval again.
// Route: /goals/bring-forward/:id
const BringForwardGoal = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const goalCreationWindow = getGoalCreationWindow();
  const targetQuarterRange = getNextFiscalQuarterDateRange();

  const [row, setRow] = useState(null);
  const [goalNumber, setGoalNumber] = useState("");
  const [currentEndDate, setCurrentEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [error, setError] = useState("");
  const [serverTimelineError, setServerTimelineError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    const loadGoal = async () => {
      try {
        // The bring-forward list decides whether this goal still qualifies.
        const [listRes, goalRes] = await Promise.all([
          api.get("/goals/bring-forward"),
          api.get(`/goals/${id}`),
        ]);
        if (ignore) return;

        const listedGoals = listRes.data?.data?.goals || [];
        const goal = goalRes.data?.data;
        if (
          !goal ||
          !listedGoals.some((listed) => String(listed.GoalID) === String(id))
        ) {
          setLoadError("This goal can no longer be brought forward.");
          return;
        }

        setGoalNumber(goal.GoalNumber ?? "");
        setCurrentEndDate(toDateKey(goal.Timeline));
        // The new End Date starts empty: the current one is never inside
        // the target quarter.
        setRow(
          createGoalRow({
            ...goal,
            StartDate: toDateKey(goal.StartDate),
            Timeline: "",
          }),
        );
      } catch (err) {
        console.error("Failed to load goal to bring forward", err);
        if (!ignore) {
          setLoadError(
            err.response?.data?.message ||
              "Unable to load this goal. Refresh and try again.",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadGoal();
    return () => {
      ignore = true;
    };
  }, [id]);

  const timelineError = row ? getTimelineError(row, targetQuarterRange) : "";
  const visibleErrors = {
    Timeline:
      serverTimelineError ||
      ((attempted || row?.touched.Timeline) && timelineError) ||
      "",
  };

  const updateRow = (field, updater) => {
    setRow((previous) => ({
      ...updater(previous),
      touched: { ...previous.touched, [field]: true },
    }));
    if (field === "Timeline") setServerTimelineError("");
  };

  const submit = async () => {
    setError("");
    setAttempted(true);

    if (!goalCreationWindow.isOpen) {
      setError("The goal-entry window is closed.");
      return;
    }
    if (timelineError) {
      setError("Fix the End Date and try again.");
      return;
    }

    setSubmitting(true);
    try {
      await api.put(`/goals/${id}/bring-forward`, {
        Timeline: parseDateInput(row.Timeline),
      });
      navigate("/goals");
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || "Server error. The goal was not submitted.");
      const fieldError = data?.errors?.Timeline;
      if (typeof fieldError === "string") setServerTimelineError(fieldError);
    } finally {
      setSubmitting(false);
    }
  };

  const unavailableMessage = !goalCreationWindow.isOpen
    ? "The goal-entry window is closed. Goals can be brought forward only while it is open."
    : loadError;

  return (
    <div className="flex-1 min-h-screen overflow-y-auto bg-[#edf1f7] p-4 text-[#202522] font-[Segoe_UI,Arial,sans-serif] sm:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="overflow-hidden border border-[#c6cedc] bg-white shadow-[0_4px_18px_rgba(37,55,80,0.1)]">
          <div className="flex min-h-12 items-center gap-3 bg-[#2c3e82] px-3 py-2 text-xs font-bold tracking-[0.08em] text-white sm:px-5.5">
            <div
              className="grid size-7 place-items-center border border-white/45"
              aria-hidden="true"
            >
              <svg
                className="size-4.5 stroke-current stroke-[1.5]"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path d="M4 3.5h16v17H4z" />
                <path d="M4 8.5h16M4 14h16M10 3.5v17M15 3.5v17" />
              </svg>
            </div>
            <span>GOAL WORKBOOK</span>
            <span className="h-5 w-px bg-white/40" aria-hidden="true" />
            <span className="text-[13px] font-normal tracking-normal">
              Bring forward
            </span>
          </div>

          <div className="px-3 pt-5 sm:px-8 sm:pt-7">
            <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
              <div>
                <span className="mb-2 inline-flex items-center gap-1.5 border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-[#2c3e82]">
                  BRING FORWARD
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Bring forward goal
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Choose a new End Date within {targetQuarterRange.quarter}.
                  The goal goes back for approval; everything else stays as
                  it is.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/goals")}
                className="inline-flex cursor-pointer items-center gap-1.5 self-start text-sm font-medium text-slate-600 transition-colors hover:text-[#2c3e82] sm:self-auto"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
                  />
                </svg>
                Back to Goals
              </button>
            </div>

            {error && (
              <div
                className="mb-6 flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700"
                role="alert"
              >
                <svg
                  className="w-5 h-5 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <p className="mb-6 text-sm text-slate-500">Loading goal...</p>
            ) : unavailableMessage ? (
              <div
                className="mb-6 border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900"
                role="status"
              >
                {unavailableMessage}
              </div>
            ) : (
              row && (
                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                  className="flex flex-col gap-3.5"
                >
                  <span className="-mb-2 text-xs text-slate-500">
                    Only the End Date can be changed. Scroll horizontally to
                    see all columns.
                  </span>
                  <GoalWorksheet ariaLabel="Bring forward goal worksheet">
                    <GoalSheetRow
                      row={row}
                      rowNumber={1}
                      goalNumber={goalNumber}
                      editableFields={EDITABLE_FIELDS}
                      onChange={updateRow}
                      errors={visibleErrors}
                      startDateRange={targetQuarterRange}
                      endDateRange={{
                        min: targetQuarterRange.min,
                        max: targetQuarterRange.max,
                        hint: `Within ${targetQuarterRange.quarter} · currently ${formatDateForDisplay(currentEndDate)}`,
                      }}
                    />
                  </GoalWorksheet>

                  <div className="flex flex-col gap-2 border-t border-slate-200 pt-6">
                    <div className="flex flex-col-reverse items-center justify-end gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => navigate("/goals")}
                        className="w-full cursor-pointer border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full cursor-pointer bg-[#2c3e82] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2c61] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        {submitting ? "Submitting..." : "Submit for approval"}
                      </button>
                    </div>
                  </div>
                </form>
              )
            )}
            <div
              className="-mx-3 mt-4.5 flex min-h-10.5 items-stretch gap-4.5 border-t border-[#d5dce5] bg-[#f4f6fa] px-3 sm:-mx-8 sm:px-6"
              aria-hidden="true"
            >
              <span className="flex items-center border-t-[3px] border-[#2c3e82] bg-white px-4.5 text-xs font-bold text-[#2c3e82]">
                Bring Forward
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BringForwardGoal;
