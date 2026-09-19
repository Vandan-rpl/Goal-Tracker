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
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
          <div className="flex justify-between items-center pb-6 border-b mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Create New Goal
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Fill in the metrics, performance criteria, and sub-goals.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/goals")}
              className="text-sm text-gray-600 hover:text-gray-900 font-medium cursor-pointer"
            >
              &larr; Back to Goals
            </button>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => handleSubmit(e, "Draft")}
            className="space-y-6"
          >
            {/* Row 1: Goal Number & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal No *
                </label>
                <input
                  type="number"
                  name="GoalNumber"
                  required
                  value={formData.GoalNumber}
                  readOnly
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Title *
                </label>
                <input
                  type="text"
                  name="GoalTitle"
                  required
                  placeholder="e.g. Production Target -- Moly 180 MT, V - 80 MT"
                  value={formData.GoalTitle}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${fieldErrors.GoalTitle ? "border-red-400" : ""}`}
                />
                {fieldErrors.GoalTitle && (
                  <p className="text-red-600 text-xs mt-1">
                    {fieldErrors.GoalTitle}
                  </p>
                )}
              </div>
            </div>

            {/* Row 2: Category, Priority, Weightage, Timeline */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  name="GoalCategory"
                  placeholder="e.g. Operational"
                  value={formData.GoalCategory}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${fieldErrors.GoalCategory ? "border-red-400" : ""}`}
                />
                {fieldErrors.GoalCategory && (
                  <p className="text-red-600 text-xs mt-1">
                    {fieldErrors.GoalCategory}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority *
                </label>
                <select
                  name="Priority"
                  value={formData.Priority}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weightage (%) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="Weightage"
                  required
                  placeholder="5 - 30%"
                  value={formData.Weightage}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${fieldErrors.Weightage ? "border-red-400" : ""}`}
                />
                {fieldErrors.Weightage && (
                  <p className="text-red-600 text-xs mt-1">
                    {fieldErrors.Weightage}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timeline *
                </label>
                <input
                  type="date"
                  name="Timeline"
                  required
                  value={formData.Timeline}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${fieldErrors.Timeline ? "border-red-400" : ""}`}
                />
                {fieldErrors.Timeline && (
                  <p className="text-red-600 text-xs mt-1">
                    {fieldErrors.Timeline}
                  </p>
                )}
              </div>
            </div>

            {/* Row 3: Descriptions & Measurability */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Description
                </label>
                <textarea
                  name="GoalDescription"
                  rows="3"
                  value={formData.GoalDescription}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${fieldErrors.GoalDescription ? "border-red-400" : ""}`}
                />
                {fieldErrors.GoalDescription && (
                  <p className="text-red-600 text-xs mt-1">
                    {fieldErrors.GoalDescription}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Measurability
                </label>
                <textarea
                  name="Measurability"
                  rows="3"
                  placeholder="Source of validation (e.g. As per production reports)"
                  value={formData.Measurability}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${fieldErrors.Measurability ? "border-red-400" : ""}`}
                />
                {fieldErrors.Measurability && (
                  <p className="text-red-600 text-xs mt-1">
                    {fieldErrors.Measurability}
                  </p>
                )}
              </div>
            </div>

            {/* Row 4: Performance Criteria (Meet vs Exceed) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Meet Performance Target
                </label>
                <textarea
                  name="MeetPerformance"
                  rows="2"
                  placeholder="e.g. Moly - 180 MT, V - 80 MT"
                  value={formData.MeetPerformance}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 ${fieldErrors.MeetPerformance ? "border-red-400" : ""}`}
                />
                {fieldErrors.MeetPerformance && (
                  <p className="text-red-600 text-xs mt-1">
                    {fieldErrors.MeetPerformance}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exceed Performance Target
                </label>
                <textarea
                  name="ExceedPerformance"
                  rows="2"
                  placeholder="e.g. Moly - >180 MT, V - >80 MT"
                  value={formData.ExceedPerformance}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Row 5: Validation Source & Joint Accountability */}
            {/* Joint Accountability Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  Joint Accountability
                </h3>
                <button
                  type="button"
                  onClick={addJointAccountabilityRow}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition"
                >
                  + Add Joint Employee
                </button>
              </div>

              {jointAccountabilities.map((ja, index) => (
                <div
                  key={index}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 relative space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-600 uppercase">
                      Joint Employee #{index + 1}
                    </span>
                    {jointAccountabilities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeJointAccountabilityRow(index)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold"
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
                      className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
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
                      className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
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
                      className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>

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

            <hr className="my-6" />

            {/* Sub-Goals Section */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-800">Sub-Goals</h3>
                <button
                  type="button"
                  onClick={addSubGoalRow}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition"
                >
                  + Add Sub-Goal
                </button>
              </div>

              {subGoals.map((sub, index) => (
                <div
                  key={index}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4 relative space-y-3"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-600 uppercase">
                      Sub-Goal #{index + 1}
                    </span>
                    {subGoals.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSubGoalRow(index)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <input
                        type="text"
                        name="SubGoalTitle"
                        placeholder="Sub-Goal Title *"
                        required
                        value={sub.SubGoalTitle}
                        onChange={(e) => handleSubGoalChange(index, e)}
                        className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        name="Target"
                        placeholder="Target Description"
                        value={sub.Target}
                        onChange={(e) => handleSubGoalChange(index, e)}
                        className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        name="Weightage"
                        placeholder="Weightage (%)"
                        value={sub.Weightage}
                        onChange={(e) => handleSubGoalChange(index, e)}
                        className="w-full px-3 py-1.5 border rounded-lg text-sm bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end space-x-4 pt-4 border-t">
              <button
                type="button"
                onClick={() => navigate("/goals")}
                className="px-5 py-2 border rounded-xl text-gray-700 hover:bg-gray-100 font-medium text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Saving..." : "Save as Draft"}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={(e) => handleSubmit(e, "Submitted")}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm shadow-md transition disabled:opacity-50 cursor-pointer"
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
