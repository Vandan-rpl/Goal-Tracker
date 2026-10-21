import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import api from "../../services/api";
import {
  canEditGoal,
  canEditTimelineOnlyGoal,
  isApproverRole,
  isTimelineOverdue,
} from "../../utils/goalEditability";
import { getFiscalQuarterDateRange } from "../../utils/fiscalQuarter";
import {
  MAX_SUB_GOALS,
  getSubGoalError,
  getSubGoalWeightageSummary,
} from "../../utils/subGoals";

const MIN_GOAL_WEIGHTAGE = 5;
const MAX_GOAL_WEIGHTAGE = 30;

const EditGoal = () => {
  const { id } = useParams();
  const navigate = useNavigate();

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
    GoalStatus: "Draft",
  });

  const [originalGoal, setOriginalGoal] = useState(null);
  const [subGoals, setSubGoals] = useState([]);
  const [jointAccountabilities, setJointAccountabilities] = useState([]);
  const [hasExistingJointAccountabilities, setHasExistingJointAccountabilities] = useState(false);
  const [jointAccountabilityUsers, setJointAccountabilityUsers] = useState([]);
  const [jointAccountabilityUsersLoading, setJointAccountabilityUsersLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Field-level SMART validation errors from the backend — same 400 shape
  // as AddGoal.jsx: { success:false, message, errors: { Field: "message" } }
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    fetchGoal();
  }, [id]);

  useEffect(() => {
    const loadJointAccountabilityUsers = async () => {
      try {
        const response = await api.get("/goals/joint-accountability-users");
        setJointAccountabilityUsers(response.data?.data || []);
      } catch (err) {
        console.error("Failed to load employees for joint accountability", err);
      } finally {
        setJointAccountabilityUsersLoading(false);
      }
    };

    loadJointAccountabilityUsers();
  }, []);

  const fetchGoal = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/goals/${id}`);
      if (res.data.success) {
        const goal = res.data.data;
        setOriginalGoal({
          CarryForwardCount: goal.CarryForwardCount,
          IsGoalOwner: goal.IsGoalOwner,
          UserID: goal.UserID,
          GoalStatus: goal.GoalStatus || "Draft",
          Timeline: goal.Timeline || null,
          QuarterEndDate: goal.QuarterEndDate
            ? String(goal.QuarterEndDate).slice(0, 10)
            : null,
        });
        setFormData({
          GoalNumber: goal.GoalNumber || 1,
          GoalTitle: goal.GoalTitle || "",
          GoalDescription: goal.GoalDescription || "",
          Measurability: goal.Measurability || "",
          JointAccountability: goal.JointAccountability || "",
          Weightage: goal.Weightage || "",
          Priority: goal.Priority || "Medium",
          StartDate: goal.StartDate ? goal.StartDate.split("T")[0] : "",
          Timeline: goal.Timeline ? goal.Timeline.split("T")[0] : "",
          MeetPerformance: goal.MeetPerformance || "",
          ExceedPerformance: goal.ExceedPerformance || "",
          ValidationSource: goal.ValidationSource || "",
          CrossFunctionalGoal: Boolean(goal.CrossFunctionalGoal),
          GoalCategory: goal.GoalCategory || "",
          GoalStatus: goal.GoalStatus || "Draft",
        });
        const existingJointAccountabilities = goal.JointAccountabilities || [];
        setHasExistingJointAccountabilities(
          existingJointAccountabilities.length > 0,
        );
        setJointAccountabilities(
          existingJointAccountabilities.map((item) => ({
            UserID: String(item.UserID),
            ContributionNote: item.ContributionNote || "",
            Weightage: item.Weightage ?? "",
            FirstName: item.FirstName,
            LastName: item.LastName,
          })),
        );
        setSubGoals(
          (goal.SubGoals || []).map((sub) => ({
            SubGoalID: sub.SubGoalID,
            SubGoalNo: sub.SubGoalNo,
            SubGoalTitle: sub.SubGoalTitle || "",
            Weightage:
              sub.Weightage == null ? "" : String(Number(sub.Weightage)),
          })),
        );
      }
    } catch (err) {
      console.error("Failed to load goal", err);
      setError("Failed to load goal details.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
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
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.SubGoals;
      return next;
    });
  };

  const handleJointAccountabilityChange = (index, e) => {
    const { name, value } = e.target;
    setJointAccountabilities((previous) =>
      previous.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [name]: value } : item,
      ),
    );
  };

  const addJointAccountability = () => {
    setJointAccountabilities((previous) => [
      ...previous,
      { UserID: "", ContributionNote: "", Weightage: "" },
    ]);
  };

  const removeJointAccountability = (index) => {
    setJointAccountabilities((previous) =>
      previous.filter((_, currentIndex) => currentIndex !== index),
    );
  };

  const handleSubmit = async (e, status = formData.GoalStatus) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

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

    if (!canEditTimelineOnly) {
      if (
        !formData.StartDate ||
        formData.StartDate < quarterRange.min ||
        formData.StartDate > quarterRange.max
      ) {
        const message = `Start Date must be within ${quarterRange.quarter} (${quarterRange.min} to ${quarterRange.max}).`;
        setError(message);
        setFieldErrors({ StartDate: message });
        return;
      }

      if (!formData.Timeline || formData.Timeline < formData.StartDate) {
        const message = "End Date must be on or after Start Date.";
        setError(message);
        setFieldErrors({ Timeline: message });
        return;
      }
    } else if (
      !formData.Timeline ||
      (originalTimelineKey && formData.Timeline <= originalTimelineKey)
    ) {
      const message = originalTimelineKey
        ? `New End Date must be after the current End Date (${originalTimelineKey}).`
        : "End Date is required.";
      setError(message);
      setFieldErrors({ Timeline: message });
      return;
    }

    const titledSubGoals = subGoals.filter((sub) => sub.SubGoalTitle.trim());
    const subGoalError = canEditSubGoals && getSubGoalError(titledSubGoals);
    if (subGoalError) {
      setError(subGoalError);
      setFieldErrors({ SubGoals: subGoalError });
      return;
    }

    setSubmitting(true);

    try {
      const selectedJointAccountabilities = [
        ...new Map(
          jointAccountabilities
            .filter((item) => item.UserID)
            .map((item) => [String(item.UserID), item]),
        ).values(),
      ];
      const jointAccountabilityNames = selectedJointAccountabilities
        .map((item) => {
          const employee = jointAccountabilityUsers.find(
            (candidate) => String(candidate.UserID) === String(item.UserID),
          );
          return employee
            ? [employee.FirstName, employee.LastName].filter(Boolean).join(" ")
            : [item.FirstName, item.LastName].filter(Boolean).join(" ");
        })
        .filter(Boolean)
        .join(", ");
      const payload = {
        ...formData,
        JointAccountability:
          jointAccountabilityNames ||
          (hasExistingJointAccountabilities
            ? null
            : formData.JointAccountability || null),
        JointAccountabilities: selectedJointAccountabilities,
        GoalStatus: status,
        // Sub-goal definitions are only sent while they are editable; the
        // backend ignores them in other statuses anyway. SubGoalID lets the
        // backend keep each existing sub-goal's status.
        ...(canEditSubGoals && {
          SubGoals: titledSubGoals.map((sub) => ({
            SubGoalID: sub.SubGoalID,
            SubGoalNo: sub.SubGoalNo,
            SubGoalTitle: sub.SubGoalTitle,
            Weightage: Number(sub.Weightage),
          })),
        }),
      };

      const res = await api.put(`/goals/${id}`, payload);
      if (res.data.success) {
        navigate("/goals");
      } else {
        setError(res.data.message || "Failed to update goal.");
        if (res.data.errors) {
          setFieldErrors(res.data.errors);
        }
      }
    } catch (err) {
      // SMART validation failures come back as a 400 with this exact
      // shape: { success:false, message, errors: { Field: "message" } }.
      const data = err.response?.data;
      setError(data?.message || "Server error while updating goal.");
      if (data?.errors) {
        setFieldErrors(data.errors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen flex items-center justify-center text-gray-500">
        Loading goal for editing...
      </div>
    );
  }

  const originalStatus = originalGoal?.GoalStatus || formData.GoalStatus;
  let currentUserId = null;
  let currentRole = "";
  try {
    const token = localStorage.getItem("token");
    if (token) currentUserId = jwtDecode(token).userId;
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    currentRole =
      user.role ||
      user.Role ||
      user.userRole ||
      user.UserRole ||
      user.designation ||
      user.Designation ||
      "";
  } catch (error) {
    console.error("Failed to read the current user's edit permissions", error);
  }
  const isGoalOwner =
    originalGoal &&
    (originalGoal.IsGoalOwner === true ||
      (originalGoal.IsGoalOwner == null &&
        currentUserId != null &&
        Number(originalGoal.UserID) === Number(currentUserId)));
  const isApprover = isApproverRole(currentRole) && !isGoalOwner;
  const isRejected = originalStatus === "Rejected";
  const isDraft = originalStatus === "Draft";
  const canSubmitForApproval = isDraft || isRejected;
  const terminalStatus = ["Completed", "Cancelled"].includes(originalStatus);
  const timelineOverdue = isTimelineOverdue(originalGoal?.Timeline);
  const canEditAllFields = isDraft || isRejected || isApprover;
  // Sub-goal titles/weightages are editable only in Draft or Rejected, for
  // approvers too; their status is ticked from the goal page once Approved.
  const canEditSubGoals = isDraft || isRejected;
  const canEditTimelineOnly =
    !canEditAllFields && canEditTimelineOnlyGoal(originalGoal);
  const canEdit = canEditGoal(originalGoal, isApprover);
  const isRestrictedEdit = canEditTimelineOnly;
  // On carry-forward the new Timeline must be after the current one.
  const originalTimelineKey = originalGoal?.Timeline
    ? String(originalGoal.Timeline).slice(0, 10)
    : "";
  const minCarryForwardTimeline = (() => {
    if (!originalTimelineKey) return undefined;
    const [year, month, day] = originalTimelineKey.split("-").map(Number);
    const next = new Date(year, month - 1, day + 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
  })();
  // Start Date stays within the goal's stored quarter.
  const quarterRange =
    (originalGoal?.QuarterEndDate &&
      getFiscalQuarterDateRange(originalGoal.QuarterEndDate)) ||
    getFiscalQuarterDateRange();

  if (!canEdit) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen p-8 text-center">
        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl max-w-md mx-auto mb-4 font-medium">
          {terminalStatus
            ? `This goal is ${formData.GoalStatus} and cannot be edited.`
            : `This goal is ${originalStatus} and can only be edited when it is Draft or Rejected, or after its Timeline has passed.`}
        </div>
        <button
          onClick={() => navigate("/goals")}
          className="text-indigo-600 font-semibold underline"
        >
          &larr; Back to Goals
        </button>
      </div>
    );
  }

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

  return (
  <div className="flex-1 bg-white min-h-screen p-4 sm:p-6 md:p-8 text-slate-800">
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold uppercase tracking-wider mb-1">
            Goal Management
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Edit Goal</h1>
          <p className="text-sm text-slate-500 mt-1">
            {canEditTimelineOnly
              ? "This goal is overdue. Only its Timeline can be changed; saving resubmits it for approval."
              : isRejected
                ? "Revise the rejected goal, then submit it again for approval."
                : "Modify goal targets, metrics, and status."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/goals")}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium transition shrink-0 shadow-sm"
        >
          &larr; Back to Goals
        </button>
      </div>

      {/* Notice Banners */}
      {canEditTimelineOnly && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm">
          <span className="text-amber-600 font-bold">⚠️</span>
          <p>
            This goal's Timeline has passed. Only the Timeline can be changed;
            saving will resubmit it for approval with the new date.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm font-medium">
          <span className="text-red-500 font-bold">✕</span>
          <p>{error}</p>
        </div>
      )}

      <form
        onSubmit={(e) =>
          handleSubmit(
            e,
            canEditTimelineOnly
              ? "Submitted"
              : isDraft
                ? "Draft"
                : formData.GoalStatus,
          )
        }
        className="space-y-6"
      >
        
        {/* Section 1: Basic Details */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Primary Details
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Goal No <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="GoalNumber"
                required
                disabled={isRestrictedEdit}
                value={formData.GoalNumber}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Goal Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="GoalTitle"
                required
                disabled={isRestrictedEdit}
                value={formData.GoalTitle}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
                  fieldErrors.GoalTitle ? "border-red-500" : "border-slate-300"
                }`}
              />
              {fieldErrors.GoalTitle && (
                <p className="text-red-600 text-xs mt-1 font-medium">
                  {fieldErrors.GoalTitle}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <input
                type="text"
                name="GoalCategory"
                disabled={isRestrictedEdit}
                value={formData.GoalCategory}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
                  fieldErrors.GoalCategory ? "border-red-500" : "border-slate-300"
                }`}
              />
              {fieldErrors.GoalCategory && (
                <p className="text-red-600 text-xs mt-1 font-medium">
                  {fieldErrors.GoalCategory}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Priority <span className="text-red-500">*</span>
              </label>
              <select
                name="Priority"
                disabled={isRestrictedEdit}
                value={formData.Priority}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Weightage (%) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={MIN_GOAL_WEIGHTAGE}
                max={MAX_GOAL_WEIGHTAGE}
                step="0.01"
                name="Weightage"
                required
                disabled={isRestrictedEdit}
                value={formData.Weightage}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
                  fieldErrors.Weightage ? "border-red-500" : "border-slate-300"
                }`}
              />
              {fieldErrors.Weightage && (
                <p className="text-red-600 text-xs mt-1 font-medium">
                  {fieldErrors.Weightage}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="StartDate"
                required={!isRestrictedEdit}
                disabled={isRestrictedEdit}
                min={quarterRange.min}
                max={quarterRange.max}
                value={formData.StartDate}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
                  fieldErrors.StartDate ? "border-red-500" : "border-slate-300"
                }`}
              />
              {fieldErrors.StartDate ? (
                <p className="text-red-600 text-xs mt-1 font-medium">
                  {fieldErrors.StartDate}
                </p>
              ) : (
                !isRestrictedEdit && (
                  <p className="text-slate-400 text-xs mt-1">
                    Within {quarterRange.quarter}
                  </p>
                )
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="Timeline"
                required
                min={
                  isRestrictedEdit
                    ? minCarryForwardTimeline
                    : formData.StartDate || quarterRange.min
                }
                value={formData.Timeline}
                onChange={handleChange}
                className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
                  fieldErrors.Timeline ? "border-red-500" : "border-slate-300"
                } ${canEditTimelineOnly ? "ring-2 ring-amber-400 border-amber-400 bg-amber-50/50" : ""}`}
              />
              {fieldErrors.Timeline && (
                <p className="text-red-600 text-xs mt-1 font-medium">
                  {fieldErrors.Timeline}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Goal Status
              </label>
              <select
                name="GoalStatus"
                disabled={isRestrictedEdit}
                value={formData.GoalStatus}
                onChange={handleChange}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm"
              >
                {isDraft && <option value="Draft">Draft</option>}
                {[
                  "Submitted",
                  "HOD Approved",
                  "Manager Approved",
                  "Approved",
                  "Rejected",
                ].includes(formData.GoalStatus) && (
                  <option value={formData.GoalStatus}>
                    {formData.GoalStatus}
                  </option>
                )}
                <option value="Running">Running</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Postpone">Postpone</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Goal Description
            </label>
            <textarea
              name="GoalDescription"
              rows="4"
              disabled={isRestrictedEdit}
              value={formData.GoalDescription}
              onChange={handleChange}
              placeholder="Describe the objective..."
              className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
                fieldErrors.GoalDescription ? "border-red-500" : "border-slate-300"
              }`}
            />
            {fieldErrors.GoalDescription && (
              <p className="text-red-600 text-xs font-medium">
                {fieldErrors.GoalDescription}
              </p>
            )}
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Measurability <span className="text-red-500">*</span>
            </label>
            <textarea
              name="Measurability"
              rows="4"
              required
              disabled={isRestrictedEdit}
              value={formData.Measurability}
              onChange={handleChange}
              placeholder="How will progress be measured?"
              className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
                fieldErrors.Measurability ? "border-red-500" : "border-slate-300"
              }`}
            />
            {fieldErrors.Measurability && (
              <p className="text-red-600 text-xs font-medium">
                {fieldErrors.Measurability}
              </p>
            )}
          </div>
        </div>

        {/* Section 3: Performance Targets */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Performance Targets
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meet Performance Target
              </label>
              <textarea
                name="MeetPerformance"
                rows="3"
                disabled={isRestrictedEdit}
                value={formData.MeetPerformance}
                onChange={handleChange}
                placeholder="Expected standard outcome..."
                className={`w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
                  fieldErrors.MeetPerformance ? "border-red-500" : "border-slate-300"
                }`}
              />
              {fieldErrors.MeetPerformance && (
                <p className="text-red-600 text-xs mt-1 font-medium">
                  {fieldErrors.MeetPerformance}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Exceed Performance Target
              </label>
              <textarea
                name="ExceedPerformance"
                rows="3"
                disabled={isRestrictedEdit}
                value={formData.ExceedPerformance}
                onChange={handleChange}
                placeholder="Stretch goals or exceptional outcomes..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Validation & Accountability */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
            Validation & Accountability
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Validation Source
              </label>
              <input
                type="text"
                name="ValidationSource"
                disabled={isRestrictedEdit}
                value={formData.ValidationSource}
                onChange={handleChange}
                placeholder="e.g. System reports, Audit logs"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm"
              />
            </div>

            <div className="space-y-4">
              {!hasExistingJointAccountabilities && jointAccountabilities.length === 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Joint Accountability
                  </label>
                  <input
                    type="text"
                    name="JointAccountability"
                    disabled={isRestrictedEdit}
                    value={formData.JointAccountability}
                    onChange={handleChange}
                    placeholder="Specify joint team / owner"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm"
                  />
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Assigned Participants
                  </label>
                  <button
                    type="button"
                    onClick={addJointAccountability}
                    disabled={isRestrictedEdit}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md transition disabled:opacity-50"
                  >
                    + Add Participant
                  </button>
                </div>

                {jointAccountabilities.length === 0 ? (
                  <div className="p-3 rounded-lg border border-dashed border-slate-200 text-center text-xs text-slate-400 bg-slate-50">
                    No assigned joint participants.
                  </div>
                ) : (
                  jointAccountabilities.map((item, index) => (
                    <div key={`${item.UserID || "new"}-${index}`} className="grid grid-cols-1 sm:grid-cols-[1.2fr_1.5fr_0.8fr_auto] gap-2 items-center bg-slate-50 p-2 border border-slate-200 rounded-lg">
                      <select
                        name="UserID"
                        value={item.UserID}
                        disabled={isRestrictedEdit || jointAccountabilityUsersLoading}
                        onChange={(event) => handleJointAccountabilityChange(index, event)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-800 disabled:bg-slate-100 focus:border-slate-800 focus:outline-none"
                      >
                        <option value="">Select Employee</option>
                        {item.UserID && !jointAccountabilityUsers.some((employee) => String(employee.UserID) === String(item.UserID)) && (
                          <option value={item.UserID}>
                            {[item.FirstName, item.LastName].filter(Boolean).join(" ") || `Employee ${item.UserID}`}
                          </option>
                        )}
                        {jointAccountabilityUsers.map((employee) => (
                          <option
                            key={employee.UserID}
                            value={employee.UserID}
                            disabled={jointAccountabilities.some((other, otherIndex) =>
                              otherIndex !== index && String(other.UserID) === String(employee.UserID),
                            )}
                          >
                            {[employee.FirstName, employee.LastName].filter(Boolean).join(" ")}
                            {employee.Designation ? ` - ${employee.Designation}` : ""}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        name="ContributionNote"
                        maxLength={500}
                        placeholder="Contribution note"
                        value={item.ContributionNote}
                        disabled={isRestrictedEdit}
                        onChange={(event) => handleJointAccountabilityChange(index, event)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs disabled:bg-slate-100 focus:border-slate-800 focus:outline-none"
                      />

                      <input
                        type="number"
                        name="Weightage"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="Weight %"
                        value={item.Weightage}
                        disabled={isRestrictedEdit}
                        onChange={(event) => handleJointAccountabilityChange(index, event)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-xs disabled:bg-slate-100 focus:border-slate-800 focus:outline-none"
                      />

                      <button
                        type="button"
                        onClick={() => removeJointAccountability(index)}
                        disabled={isRestrictedEdit}
                        className="px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                        aria-label={`Remove ${[item.FirstName, item.LastName].filter(Boolean).join(" ") || "joint participant"}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: Sub-Goals */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sub-Goals Breakdown</h2>
              <span className="text-xs text-slate-400">Optional</span>
            </div>

            <button
              type="button"
              onClick={addSubGoalRow}
              disabled={!canEditSubGoals || subGoals.length >= MAX_SUB_GOALS}
              className="inline-flex items-center justify-center px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add Sub-Goal ({subGoals.length}/{MAX_SUB_GOALS})
            </button>
          </div>

          <div className="space-y-3">
            {subGoals.length === 0 && (
              <p className="text-xs text-slate-400">No sub-goals added.</p>
            )}
            {!canEditSubGoals && (
              <p className="text-xs text-slate-500">
                Sub-goals can be added, edited or removed only while the goal is Draft or Rejected.
              </p>
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
                className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2"
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Sub-Goal #{index + 1}
                  </span>
                  {canEditSubGoals && (
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
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      name="SubGoalTitle"
                      placeholder="Sub-Goal Title *"
                      required
                      disabled={!canEditSubGoals}
                      value={sub.SubGoalTitle}
                      onChange={(e) => handleSubGoalChange(index, e)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs font-medium bg-white focus:border-slate-800 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      name="Weightage"
                      placeholder="Weightage % *"
                      aria-label={`Sub-Goal #${index + 1} weightage (% of this goal)`}
                      required
                      min="0.01"
                      max="100"
                      step="0.01"
                      disabled={!canEditSubGoals}
                      value={sub.Weightage}
                      onChange={(e) => handleSubGoalChange(index, e)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-md text-xs bg-white focus:border-slate-800 focus:outline-none disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {fieldErrors.SubGoals && (
            <p className="text-red-600 text-xs font-medium" role="alert">
              {fieldErrors.SubGoals}
            </p>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => navigate("/goals")}
            className="w-full sm:w-auto px-5 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-medium text-xs transition uppercase tracking-wide"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium text-xs transition uppercase tracking-wide disabled:opacity-50"
          >
            {submitting
              ? "Saving..."
              : isDraft
                ? "Save as Draft"
                : canEditTimelineOnly
                  ? "Save Timeline & Resubmit"
                  : "Save Goal"}
          </button>

          {canSubmitForApproval && (
            <button
              type="button"
              onClick={(e) => handleSubmit(e, "Submitted")}
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs transition uppercase tracking-wide disabled:opacity-50"
            >
              {submitting
                ? "Submitting..."
                : isRejected
                  ? "Resubmit for Approval"
                  : "Submit Goal"}
            </button>
          )}
        </div>

      </form>
    </div>
  </div>
);
};

export default EditGoal;