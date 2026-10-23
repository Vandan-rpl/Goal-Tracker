import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import api from "../../services/api";
import {
  getNextFiscalQuarterDateRange,
  getFiscalQuarterValue,
  getGoalCreationWindow,
} from "../../utils/fiscalQuarter";
import {
  MAX_SUB_GOALS,
  getSubGoalError,
  getSubGoalWeightageSummary,
} from "../../utils/subGoals";
import "./AddGoal.css";

const MAX_GOALS_PER_QUARTER = 8;
const MIN_GOAL_WEIGHTAGE = 5;
const MAX_GOAL_WEIGHTAGE = 30;

const isQuarterGoalActive = (goal) =>
  !["Rejected", "Cancelled"].includes(goal.GoalStatus);

const getWeightageHundredths = (weightage) =>
  Math.round(Number(weightage || 0) * 100);

const parseDateInput = (value) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return "";

  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return "";
  }

  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (value) =>
  value ? value.split("-").reverse().join("/") : "";

const AddGoal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const goalCreationWindow = getGoalCreationWindow();
  const currentQuarterRange = getNextFiscalQuarterDateRange();
  const [goals, setGoals] = useState([]);
  const [goalAllocationLoading, setGoalAllocationLoading] = useState(true);
  const [goalAllocationError, setGoalAllocationError] = useState("");

  const [jointAccountabilities, setJointAccountabilities] = useState([
    { UserID: "", ContributionNote: "", Weightage: "" },
  ]);

  const addJointAccountabilityRow = () =>
    setJointAccountabilities((previous) => [
      ...previous,
      { UserID: "", ContributionNote: "", Weightage: "" },
    ]);

  const removeJointAccountabilityRow = (index) =>
    setJointAccountabilities((previous) =>
      previous.filter((_, i) => i !== index),
    );

  const handleJointAccountabilityChange = (index, e) => {
    const { name, value } = e.target;
    setJointAccountabilities((previous) =>
      previous.map((accountability, currentIndex) =>
        currentIndex === index
          ? { ...accountability, [name]: value }
          : accountability,
      ),
    );
  };

  const [formData, setFormData] = useState({
    GoalNumber: 1,
    GoalTitle: "",
    GoalDescription: "",
    Measurability: "",
    JointAccountability: "",
    Weightage: "",
    Priority: "Medium",
    StartDate: "",
    Timeline: "",
    MeetPerformance: "",
    ExceedPerformance: "",
    ValidationSource: "",
    CrossFunctionalGoal: false,
    GoalCategory: "",
  });

  // Optional sub-goals (0-5): title + weightage (% of this goal). They always
  // start Pending; status is ticked from the goal page after approval.
  const [subGoals, setSubGoals] = useState([]);

  const [error, setError] = useState("");
  const [jointAccountabilityUsers, setJointAccountabilityUsers] = useState([]);
  const [jointAccountabilityUsersLoading, setJointAccountabilityUsersLoading] =
    useState(true);
  // Field-level SMART validation errors from the backend (400 response
  // shape: { success:false, message, errors: { FieldName: "message" } }).
  // Keyed by the exact dbo.Goals field name so we can render each message
  // right next to the input it's about.
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadNextGoalNumber = async () => {
      try {
        const response = await api.get("/goals");
        const goals = response.data?.data || [];
        setGoals(goals);
        const highestGoalNumber = goals.reduce(
          (highest, goal) => Math.max(highest, Number(goal.GoalNumber) || 0),
          0,
        );

        setFormData((previous) => ({
          ...previous,
          GoalNumber: highestGoalNumber + 1,
        }));
      } catch (err) {
        console.error("Failed to determine next goal number", err);
        setGoalAllocationError(
          "Unable to load current goal allocations. Refresh and try again.",
        );
      } finally {
        setGoalAllocationLoading(false);
      }
    };

    loadNextGoalNumber();
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

  const clearFieldError = (name) => {
    // Clear that field's error the moment the employee edits it, rather
    // than making them re-submit to see it disappear.
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    clearFieldError(name);
  };

  const handleDatePickerChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: formatDateForDisplay(value),
    }));
    clearFieldError(name);
  };

  const handleSubGoalChange = (index, e) => {
    const { name, value } = e.target;
    const updated = [...subGoals];
    updated[index][name] = value;
    setSubGoals(updated);
    clearFieldError("SubGoals");
  };

  const addSubGoalRow = () => {
    setSubGoals((prev) =>
      prev.length >= MAX_SUB_GOALS
        ? prev
        : [
            ...prev,
            {
              SubGoalNo: prev.length + 1,
              SubGoalTitle: "",
              Weightage: "",
            },
          ],
    );
  };

  const removeSubGoalRow = (index) => {
    setSubGoals((prev) => prev.filter((_, i) => i !== index));
  };

  const subGoalWeightage = getSubGoalWeightageSummary(subGoals);

  const selectedQuarter = getFiscalQuarterValue(
    parseDateInput(formData.StartDate),
  );
  const selectedQuarterGoals = goals.filter(
    (goal) =>
      goal.Quarter === selectedQuarter && isQuarterGoalActive(goal),
  );
  const allocatedWeightageHundredths = selectedQuarterGoals.reduce(
    (total, goal) => total + getWeightageHundredths(goal.Weightage),
    0,
  );
  const remainingWeightageHundredths = Math.max(
    0,
    10000 - allocatedWeightageHundredths,
  );
  const remainingGoalSlots = Math.max(
    0,
    MAX_GOALS_PER_QUARTER - selectedQuarterGoals.length,
  );
  const additionalGoalsByWeightage = Math.floor(
    remainingWeightageHundredths / (MIN_GOAL_WEIGHTAGE * 100),
  );
  const additionalGoalsAvailable = Math.min(
    remainingGoalSlots,
    additionalGoalsByWeightage,
  );

  const handleSubmit = async (e, status = "Draft") => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!goalCreationWindow.isOpen) {
      setError(
        "Goal creation is available only during the first 7 days of each quarter.",
      );
      return;
    }

    if (goalAllocationLoading || goalAllocationError) {
      setError(
        goalAllocationError ||
          "Current goal allocations are still loading. Please try again.",
      );
      return;
    }

    const goalWeightage = Number(formData.Weightage);
    if (
      !Number.isFinite(goalWeightage) ||
      goalWeightage < MIN_GOAL_WEIGHTAGE ||
      goalWeightage > MAX_GOAL_WEIGHTAGE ||
      Math.abs(goalWeightage * 100 - Math.round(goalWeightage * 100)) > 1e-8
    ) {
      const message = `Each goal must have a weightage from ${MIN_GOAL_WEIGHTAGE}% to ${MAX_GOAL_WEIGHTAGE}%, with no more than two decimal places.`;
      setError(message);
      setFieldErrors({ Weightage: message });
      return;
    }

    if (remainingGoalSlots === 0) {
      const message = `A maximum of ${MAX_GOALS_PER_QUARTER} goals can be added per quarter.`;
      setError(message);
      setFieldErrors({ GoalCount: message });
      return;
    }

    // TODO: re-enable after testing
    // if (getWeightageHundredths(goalWeightage) > remainingWeightageHundredths) {
    //   const message = `Quarterly goal weightage cannot exceed 100%. There is ${(remainingWeightageHundredths / 100).toFixed(2)}% remaining.`;
    //   setError(message);
    //   setFieldErrors({ Weightage: message });
    //   return;
    // }

    const startDate = parseDateInput(formData.StartDate);
    const endDate = parseDateInput(formData.Timeline);

    if (
      !startDate ||
      startDate < currentQuarterRange.min ||
      startDate > currentQuarterRange.max
    ) {
      const message = `Enter a valid Start Date as DD/MM/YYYY within ${currentQuarterRange.quarter} (${formatDateForDisplay(currentQuarterRange.min)} to ${formatDateForDisplay(currentQuarterRange.max)}).`;
      setError(message);
      setFieldErrors({ StartDate: message });
      return;
    }

    if (!endDate || endDate < startDate) {
      const message = "Enter a valid End Date as DD/MM/YYYY on or after Start Date.";
      setError(message);
      setFieldErrors({ Timeline: message });
      return;
    }

    const titledSubGoals = subGoals.filter((sub) => sub.SubGoalTitle.trim());
    const subGoalError = getSubGoalError(titledSubGoals);
    if (subGoalError) {
      setError(subGoalError);
      setFieldErrors({ SubGoals: subGoalError });
      return;
    }

    setLoading(true);

    try {
      const selectedJointAccountabilities = [
        ...new Map(
          jointAccountabilities
            .filter((accountability) => accountability.UserID)
            .map((accountability) => [
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

      const payload = {
        ...formData,
        StartDate: startDate,
        Timeline: endDate,
        JointAccountability: jointAccountabilityNames || null,
        UserID: user?.userId || user?.UserID,
        GoalStatus: status,
        SubGoals: titledSubGoals.map((sub) => ({
          SubGoalNo: sub.SubGoalNo,
          SubGoalTitle: sub.SubGoalTitle,
          Weightage: Number(sub.Weightage),
        })),
        JointAccountabilities: selectedJointAccountabilities,
      };

      const response = await api.post("/goals", payload);
      if (response.data.success) {
        navigate("/goals");
      } else {
        setError(response.data.message || "Failed to save goal.");
        if (response.data.errors) {
          setFieldErrors(response.data.errors);
        }
      }
    } catch (err) {
      // SMART validation failures come back as a 400 with this exact
      // shape: { success:false, message, errors: { Field: "message" } }.
      const data = err.response?.data;
      setError(data?.message || "Server error while saving goal.");
      if (data?.errors) {
        setFieldErrors(data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

return (
    <div className="goal-workspace flex-1 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="goal-workbook">
          <div className="goal-appbar">
            <div className="goal-app-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M4 3.5h16v17H4z" />
                <path d="M4 8.5h16M4 14h16M10 3.5v17M15 3.5v17" />
              </svg>
            </div>
            <span>GOAL WORKBOOK</span>
            <span className="goal-appbar-divider" aria-hidden="true" />
            <span className="goal-appbar-document">Quarterly goal entry</span>
          </div>

          <div className="goal-workbook-content">
          <div className="goal-workbook-heading flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-6 border-b border-slate-100 mb-8">
            <div>
              <span className="goal-worksheet-badge inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 mb-2">
                NEW WORKSHEET
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Create a goal
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Enter your goal details in the worksheet below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/goals")}
              className="goal-back-button inline-flex items-center gap-1.5 text-sm font-medium cursor-pointer transition-colors self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Back to Goals
            </button>
          </div>

          {error && (
            <div className="goal-form-error mb-6 flex items-start gap-3 p-4 text-sm font-medium">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div
            className={`goal-window-notice mb-6 border p-4 text-sm font-medium ${
              goalCreationWindow.isOpen
                ? "goal-window-open"
                : "goal-window-closed"
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
            onSubmit={(e) => handleSubmit(e, "Draft")}
            className="goal-sheet-form"
          >
            <div className="goal-worksheet-help">
              Enter the goal details in the cells. Scroll horizontally to see all columns.
            </div>
            <div className="goal-grid-scroll" role="region" aria-label="Goal entry worksheet" tabIndex="0">
              <table className="goal-entry-grid">
                <colgroup>
                  <col className="goal-row-number-column" />
                  <col className="goal-number-column" />
                  <col className="goal-title-column" />
                  <col className="goal-category-column" />
                  <col className="goal-priority-column" />
                  <col className="goal-weightage-column" />
                  <col className="goal-date-column" />
                  <col className="goal-date-column" />
                  <col className="goal-description-column" />
                  <col className="goal-measurability-column" />
                  <col className="goal-performance-column" />
                  <col className="goal-performance-column" />
                </colgroup>
                <thead>
                  <tr className="goal-grid-letters">
                    <th aria-label="Row number" />
                    {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].map((letter) => (
                      <th key={letter}>{letter}</th>
                    ))}
                  </tr>
                  <tr className="goal-grid-headings">
                    <th aria-label="Row number">#</th>
                    <th>Goal No.</th>
                    <th>Goal Title <span>*</span></th>
                    <th>Category</th>
                    <th>Priority <span>*</span></th>
                    <th>Weightage (%) <span>*</span></th>
                    <th>Start Date <span>*</span></th>
                    <th>End Date <span>*</span></th>
                    <th>Goal Description</th>
                    <th>Measurability</th>
                    <th>Meet Performance Target</th>
                    <th>Exceed Performance Target</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th className="goal-grid-row-number" scope="row">1</th>
                    <td>
                      <input aria-label="Goal number" type="number" name="GoalNumber" required value={formData.GoalNumber} readOnly />
                    </td>
                    <td>
                      <input aria-label="Goal title" type="text" name="GoalTitle" required placeholder="Enter goal title" value={formData.GoalTitle} onChange={handleChange} />
                      {fieldErrors.GoalTitle && <p className="goal-cell-error">{fieldErrors.GoalTitle}</p>}
                    </td>
                    <td>
                      <input aria-label="Category" type="text" name="GoalCategory" placeholder="Category" value={formData.GoalCategory} onChange={handleChange} />
                      {fieldErrors.GoalCategory && <p className="goal-cell-error">{fieldErrors.GoalCategory}</p>}
                    </td>
                    <td>
                      <select aria-label="Priority" name="Priority" value={formData.Priority} onChange={handleChange}>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </td>
                    <td>
                      <input aria-label="Weightage percentage" type="number" min={MIN_GOAL_WEIGHTAGE} max={MAX_GOAL_WEIGHTAGE} step="0.01" name="Weightage" required placeholder="5 - 30" value={formData.Weightage} onChange={handleChange} />
                      {fieldErrors.Weightage && <p className="goal-cell-error">{fieldErrors.Weightage}</p>}
                    </td>
                    <td>
                      <div className="goal-grid-date">
                        <input aria-label="Start date (DD/MM/YYYY)" type="text" name="StartDate" required maxLength={10} placeholder="DD/MM/YYYY" value={formData.StartDate} onChange={handleChange} />
                        <span className="goal-grid-calendar">
                          <CalendarDays size={16} aria-hidden="true" />
                          <input type="date" aria-label="Choose Start Date from calendar" title="Choose Start Date from calendar" name="StartDate" min={currentQuarterRange.min} max={currentQuarterRange.max} value={parseDateInput(formData.StartDate)} onChange={handleDatePickerChange} />
                        </span>
                      </div>
                      {fieldErrors.StartDate ? <p className="goal-cell-error">{fieldErrors.StartDate}</p> : <p className="goal-cell-hint">Within {currentQuarterRange.quarter}</p>}
                    </td>
                    <td>
                      <div className="goal-grid-date">
                        <input aria-label="End date (DD/MM/YYYY)" type="text" name="Timeline" required maxLength={10} placeholder="DD/MM/YYYY" value={formData.Timeline} onChange={handleChange} />
                        <span className="goal-grid-calendar">
                          <CalendarDays size={16} aria-hidden="true" />
                          <input type="date" aria-label="Choose End Date from calendar" title="Choose End Date from calendar" name="Timeline" min={parseDateInput(formData.StartDate) || currentQuarterRange.min} value={parseDateInput(formData.Timeline)} onChange={handleDatePickerChange} />
                        </span>
                      </div>
                      {fieldErrors.Timeline ? <p className="goal-cell-error">{fieldErrors.Timeline}</p> : <p className="goal-cell-hint">DD/MM/YYYY</p>}
                    </td>
                    <td>
                      <textarea aria-label="Goal description" name="GoalDescription" rows="4" value={formData.GoalDescription} onChange={handleChange} />
                      {fieldErrors.GoalDescription && <p className="goal-cell-error">{fieldErrors.GoalDescription}</p>}
                    </td>
                    <td>
                      <textarea aria-label="Measurability" name="Measurability" rows="4" placeholder="Source of validation" value={formData.Measurability} onChange={handleChange} />
                      {fieldErrors.Measurability && <p className="goal-cell-error">{fieldErrors.Measurability}</p>}
                    </td>
                    <td>
                      <textarea aria-label="Meet performance target" name="MeetPerformance" rows="4" placeholder="Expected target" value={formData.MeetPerformance} onChange={handleChange} />
                      {fieldErrors.MeetPerformance && <p className="goal-cell-error">{fieldErrors.MeetPerformance}</p>}
                    </td>
                    <td>
                      <textarea aria-label="Exceed performance target" name="ExceedPerformance" rows="4" placeholder="Exceed target" value={formData.ExceedPerformance} onChange={handleChange} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="goal-allocation-summary">
              {goalAllocationLoading ? (
                <p>Loading current goal allocations...</p>
              ) : goalAllocationError ? (
                <p className="goal-cell-error">{goalAllocationError}</p>
              ) : selectedQuarter ? (
                <>
                  <strong>{selectedQuarter} allocation:</strong>{" "}
                  {(allocatedWeightageHundredths / 100).toFixed(2)}% used,{" "}
                  {(remainingWeightageHundredths / 100).toFixed(2)}% remaining.
                  <span>
                    {selectedQuarterGoals.length} of {MAX_GOALS_PER_QUARTER} goals added; up to{" "}
                    {additionalGoalsAvailable} more can fit. Drafts can be saved while allocating; submitted goals must total 100%.
                  </span>
                </>
              ) : (
                <p>Enter a start date to see the quarter's remaining goal slots and weightage.</p>
              )}
            </div>

            {/* Joint Accountability Section */}
            <section>
              <div className="goal-section-toolbar flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Joint Accountability
                  </h3>
                  <p className="text-xs text-slate-400">
                    Add colleagues sharing responsibility for this goal
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addJointAccountabilityRow}
                  className="goal-sheet-add-button inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold transition cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Joint Employee
                </button>
              </div>

              <div className="goal-sheet-rows space-y-3">
                {jointAccountabilities.map((ja, index) => (
                  <div
                    key={index}
                    className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 relative space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                        Joint Employee #{index + 1}
                      </span>
                      {jointAccountabilities.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeJointAccountabilityRow(index)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select
                        name="UserID"
                        value={ja.UserID}
                        onChange={(e) =>
                          handleJointAccountabilityChange(index, e)
                        }
                        disabled={jointAccountabilityUsersLoading}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      >
                        <option value="">
                          {jointAccountabilityUsersLoading
                            ? "Loading employees..."
                            : "Select employee"}
                        </option>
                        {jointAccountabilityUsers.map((employee) => (
                          <option key={employee.UserID} value={employee.UserID}>
                            {[employee.FirstName, employee.LastName]
                              .filter(Boolean)
                              .join(" ")}
                            {employee.Designation
                              ? ` - ${employee.Designation}`
                              : ""}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        name="ContributionNote"
                        placeholder="What are they responsible for?"
                        value={ja.ContributionNote}
                        onChange={(e) =>
                          handleJointAccountabilityChange(index, e)
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-400"
                      />
                      <input
                        type="number"
                        step="0.01"
                        name="Weightage"
                        placeholder="Weightage (%) - optional"
                        value={ja.Weightage}
                        onChange={(e) =>
                          handleJointAccountabilityChange(index, e)
                        }
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* <div className="flex items-center space-x-2 pt-2">
              <input
                type="checkbox"
                name="CrossFunctionalGoal"
                id="CrossFunctionalGoal"
                checked={formData.CrossFunctionalGoal}
                onChange={handleChange}
                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
              />
              <label
                htmlFor="CrossFunctionalGoal"
                className="text-sm font-medium text-gray-700"
              >
                Is this a Cross-Functional Goal?
              </label>
            </div> */}

            {/* Sub-Goals Section */}
            <section className="border-t border-slate-100 pt-6">
              <div className="goal-section-toolbar flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Sub-Goals
                  </h3>
                  <p className="text-xs text-slate-400">
                    Optional: add up to {MAX_SUB_GOALS} sub-goals. Their weightages are a % of this goal and must total 100%.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSubGoalRow}
                  disabled={subGoals.length >= MAX_SUB_GOALS}
                  className="goal-sheet-add-button inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Sub-Goal ({subGoals.length}/{MAX_SUB_GOALS})
                </button>
              </div>

              <div className="goal-sheet-rows space-y-3">
                {subGoals.length === 0 && (
                  <p className="text-sm text-slate-400">No sub-goals added.</p>
                )}
                {subGoals.length > 0 && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
                    <p className="font-semibold">
                      Allocated {subGoalWeightage.allocated.toFixed(2)}% · Remaining{" "}
                      {subGoalWeightage.remaining.toFixed(2)}%
                    </p>
                  </div>
                )}
                {subGoals.map((sub, index) => (
                  <div
                    key={index}
                    className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 relative space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                        Sub-Goal #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSubGoalRow(index)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        name="SubGoalTitle"
                        placeholder="Sub-Goal Title *"
                        required
                        value={sub.SubGoalTitle}
                        onChange={(e) => handleSubGoalChange(index, e)}
                        className="sm:col-span-2 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-400"
                      />
                      <input
                        type="number"
                        name="Weightage"
                        placeholder="Weightage % *"
                        aria-label={`Sub-Goal #${index + 1} weightage (% of this goal)`}
                        required
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={sub.Weightage}
                        onChange={(e) => handleSubGoalChange(index, e)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
              {fieldErrors.SubGoals && (
                <p className="text-red-600 text-xs mt-2 font-medium" role="alert">
                  {fieldErrors.SubGoals}
                </p>
              )}
            </section>

            {/* Action Buttons */}
            <div className="goal-form-actions flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate("/goals")}
                className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 font-medium text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-6 py-2.5 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl font-semibold text-sm shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Saving..." : "Save as Draft"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, "Submitted")}
                className="w-full sm:w-auto px-6 py-2.5 bg-linear-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
              >
                Submit Goal
              </button>
            </div>
          </form>
          <div className="goal-sheet-tabs" aria-hidden="true">
            <span className="goal-sheet-tab">Goal Entry</span>
            <span className="goal-sheet-tab-hint">Quarterly planning worksheet</span>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddGoal;
