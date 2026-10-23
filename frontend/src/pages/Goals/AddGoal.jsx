import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import {
  getNextFiscalQuarterDateRange,
  getGoalCreationWindow,
} from "../../utils/fiscalQuarter";
import { getSubGoalError } from "../../utils/subGoals";
import {
  GOAL_SHEET_FIELDS,
  createGoalRow,
  formatDateForDisplay,
  parseDateInput,
  worksheetErrorClass,
} from "../../utils/goalWorksheet";
import GoalSheetRow, {
  GoalWorksheet,
} from "../../components/GoalWorksheet/GoalWorksheet";

const MAX_GOALS_PER_QUARTER = 8;
const MIN_GOAL_WEIGHTAGE = 5;
const MAX_GOAL_WEIGHTAGE = 100;
const FULL_ALLOCATION_HUNDREDTHS = 10000;

const getWeightageHundredths = (weightage) =>
  Math.round(Number(weightage || 0) * 100);

const formatHundredths = (hundredths) => (hundredths / 100).toFixed(2);


const getTitledSubGoals = (row) =>
  row.SubGoals.filter((subGoal) => subGoal.SubGoalTitle.trim());

// Client-side checks for one row; the server repeats them (plus the SMART
// criteria on Submit).
const getRowErrors = (row, quarterRange) => {
  const errors = {};

  if (!row.GoalTitle.trim()) {
    errors.GoalTitle = "Goal Title is required.";
  }

  const weightage = Number(row.Weightage);
  if (row.Weightage === "") {
    errors.Weightage = "Weightage is required.";
  } else if (
    !Number.isFinite(weightage) ||
    weightage < MIN_GOAL_WEIGHTAGE ||
    weightage > MAX_GOAL_WEIGHTAGE ||
    Math.abs(weightage * 100 - Math.round(weightage * 100)) > 1e-8
  ) {
    errors.Weightage = `Weightage must be from ${MIN_GOAL_WEIGHTAGE}% to ${MAX_GOAL_WEIGHTAGE}%, with no more than two decimal places.`;
  }

  const startDate = parseDateInput(row.StartDate);
  const endDate = parseDateInput(row.Timeline);
  if (
    !startDate ||
    startDate < quarterRange.min ||
    startDate > quarterRange.max
  ) {
    errors.StartDate = `Enter a Start Date as DD/MM/YYYY within ${quarterRange.quarter} (${formatDateForDisplay(quarterRange.min)} to ${formatDateForDisplay(quarterRange.max)}).`;
  }
  if (!endDate) {
    errors.Timeline = "Enter a valid End Date as DD/MM/YYYY.";
  } else if (startDate && endDate < startDate) {
    errors.Timeline = "End Date must be on or after Start Date.";
  }

  const subGoalError = getSubGoalError(getTitledSubGoals(row));
  if (subGoalError) errors.SubGoals = subGoalError;

  return errors;
};

const AddGoal = () => {
  const navigate = useNavigate();
  const goalCreationWindow = getGoalCreationWindow();
  const currentQuarterRange = getNextFiscalQuarterDateRange();

  const [rows, setRows] = useState([]);
  const [goalNumberStart, setGoalNumberStart] = useState(1);
  const [maxGoals, setMaxGoals] = useState(MAX_GOALS_PER_QUARTER);
  const [sheetLoading, setSheetLoading] = useState(true);
  const [sheetLoadError, setSheetLoadError] = useState("");

  const [jointAccountabilityUsers, setJointAccountabilityUsers] = useState([]);
  const [jointAccountabilityUsersLoading, setJointAccountabilityUsersLoading] =
    useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Field errors from the backend, keyed by row key and then by the exact
  // dbo.Goals field name, so each message renders under its own cell.
  const [serverErrors, setServerErrors] = useState({});
  // Once a save is attempted, show every row's errors, not just the cells
  // the employee has edited.
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(null);
  const [removingKey, setRemovingKey] = useState(null);

  useEffect(() => {
    let ignore = false;

    const loadSheet = async () => {
      try {
        const response = await api.get("/goals/sheet");
        if (ignore) return;
        const data = response.data?.data || {};
        const drafts = data.goals || [];
        setGoalNumberStart(Number(data.goalNumberStart) || 1);
        if (Number.isFinite(Number(data.maxGoals))) {
          setMaxGoals(Number(data.maxGoals));
        }
        setRows(
          drafts.length > 0 ? drafts.map(createGoalRow) : [createGoalRow()],
        );
      } catch (err) {
        console.error("Failed to load draft goals", err);
        if (!ignore) {
          setSheetLoadError(
            "Unable to load your draft goals. Refresh and try again.",
          );
        }
      } finally {
        if (!ignore) setSheetLoading(false);
      }
    };

    loadSheet();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const loadJointAccountabilityUsers = async () => {
      try {
        const response = await api.get("/goals/joint-accountability-users");
        setJointAccountabilityUsers(response.data?.data || []);
      } catch (err) {
        console.error("Failed to load department users", err);
      } finally {
        setJointAccountabilityUsersLoading(false);
      }
    };

    loadJointAccountabilityUsers();
  }, []);

  const totalHundredths = rows.reduce(
    (total, row) => total + getWeightageHundredths(row.Weightage),
    0,
  );
  const isFullyAllocated = totalHundredths === FULL_ALLOCATION_HUNDREDTHS;
  const rowErrors = Object.fromEntries(
    rows.map((row) => [row.key, getRowErrors(row, currentQuarterRange)]),
  );
  const hasRowErrors = rows.some(
    (row) => Object.keys(rowErrors[row.key]).length > 0,
  );
  const revealAllErrors = attempted || isFullyAllocated;
  const canAddRow = rows.length < maxGoals && !sheetLoading;
  const sheetUnavailable = sheetLoading || Boolean(sheetLoadError);
  const canSubmit =
    !saving && !sheetUnavailable && isFullyAllocated && !hasRowErrors;

  // Server errors for a cell win; client errors show once the cell is
  // touched or a save is attempted.
  const getVisibleErrors = (row) => {
    const visible = {};
    Object.entries(rowErrors[row.key]).forEach(([field, message]) => {
      if (revealAllErrors || row.touched[field]) visible[field] = message;
    });
    Object.entries(serverErrors[row.key] || {}).forEach(([field, message]) => {
      if (message) visible[field] = message;
    });
    return visible;
  };

  const clearServerError = (key, field) =>
    setServerErrors((previous) => {
      if (!previous[key]?.[field]) return previous;
      const rowServerErrors = { ...previous[key] };
      delete rowServerErrors[field];
      return { ...previous, [key]: rowServerErrors };
    });

  const updateRow = (key, field, updater) => {
    setRows((previous) =>
      previous.map((row) =>
        row.key === key
          ? { ...updater(row), touched: { ...row.touched, [field]: true } }
          : row,
      ),
    );
    clearServerError(key, field);
    setSuccess("");
  };

  const addRow = () =>
    setRows((previous) =>
      previous.length >= maxGoals ? previous : [...previous, createGoalRow()],
    );

  const removeRow = async (row) => {
    if (row.GoalID) {
      if (!window.confirm("Remove this draft goal?")) return;

      setRemovingKey(row.key);
      setError("");
      setSuccess("");
      try {
        await api.delete(`/goals/${row.GoalID}`);
      } catch (err) {
        setError(
          err.response?.data?.message || "Unable to remove this draft goal.",
        );
        return;
      } finally {
        setRemovingKey(null);
      }
    }

    // Goal numbers follow row order, so the remaining rows renumber.
    setRows((previous) => {
      const remaining = previous.filter((current) => current.key !== row.key);
      return remaining.length > 0 ? remaining : [createGoalRow()];
    });
    setServerErrors((previous) => {
      const next = { ...previous };
      delete next[row.key];
      return next;
    });
  };

  const buildGoalPayload = (row) => {
    const selectedJointAccountabilities = [
      ...new Map(
        row.JointAccountabilities.filter(
          (accountability) => accountability.UserID,
        ).map((accountability) => [
          String(accountability.UserID),
          accountability,
        ]),
      ).values(),
    ];
    const jointAccountabilityNames = selectedJointAccountabilities
      .map((accountability) => {
        const employee = jointAccountabilityUsers.find(
          (candidate) =>
            String(candidate.UserID) === String(accountability.UserID),
        );
        return employee
          ? [employee.FirstName, employee.LastName].filter(Boolean).join(" ")
          : null;
      })
      .filter(Boolean)
      .join(", ");

    return {
      GoalID: row.GoalID,
      GoalTitle: row.GoalTitle.trim(),
      GoalCategory: row.GoalCategory,
      Priority: row.Priority,
      Weightage: Number(row.Weightage),
      StartDate: parseDateInput(row.StartDate),
      Timeline: parseDateInput(row.Timeline),
      GoalDescription: row.GoalDescription,
      Measurability: row.Measurability,
      MeetPerformance: row.MeetPerformance,
      ExceedPerformance: row.ExceedPerformance,
      ValidationSource: row.ValidationSource,
      CrossFunctionalGoal: row.CrossFunctionalGoal,
      JointAccountability: jointAccountabilityNames || null,
      SubGoals: getTitledSubGoals(row).map((subGoal) => ({
        SubGoalID: subGoal.SubGoalID,
        SubGoalTitle: subGoal.SubGoalTitle,
        Weightage: Number(subGoal.Weightage),
      })),
      JointAccountabilities: selectedJointAccountabilities.map(
        (accountability) => ({
          UserID: Number(accountability.UserID),
          ContributionNote: accountability.ContributionNote,
          Weightage:
            accountability.Weightage === "" ? null : accountability.Weightage,
        }),
      ),
    };
  };

  const saveSheet = async (status) => {
    setError("");
    setSuccess("");
    setAttempted(true);

    if (!goalCreationWindow.isOpen) {
      setError("The goal-entry window is closed.");
      return;
    }

    if (sheetUnavailable) {
      setError(sheetLoadError || "Your draft goals are still loading.");
      return;
    }

    if (hasRowErrors) {
      setError(
        "Some goals have errors. Fix the highlighted cells and try again.",
      );
      return;
    }

    if (status === "Submitted" && !isFullyAllocated) {
      setError(
        `Goals can be submitted only when they total exactly 100.00% (currently ${formatHundredths(totalHundredths)}%).`,
      );
      return;
    }

    const rowKeys = rows.map((row) => row.key);
    setSaving(status);

    try {
      const response = await api.put("/goals/sheet", {
        GoalStatus: status,
        Goals: rows.map(buildGoalPayload),
      });

      if (status === "Submitted") {
        navigate("/goals");
        return;
      }

      // New rows are now saved drafts; keep their GoalIDs so the next save
      // updates them instead of inserting again.
      const savedGoals = response.data?.data?.goals || [];
      setRows((previous) =>
        previous.map((row) => {
          const savedGoal = savedGoals[rowKeys.indexOf(row.key)];
          return savedGoal ? { ...row, GoalID: savedGoal.GoalID } : row;
        }),
      );
      setServerErrors({});
      setAttempted(false);
      setSuccess(response.data?.message || "Goals saved as draft.");
    } catch (err) {
      // Row errors come back as { errors: { rows: [ { Field: msg } | null ] } },
      // aligned with the Goals array that was sent.
      const data = err.response?.data;
      setError(
        data?.message ||
          "Server error while saving goals. No goals were saved.",
      );
      const serverRowErrors = data?.errors?.rows;
      if (Array.isArray(serverRowErrors)) {
        const errorsByKey = {};
        serverRowErrors.forEach((rowError, index) => {
          if (rowError && rowKeys[index])
            errorsByKey[rowKeys[index]] = rowError;
        });
        setServerErrors(errorsByKey);
      }
    } finally {
      setSaving(null);
    }
  };

  const submitHint = sheetUnavailable
    ? ""
    : !isFullyAllocated
      ? `Submit is available when the goals total exactly 100.00% (currently ${formatHundredths(totalHundredths)}%).`
      : hasRowErrors
        ? "Fix the highlighted cells to submit."
        : "";

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
              Quarterly goal entry
            </span>
          </div>

          <div className="px-3 pt-5 sm:px-8 sm:pt-7">
            <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
              <div>
                <span className="mb-2 inline-flex items-center gap-1.5 border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-[#2c3e82]">
                  NEW WORKSHEET
                </span>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Create goals
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Enter your {currentQuarterRange.quarter} goals in the
                  worksheet below, one row per goal.
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

            {success && (
              <div
                className="mb-6 border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
                role="status"
              >
                {success}
              </div>
            )}

            <div
              className={`mb-6 border p-4 text-sm font-medium ${
                goalCreationWindow.isOpen
                  ? "border-blue-200 bg-blue-50 text-[#2c3e82]"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
              role="status"
            >
              {goalCreationWindow.isOpen
                ? "The goal-entry window is open from "
                : "The goal-entry window is closed. It is open only for the first 7 calendar days of each quarter. This quarter's window ran from "}
              {goalCreationWindow.startDate.toLocaleDateString()} through{" "}
              {goalCreationWindow.endDate.toLocaleDateString()}.
            </div>

            <form
              hidden={!goalCreationWindow.isOpen}
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                saveSheet("Draft");
              }}
              className="flex flex-col gap-3.5"
            >
              <div className="-mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <span className="text-xs text-slate-500">
                  Enter each goal in its own row. Scroll horizontally to see all
                  columns.
                </span>
                <button
                  type="button"
                  onClick={addRow}
                  disabled={!canAddRow}
                  className="inline-flex cursor-pointer items-center gap-1.5 self-start border border-blue-200 bg-white px-3.5 py-2 text-sm font-semibold text-[#2c3e82] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
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
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  Add row
                </button>
              </div>
              <GoalWorksheet ariaLabel="Goal entry worksheet">
                {sheetLoading && (
                  <tr>
                    <td colSpan={15} className="px-3 py-4 text-slate-500">
                      Loading your draft goals...
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => (
                  <GoalSheetRow
                    key={row.key}
                    row={row}
                    rowNumber={index + 1}
                    goalNumber={goalNumberStart + index}
                    editableFields={GOAL_SHEET_FIELDS}
                    onChange={(field, updater) =>
                      updateRow(row.key, field, updater)
                    }
                    errors={getVisibleErrors(row)}
                    startDateRange={currentQuarterRange}
                    jointAccountabilityUsers={jointAccountabilityUsers}
                    jointAccountabilityUsersLoading={
                      jointAccountabilityUsersLoading
                    }
                    onRemove={() => removeRow(row)}
                    removing={removingKey === row.key}
                    removeDisabled={Boolean(saving)}
                  />
                ))}
              </GoalWorksheet>

              <div
                className="border border-[#cbd4e2] bg-blue-50/50 px-3 py-2.5 text-xs leading-relaxed text-[#2c3e82]"
                aria-live="polite"
              >
                {sheetLoadError ? (
                  <p className={worksheetErrorClass}>{sheetLoadError}</p>
                ) : (
                  <>
                    <strong>
                      Allocated {formatHundredths(totalHundredths)}% · Remaining{" "}
                      {formatHundredths(
                        FULL_ALLOCATION_HUNDREDTHS - totalHundredths,
                      )}
                      % · {rows.length}/{maxGoals} goals
                    </strong>
                    <span className="mt-1 block text-[11px] text-slate-600">
                      Drafts can be saved at any total. Goals are submitted
                      together once they total exactly 100.00%.
                    </span>
                  </>
                )}
              </div>

              {/* Action Buttons */}
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
                    disabled={Boolean(saving) || sheetUnavailable}
                    className="w-full cursor-pointer border border-blue-200 bg-white px-6 py-2.5 text-sm font-semibold text-[#2c3e82] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {saving === "Draft" ? "Saving..." : "Save as Draft"}
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => saveSheet("Submitted")}
                    className="w-full cursor-pointer bg-[#2c3e82] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2c61] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {saving === "Submitted" ? "Submitting..." : "Submit Goals"}
                  </button>
                </div>
                {submitHint && (
                  <p className="text-right text-xs text-slate-500">
                    {submitHint}
                  </p>
                )}
              </div>
            </form>
            <div
              className="-mx-3 mt-4.5 flex min-h-10.5 items-stretch gap-4.5 border-t border-[#d5dce5] bg-[#f4f6fa] px-3 sm:-mx-8 sm:px-6"
              aria-hidden="true"
            >
              <span className="flex items-center border-t-[3px] border-[#2c3e82] bg-white px-4.5 text-xs font-bold text-[#2c3e82]">
                Goal Entry
              </span>
              {/* <span className="self-center text-[11px] text-slate-500">Quarterly planning worksheet</span> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddGoal;
