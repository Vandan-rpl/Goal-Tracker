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

const MAX_GOALS_PER_QUARTER = 8;
const MIN_GOAL_WEIGHTAGE = 5;
const MAX_GOAL_WEIGHTAGE = 30;

const worksheetControlClass =
  "block w-full min-h-[42px] px-[10px] border border-transparent bg-transparent text-xs text-[#202522] shadow-none placeholder:text-[#9aa39b] read-only:bg-slate-50 read-only:text-slate-500 focus:relative focus:z-[1] focus:border-2 focus:border-[#2c3e82] focus:bg-white focus:outline-none";
const worksheetErrorClass = "m-0 px-[9px] pb-2 text-[10px] leading-[1.35] text-[#b3403f]";

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
    <div className="flex-1 min-h-screen overflow-y-auto bg-[#edf1f7] p-4 text-[#202522] [font-family:Segoe_UI,Arial,sans-serif] sm:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="overflow-hidden border border-[#c6cedc] bg-white shadow-[0_4px_18px_rgba(37,55,80,0.1)]">
          <div className="flex min-h-12 items-center gap-3 bg-[#2c3e82] px-3 py-2 text-xs font-bold tracking-[0.08em] text-white sm:px-[22px]">
            <div className="grid size-7 place-items-center border border-white/45" aria-hidden="true">
              <svg className="size-[18px] stroke-current stroke-[1.5]" viewBox="0 0 24 24" fill="none">
                <path d="M4 3.5h16v17H4z" />
                <path d="M4 8.5h16M4 14h16M10 3.5v17M15 3.5v17" />
              </svg>
            </div>
            <span>GOAL WORKBOOK</span>
            <span className="h-5 w-px bg-white/40" aria-hidden="true" />
            <span className="text-[13px] font-normal tracking-normal">Quarterly goal entry</span>
          </div>

          <div className="px-3 pt-5 sm:px-8 sm:pt-7">
          <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-center">
            <div>
              <span className="mb-2 inline-flex items-center gap-1.5 border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-[#2c3e82]">
                NEW WORKSHEET
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Create a goal
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Enter your goal details in the worksheet below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/goals")}
              className="inline-flex cursor-pointer items-center gap-1.5 self-start text-sm font-medium text-slate-600 transition-colors hover:text-[#2c3e82] sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Back to Goals
            </button>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span>{error}</span>
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
            onSubmit={(e) => handleSubmit(e, "Draft")}
            className="flex flex-col gap-3.5"
          >
            <div className="mb-[-8px] text-xs text-slate-500">
              Enter the goal details in the cells. Scroll horizontally to see all columns.
            </div>
            <div className="max-w-full overflow-x-auto border border-[#aeb9cc] bg-white [scrollbar-color:#aeb9cc_#edf1f7] [scrollbar-width:thin] focus-visible:outline-2 focus-visible:outline-[#2c3e82] focus-visible:outline-offset-2" role="region" aria-label="Goal entry worksheet" tabIndex="0">
              <table className="w-full min-w-[1992px] table-fixed border-separate border-spacing-0 text-xs text-[#202522] [&_td]:h-[168px] [&_td]:border-r [&_td]:border-b [&_td]:border-[#d5dce5] [&_td]:bg-white [&_td]:p-0 [&_td]:align-top [&_td:last-child]:border-r-0">
                <colgroup>
                  <col className="w-[42px]" />
                  <col className="w-[90px]" />
                  <col className="w-[230px]" />
                  <col className="w-[150px]" />
                  <col className="w-[125px]" />
                  <col className="w-[125px]" />
                  <col className="w-[165px]" />
                  <col className="w-[165px]" />
                  <col className="w-[220px]" />
                  <col className="w-[220px]" />
                  <col className="w-[230px]" />
                  <col className="w-[230px]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-[3] h-[26px] border-r border-b border-[#d5dce5] bg-[#edf1f7] text-center text-[11px] font-medium text-slate-600" aria-label="Row number" />
                    {["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].map((letter) => (
                      <th className="sticky top-0 z-[2] h-[26px] border-r border-b border-[#d5dce5] bg-[#edf1f7] text-center text-[11px] font-medium text-slate-600" key={letter}>{letter}</th>
                    ))}
                  </tr>
                  <tr>
                    <th className="sticky left-0 top-[26px] z-[4] border-r border-b border-[#d5dce5] bg-[#e5eaf3] px-2.5 py-2 text-center text-[11px] font-bold text-[#30415f]" aria-label="Row number">#</th>
                    {["Goal No.", "Goal Title", "Category", "Priority", "Weightage (%)", "Start Date", "End Date", "Goal Description", "Measurability", "Meet Performance Target", "Exceed Performance Target"].map((heading, index) => (
                      <th className="sticky top-[26px] z-[2] h-[42px] border-r border-b border-[#cbd4e2] bg-[#dce5f2] px-2.5 py-2 text-left text-[11px] font-bold leading-[1.35] text-[#30415f] align-middle" key={heading}>
                        {heading}{[0, 1, 3, 4, 5, 6].includes(index) && <span className="text-red-600"> *</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th className="sticky left-0 z-[1] border-r border-b border-[#d5dce5] bg-[#edf1f7] pt-3 text-center font-medium text-slate-600" scope="row">1</th>
                    <td>
                      <input className={worksheetControlClass} aria-label="Goal number" type="number" name="GoalNumber" required value={formData.GoalNumber} readOnly />
                    </td>
                    <td>
                      <input className={worksheetControlClass} aria-label="Goal title" type="text" name="GoalTitle" required placeholder="Enter goal title" value={formData.GoalTitle} onChange={handleChange} />
                      {fieldErrors.GoalTitle && <p className={worksheetErrorClass}>{fieldErrors.GoalTitle}</p>}
                    </td>
                    <td>
                      <input className={worksheetControlClass} aria-label="Category" type="text" name="GoalCategory" placeholder="Category" value={formData.GoalCategory} onChange={handleChange} />
                      {fieldErrors.GoalCategory && <p className={worksheetErrorClass}>{fieldErrors.GoalCategory}</p>}
                    </td>
                    <td>
                      <select className={worksheetControlClass} aria-label="Priority" name="Priority" value={formData.Priority} onChange={handleChange}>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                      </select>
                    </td>
                    <td>
                      <input className={worksheetControlClass} aria-label="Weightage percentage" type="number" min={MIN_GOAL_WEIGHTAGE} max={MAX_GOAL_WEIGHTAGE} step="0.01" name="Weightage" required placeholder="5 - 30" value={formData.Weightage} onChange={handleChange} />
                      {fieldErrors.Weightage && <p className={worksheetErrorClass}>{fieldErrors.Weightage}</p>}
                    </td>
                    <td>
                      <div className="relative">
                        <input className={`${worksheetControlClass} pr-[34px]`} aria-label="Start date (DD/MM/YYYY)" type="text" name="StartDate" required maxLength={10} placeholder="DD/MM/YYYY" value={formData.StartDate} onChange={handleChange} />
                        <span className="absolute right-[9px] top-3 grid size-[18px] place-items-center text-slate-500">
                          <CalendarDays size={16} aria-hidden="true" />
                          <input className="absolute inset-0 size-full cursor-pointer opacity-0" type="date" aria-label="Choose Start Date from calendar" title="Choose Start Date from calendar" name="StartDate" min={currentQuarterRange.min} max={currentQuarterRange.max} value={parseDateInput(formData.StartDate)} onChange={handleDatePickerChange} />
                        </span>
                      </div>
                      {fieldErrors.StartDate ? <p className={worksheetErrorClass}>{fieldErrors.StartDate}</p> : <p className="m-0 px-[9px] pb-2 text-[10px] leading-[1.35] text-slate-500">Within {currentQuarterRange.quarter}</p>}
                    </td>
                    <td>
                      <div className="relative">
                        <input className={`${worksheetControlClass} pr-[34px]`} aria-label="End date (DD/MM/YYYY)" type="text" name="Timeline" required maxLength={10} placeholder="DD/MM/YYYY" value={formData.Timeline} onChange={handleChange} />
                        <span className="absolute right-[9px] top-3 grid size-[18px] place-items-center text-slate-500">
                          <CalendarDays size={16} aria-hidden="true" />
                          <input className="absolute inset-0 size-full cursor-pointer opacity-0" type="date" aria-label="Choose End Date from calendar" title="Choose End Date from calendar" name="Timeline" min={parseDateInput(formData.StartDate) || currentQuarterRange.min} value={parseDateInput(formData.Timeline)} onChange={handleDatePickerChange} />
                        </span>
                      </div>
                      {fieldErrors.Timeline ? <p className={worksheetErrorClass}>{fieldErrors.Timeline}</p> : <p className="m-0 px-[9px] pb-2 text-[10px] leading-[1.35] text-slate-500">DD/MM/YYYY</p>}
                    </td>
                    <td>
                      <textarea className={`${worksheetControlClass} min-h-[126px] resize-y`} aria-label="Goal description" name="GoalDescription" rows="4" value={formData.GoalDescription} onChange={handleChange} />
                      {fieldErrors.GoalDescription && <p className={worksheetErrorClass}>{fieldErrors.GoalDescription}</p>}
                    </td>
                    <td>
                      <textarea className={`${worksheetControlClass} min-h-[126px] resize-y`} aria-label="Measurability" name="Measurability" rows="4" placeholder="Source of validation" value={formData.Measurability} onChange={handleChange} />
                      {fieldErrors.Measurability && <p className={worksheetErrorClass}>{fieldErrors.Measurability}</p>}
                    </td>
                    <td>
                      <textarea className={`${worksheetControlClass} min-h-[126px] resize-y`} aria-label="Meet performance target" name="MeetPerformance" rows="4" placeholder="Expected target" value={formData.MeetPerformance} onChange={handleChange} />
                      {fieldErrors.MeetPerformance && <p className={worksheetErrorClass}>{fieldErrors.MeetPerformance}</p>}
                    </td>
                    <td>
                      <textarea className={`${worksheetControlClass} min-h-[126px] resize-y`} aria-label="Exceed performance target" name="ExceedPerformance" rows="4" placeholder="Exceed target" value={formData.ExceedPerformance} onChange={handleChange} />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="border border-[#cbd4e2] bg-blue-50/50 px-3 py-2.5 text-xs leading-relaxed text-[#2c3e82]">
              {goalAllocationLoading ? (
                <p>Loading current goal allocations...</p>
              ) : goalAllocationError ? (
                <p className={worksheetErrorClass}>{goalAllocationError}</p>
              ) : selectedQuarter ? (
                <>
                  <strong>{selectedQuarter} allocation:</strong>{" "}
                  {(allocatedWeightageHundredths / 100).toFixed(2)}% used,{" "}
                  {(remainingWeightageHundredths / 100).toFixed(2)}% remaining.
                  <span className="mt-1 block text-[11px] text-slate-600">
                    {selectedQuarterGoals.length} of {MAX_GOALS_PER_QUARTER} goals added; up to{" "}
                    {additionalGoalsAvailable} more can fit. Drafts can be saved while allocating; submitted goals must total 100%.
                  </span>
                </>
              ) : (
                <p>Enter a start date to see the quarter's remaining goal slots and weightage.</p>
              )}
            </div>

            {/* Joint Accountability Section */}
            <section className="overflow-hidden border border-[#cbd4e2] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#cbd4e2] bg-[#eaf0f8] px-3.5 py-3 max-sm:flex-col max-sm:items-start">
                <div>
                  <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#30415f]">
                    Joint Accountability
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Add colleagues sharing responsibility for this goal
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addJointAccountabilityRow}
                  className="inline-flex cursor-pointer items-center gap-1.5 border border-blue-200 bg-white px-3.5 py-2 text-sm font-semibold text-[#2c3e82] transition hover:bg-blue-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Joint Employee
                </button>
              </div>

              <div className="flex flex-col gap-2 p-3">
                {jointAccountabilities.map((ja, index) => (
                  <div
                    key={index}
                    className="relative space-y-3 border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wide text-[#2c3e82]">
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
                        className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm focus:border-[#2c3e82] focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                        className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[#2c3e82] focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                        className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[#2c3e82] focus:outline-none focus:ring-2 focus:ring-blue-200"
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
            <section className="overflow-hidden border border-[#cbd4e2] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#cbd4e2] bg-[#eaf0f8] px-3.5 py-3 max-sm:flex-col max-sm:items-start">
                <div>
                  <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#30415f]">
                    Sub-Goals
                  </h3>
                  <p className="mt-1 text-[11px] text-slate-600">
                    Optional: add up to {MAX_SUB_GOALS} sub-goals. Their weightages are a % of this goal and must total 100%.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSubGoalRow}
                  disabled={subGoals.length >= MAX_SUB_GOALS}
                  className="inline-flex cursor-pointer items-center gap-1.5 border border-blue-200 bg-white px-3.5 py-2 text-sm font-semibold text-[#2c3e82] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Sub-Goal ({subGoals.length}/{MAX_SUB_GOALS})
                </button>
              </div>

              <div className="flex flex-col gap-2 p-3">
                {subGoals.length === 0 && (
                  <p className="text-sm text-slate-500">No sub-goals added.</p>
                )}
                {subGoals.length > 0 && (
                  <div className="border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-[#2c3e82]">
                    <p className="font-semibold">
                      Allocated {subGoalWeightage.allocated.toFixed(2)}% · Remaining{" "}
                      {subGoalWeightage.remaining.toFixed(2)}%
                    </p>
                  </div>
                )}
                {subGoals.map((sub, index) => (
                  <div
                    key={index}
                    className="relative space-y-3 border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase tracking-wide text-[#2c3e82]">
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
                        className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[#2c3e82] focus:outline-none focus:ring-2 focus:ring-blue-200 sm:col-span-2"
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
                        className="w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-[#2c3e82] focus:outline-none focus:ring-2 focus:ring-blue-200"
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
            <div className="flex flex-col-reverse items-center justify-end gap-3 border-t border-slate-200 pt-6 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/goals")}
                className="w-full cursor-pointer border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full cursor-pointer border border-blue-200 bg-white px-6 py-2.5 text-sm font-semibold text-[#2c3e82] transition hover:bg-blue-50 disabled:opacity-50 sm:w-auto"
              >
                {loading ? "Saving..." : "Save as Draft"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, "Submitted")}
                className="w-full cursor-pointer bg-[#2c3e82] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2c61] disabled:opacity-50 sm:w-auto"
              >
                Submit Goal
              </button>
            </div>
          </form>
          <div className="-mx-3 mt-[18px] flex min-h-[42px] items-stretch gap-[18px] border-t border-[#d5dce5] bg-[#f4f6fa] px-3 sm:-mx-8 sm:px-6" aria-hidden="true">
            <span className="flex items-center border-t-[3px] border-[#2c3e82] bg-white px-[18px] text-xs font-bold text-[#2c3e82]">Goal Entry</span>
            <span className="self-center text-[11px] text-slate-500">Quarterly planning worksheet</span>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddGoal;
