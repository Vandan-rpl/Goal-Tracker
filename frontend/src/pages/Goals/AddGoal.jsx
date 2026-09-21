import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import api from "../../services/api";

const AddGoal = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

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
    Timeline: "",
    MeetPerformance: "",
    ExceedPerformance: "",
    ValidationSource: "",
    CrossFunctionalGoal: false,
    GoalCategory: "",
  });

  // Dynamic Sub-Goals state matching GoalSubGoals table columns
  const [subGoals, setSubGoals] = useState([
    {
      SubGoalNo: 1,
      SubGoalTitle: "",
      SubGoalDescription: "",
      Weightage: "",
      Target: "",
    },
  ]);

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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
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

  const handleSubGoalChange = (index, e) => {
    const { name, value } = e.target;
    const updated = [...subGoals];
    updated[index][name] = value;
    setSubGoals(updated);
  };

  const addSubGoalRow = () => {
    setSubGoals((prev) => [
      ...prev,
      {
        SubGoalNo: prev.length + 1,
        SubGoalTitle: "",
        SubGoalDescription: "",
        Weightage: "",
        Target: "",
      },
    ]);
  };

  const removeSubGoalRow = (index) => {
    setSubGoals((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e, status = "Draft") => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);

    try {
      const payload = {
        ...formData,
        UserID: user?.userId || user?.UserID,
        GoalStatus: status,
        SubGoals: subGoals,
        JointAccountabilities: jointAccountabilities.filter((ja) => ja.UserID),
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
    <div className="flex-1 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 min-h-screen overflow-y-auto p-4 sm:p-8">
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

          <form
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

              {/* Row 2: Category, Priority, Weightage, Timeline */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
                    Timeline <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="Timeline"
                    required
                    value={formData.Timeline}
                    onChange={handleChange}
                    className={`w-full px-3.5 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition ${
                      fieldErrors.Timeline
                        ? "border-red-300 bg-red-50/40"
                        : "border-slate-200"
                    }`}
                  />
                  {fieldErrors.Timeline && (
                    <p className="text-red-600 text-xs mt-1.5 font-medium">
                      {fieldErrors.Timeline}
                    </p>
                  )}
                </div>
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
                    Break this goal into measurable, weighted sub-goals
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSubGoalRow}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-semibold transition cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add Sub-Goal
                </button>
              </div>

              <div className="space-y-3">
                {subGoals.map((sub, index) => (
                  <div
                    key={index}
                    className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 relative space-y-3"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">
                        Sub-Goal #{index + 1}
                      </span>
                      {subGoals.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSubGoalRow(index)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        name="SubGoalTitle"
                        placeholder="Sub-Goal Title *"
                        required
                        value={sub.SubGoalTitle}
                        onChange={(e) => handleSubGoalChange(index, e)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-400"
                      />
                      <input
                        type="text"
                        name="Target"
                        placeholder="Target Description"
                        value={sub.Target}
                        onChange={(e) => handleSubGoalChange(index, e)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-400"
                      />
                      <input
                        type="number"
                        step="0.01"
                        name="Weightage"
                        placeholder="Weightage (%)"
                        value={sub.Weightage}
                        onChange={(e) => handleSubGoalChange(index, e)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                ))}
              </div>
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
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-emerald-500/20 transition disabled:opacity-50 cursor-pointer"
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
