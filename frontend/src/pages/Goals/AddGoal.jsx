import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import api from "../../services/api";
import {
  getFiscalQuarterDateRange,
  getFiscalQuarterValue,
  getGoalCreationWindow,
} from "../../utils/fiscalQuarter";

const MAX_SUB_GOALS = 5;
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
  const currentQuarterRange = getFiscalQuarterDateRange();
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

  // Optional sub-goals (0-5): title + status only.
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
              Status: "Pending",
            },
          ],
    );
  };

  const removeSubGoalRow = (index) => {
    setSubGoals((prev) => prev.filter((_, i) => i !== index));
  };

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
    if (titledSubGoals.length > MAX_SUB_GOALS) {
      const message = `A goal can have no more than ${MAX_SUB_GOALS} sub-goals.`;
      setError(message);
      setFieldErrors({ SubGoals: message });
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
        SubGoals: titledSubGoals,
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
    <div className="flex-1 bg-linear-to-br from-slate-50 via-white to-indigo-50/40 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-[1600px] mx-auto">
        <div className="bg-white/90 backdrop-blur rounded-3xl shadow-xl shadow-slate-200/60 ring-1 ring-slate-100 p-6 sm:p-10 lg:p-12">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-6 border-b border-slate-100 mb-8">
            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full mb-2">
                New Goal
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Create New Goal
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Fill in the metrics, performance criteria, and sub-goals.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/goals")}
              className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 font-medium cursor-pointer transition-colors self-start sm:self-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Back to Goals
            </button>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 p-4 rounded-2xl text-sm font-medium">
              <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div
            className={`mb-6 rounded-2xl border p-4 text-sm font-medium ${
              goalCreationWindow.isOpen
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
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
            className="space-y-8"
          >
            {/* Section: Basics */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Basics
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Goal No <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="GoalNumber"
                    required
                    value={formData.GoalNumber}
                    readOnly
                    className="w-full px-3.5 py-2.5 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Goal Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="GoalTitle"
                    required
                    placeholder="e.g. Production Target -- Moly 180 MT, V - 80 MT"
                    value={formData.GoalTitle}
                    onChange={handleChange}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition placeholder:text-slate-400 ${
                      fieldErrors.GoalTitle
                        ? "border-red-300 bg-red-50/40"
                        : "border-slate-200"
                    }`}
                  />
                  {fieldErrors.GoalTitle && (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {fieldErrors.GoalTitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Row 2: Category, Priority, Weightage, Start Date, End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    name="GoalCategory"
                    placeholder="e.g. Operational"
                    value={formData.GoalCategory}
                    onChange={handleChange}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition placeholder:text-slate-400 ${
                      fieldErrors.GoalCategory
                        ? "border-red-300 bg-red-50/40"
                        : "border-slate-200"
                    }`}
                  />
                  {fieldErrors.GoalCategory && (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {fieldErrors.GoalCategory}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Priority <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="Priority"
                    value={formData.Priority}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition bg-white"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Weightage (%) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={MIN_GOAL_WEIGHTAGE}
                    max={MAX_GOAL_WEIGHTAGE}
                    step="0.01"
                    name="Weightage"
                    required
                    placeholder="5 - 30%"
                    value={formData.Weightage}
                    onChange={handleChange}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition placeholder:text-slate-400 ${
                      fieldErrors.Weightage
                        ? "border-red-300 bg-red-50/40"
                        : "border-slate-200"
                    }`}
                  />
                  {fieldErrors.Weightage && (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {fieldErrors.Weightage}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="StartDate"
                      required
                      maxLength={10}
                      placeholder="DD/MM/YYYY"
                      value={formData.StartDate}
                      onChange={handleChange}
                      className={`w-full px-3.5 py-2.5 pr-11 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition ${
                        fieldErrors.StartDate
                          ? "border-red-300 bg-red-50/40"
                          : "border-slate-200"
                      }`}
                    />
                    <span className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-indigo-600">
                      <CalendarDays size={18} aria-hidden="true" />
                      <input
                        type="date"
                        aria-label="Choose Start Date from calendar"
                        title="Choose Start Date from calendar"
                        name="StartDate"
                        min={currentQuarterRange.min}
                        max={currentQuarterRange.max}
                        value={parseDateInput(formData.StartDate)}
                        onChange={handleDatePickerChange}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </span>
                  </div>
                  {fieldErrors.StartDate ? (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {fieldErrors.StartDate}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-xs mt-1.5">
                      Enter as DD/MM/YYYY within {currentQuarterRange.quarter}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      name="Timeline"
                      required
                      maxLength={10}
                      placeholder="DD/MM/YYYY"
                      value={formData.Timeline}
                      onChange={handleChange}
                      className={`w-full px-3.5 py-2.5 pr-11 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition ${
                        fieldErrors.Timeline
                          ? "border-red-300 bg-red-50/40"
                          : "border-slate-200"
                      }`}
                    />
                    <span className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-indigo-600">
                      <CalendarDays size={18} aria-hidden="true" />
                      <input
                        type="date"
                        aria-label="Choose End Date from calendar"
                        title="Choose End Date from calendar"
                        name="Timeline"
                        min={
                          parseDateInput(formData.StartDate) ||
                          currentQuarterRange.min
                        }
                        value={parseDateInput(formData.Timeline)}
                        onChange={handleDatePickerChange}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </span>
                  </div>
                  {fieldErrors.Timeline ? (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {fieldErrors.Timeline}
                    </p>
                  ) : (
                    <p className="text-slate-400 text-xs mt-1.5">
                      Enter as DD/MM/YYYY
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-indigo-950">
                {goalAllocationLoading ? (
                  <p className="text-xs text-indigo-800">
                    Loading current goal allocations...
                  </p>
                ) : goalAllocationError ? (
                  <p className="text-xs text-red-700">{goalAllocationError}</p>
                ) : selectedQuarter ? (
                  <>
                    <p className="font-semibold">
                      {selectedQuarter} allocation:{" "}
                      {(allocatedWeightageHundredths / 100).toFixed(2)}% used,{" "}
                      {(remainingWeightageHundredths / 100).toFixed(2)}% remaining.
                    </p>
                    <p className="mt-1 text-xs text-indigo-800">
                      {selectedQuarterGoals.length} of {MAX_GOALS_PER_QUARTER} goals added; up to{" "}
                      {additionalGoalsAvailable} more can fit with the current weightage.
                    </p>
                    <p className="mt-1 text-xs text-indigo-800">
                      Save goals as drafts while allocating; submission requires the quarter total to reach 100%.
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-indigo-800">
                    Choose a start date to see the quarter's remaining goal slots and weightage.
                  </p>
                )}
              </div>
            </section>

            {/* Section: Descriptions & Measurability */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Description & Measurability
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Goal Description
                  </label>
                  <textarea
                    name="GoalDescription"
                    rows="3"
                    value={formData.GoalDescription}
                    onChange={handleChange}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition resize-none ${
                      fieldErrors.GoalDescription
                        ? "border-red-300 bg-red-50/40"
                        : "border-slate-200"
                    }`}
                  />
                  {fieldErrors.GoalDescription && (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {fieldErrors.GoalDescription}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Measurability
                  </label>
                  <textarea
                    name="Measurability"
                    rows="3"
                    placeholder="Source of validation (e.g. As per production reports)"
                    value={formData.Measurability}
                    onChange={handleChange}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition resize-none placeholder:text-slate-400 ${
                      fieldErrors.Measurability
                        ? "border-red-300 bg-red-50/40"
                        : "border-slate-200"
                    }`}
                  />
                  {fieldErrors.Measurability && (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {fieldErrors.Measurability}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Section: Performance Criteria */}
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Performance Criteria
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 mb-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                    Meet Performance Target
                  </label>
                  <textarea
                    name="MeetPerformance"
                    rows="2"
                    placeholder="e.g. Moly - 180 MT, V - 80 MT"
                    value={formData.MeetPerformance}
                    onChange={handleChange}
                    className={`w-full px-3.5 py-2.5 border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition resize-none placeholder:text-slate-400 ${
                      fieldErrors.MeetPerformance
                        ? "border-red-300 bg-red-50/40"
                        : "border-emerald-200"
                    }`}
                  />
                  {fieldErrors.MeetPerformance && (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {fieldErrors.MeetPerformance}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-indigo-700 mb-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                    </svg>
                    Exceed Performance Target
                  </label>
                  <textarea
                    name="ExceedPerformance"
                    rows="2"
                    placeholder="e.g. Moly - >180 MT, V - >80 MT"
                    value={formData.ExceedPerformance}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 border border-indigo-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition resize-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </section>

            {/* Joint Accountability Section */}
            <section>
              <div className="flex justify-between items-center mb-4">
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
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Joint Employee
                </button>
              </div>

              <div className="space-y-3">
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
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Sub-Goals
                  </h3>
                  <p className="text-xs text-slate-400">
                    Optional: add up to {MAX_SUB_GOALS} sub-goals to track this goal's progress
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSubGoalRow}
                  disabled={subGoals.length >= MAX_SUB_GOALS}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Sub-Goal ({subGoals.length}/{MAX_SUB_GOALS})
                </button>
              </div>

              <div className="space-y-3">
                {subGoals.length === 0 && (
                  <p className="text-sm text-slate-400">No sub-goals added.</p>
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
                      <select
                        name="Status"
                        value={sub.Status}
                        onChange={(e) => handleSubGoalChange(index, e)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Completed">Completed</option>
                      </select>
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
            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-6 border-t border-slate-100">
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
        </div>
      </div>
    </div>
  );
};

export default AddGoal;
