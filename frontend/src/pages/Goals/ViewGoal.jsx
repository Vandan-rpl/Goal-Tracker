import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import api from "../../services/api";
import GoalStatusStepper from "../../components/GoalStatusStepper/GoalStatusStepper";

const ViewGoal = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Quarterly update history state
  const [quarterlyUpdates, setQuarterlyUpdates] = useState([]);
  const [quarterlyUpdatesError, setQuarterlyUpdatesError] = useState("");
  const [expandedQuarter, setExpandedQuarter] = useState(null);

  // Review form state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // User & Role parsing
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const rawRole =
    user.role ||
    user.Role ||
    user.userRole ||
    user.UserRole ||
    user.designation ||
    user.Designation ||
    "";

  const normalizedRole = String(rawRole)
    .toLowerCase()
    .trim()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ");

  const approverRoles = [
    "hod",
    "cfo",
    "businesshead",
    "business head",
    "business_head",
    "manager",
  ];
  const isAuthorizedApprover = approverRoles.includes(normalizedRole);

  const getApprovalStatusForRole = () => {
    if (normalizedRole === "cfo") {
      return "Approved";
    }
    if (
      ["businesshead", "business head", "business_head"].includes(
        normalizedRole,
      )
    ) {
      return "Business Head Approved";
    }
    return normalizedRole === "manager" ? "Manager Approved" : "HOD Approved";
  };

  const approvalStatus =
    normalizedRole === "businesshead" && goal?.GoalStatus !== "Submitted"
      ? "Approved"
      : getApprovalStatusForRole();
  const canCfoApprove = ["cfo", "businesshead", "business head"].includes(
    normalizedRole,
  );

  const reviewableStatuses = ["HOD Approved", "Reviewed By HOD"];
  const canSubmitReview =
    isAuthorizedApprover &&
    goal &&
    reviewableStatuses.includes(goal.GoalStatus);

  let loggedInUserId = null;
  try {
    const token = localStorage.getItem("token");
    if (token) {
      loggedInUserId = jwtDecode(token).userId;
    }
  } catch (e) {
    loggedInUserId = null;
  }

  const isGoalOwner =
    goal &&
    loggedInUserId != null &&
    Number(goal.UserID) === Number(loggedInUserId);

  const canShowApproveReject =
    goal &&
    ((canCfoApprove &&
      [
        "HOD Approved",
        "Manager Approved",
        "Reviewed By HOD",
        "Review By Business Head",
        "Business Head Approved",
      ].includes(goal.GoalStatus)) ||
      (goal.CanApproveOrReject === true &&
        goal.GoalStatus === "Submitted"));

  const canShowCfoActions =
    canCfoApprove &&
    [
      "HOD Approved",
      "Manager Approved",
      "Reviewed By HOD",
      "Review By Business Head",
      // "Business Head Approved",
    ].includes(goal?.GoalStatus);

  const quarterlyUpdateEligibleStatuses = [
    "HOD Approved",
    "Manager Approved",
    "Business Head Approved",
    "Approved",
    "Reviewed By HOD",
    "Review By Business Head",
  ];
  const canLogQuarterlyUpdate =
    isGoalOwner &&
    goal &&
    quarterlyUpdateEligibleStatuses.includes(goal.GoalStatus);

  useEffect(() => {
    fetchGoalDetails();
  }, [id]);

  const fetchGoalDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/goals/${id}`);
      if (res.data.success) {
        setGoal(res.data.data);
      }
    } catch (err) {
      console.error("Error loading goal details", err);
      setError("Failed to load goal details.");
    } finally {
      setLoading(false);
    }

    try {
      setQuarterlyUpdatesError("");
      const historyRes = await api.get(`/ratings/quarterly-updates/${id}`);
      if (historyRes.data.success) {
        setQuarterlyUpdates(historyRes.data.data || []);
      } else {
        setQuarterlyUpdatesError(
          historyRes.data.message || "Unable to load quarterly progress.",
        );
      }
    } catch (historyErr) {
      console.error("Error loading quarterly update history", historyErr);
      setQuarterlyUpdatesError(
        historyErr.response?.data?.message || "Unable to load quarterly progress.",
      );
    }
  };

  const handleGoalAction = async (newStatus) => {
    try {
      setActionLoading(true);
      const response = await api.put(`/goals/status/${id}`, {
        goalStatus: newStatus,
      });
      if (response.data.success) {
        alert(`Goal successfully ${newStatus.toLowerCase()}!`);
        setGoal((prev) => ({ ...prev, GoalStatus: newStatus }));
      } else {
        alert(response.data.message || "Failed to update status.");
      }
    } catch (err) {
      console.error("Error updating goal status:", err);
      alert("Server error while updating status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    try {
      setReviewSubmitting(true);
      const response = await api.post(`/goals/review`, {
        goalId: id,
        rating: reviewRating,
        comment: reviewComment,
      });

      if (response.data.success) {
        alert(response.data.message || "Review submitted successfully!");
        await fetchGoalDetails();
        setReviewComment("");
        setReviewRating(5);
      } else {
        alert(response.data.message || "Failed to submit review.");
      }
    } catch (err) {
      console.error("Error submitting review:", err);
      alert(
        err.response?.data?.message || "Server error while submitting review.",
      );
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-50/50 min-h-screen flex flex-col items-center justify-center text-slate-500 gap-3">
        <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium animate-pulse">Loading goal details...</p>
      </div>
    );
  }

  if (error || !goal) {
    return (
      <div className="flex-1 bg-slate-50 min-h-screen p-8 flex flex-col justify-center items-center">
        <div className="bg-red-50/80 border border-red-200 text-red-700 p-6 rounded-2xl max-w-md w-full text-center shadow-xs mb-4">
          <svg className="w-10 h-10 mx-auto text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-semibold text-base">{error || "Goal not found."}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-800 transition cursor-pointer text-sm"
        >
          &larr; Back to Goals
        </button>
      </div>
    );
  }

  const isApproved =
    goal.GoalStatus === "Approved" ||
    goal.GoalStatus === "HOD Approved" ||
    goal.GoalStatus === "Manager Approved" ||
    goal.GoalStatus === "Business Head Approved";

  const getStatusBadgeStyle = (status) => {
    if (isApproved) return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
    if (status === "Submitted") return "bg-indigo-50 text-indigo-700 border-indigo-200/60";
    if (status === "Rejected") return "bg-rose-50 text-rose-700 border-rose-200/60";
    return "bg-amber-50 text-amber-700 border-amber-200/60";
  };

  return (
    <div className="flex-1 bg-slate-50/60 min-h-screen overflow-y-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Main Card Container */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8 space-y-8">
          
          {/* Header Navigation & Badges */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-100">
            <button
              onClick={() => navigate(-1)}
              className="group inline-flex items-center text-sm font-semibold text-slate-600 hover:text-indigo-600 transition cursor-pointer"
            >
              <span className="mr-1.5 transition-transform group-hover:-translate-x-1">&larr;</span> Back
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeStyle(goal.GoalStatus)}`}>
                {goal.GoalStatus || "Draft"}
              </span>
              <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-200/50">
                Priority: {goal.Priority}
              </span>
            </div>
          </div>

          {/* Goal Status Stepper */}
          <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
            <GoalStatusStepper status={goal.GoalStatus || "Draft"} />
          </div>

          {/* Goal Header */}
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100/80 inline-block">
              Goal #{goal.GoalNumber}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight pt-1">
              {goal.GoalTitle}
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Category: <span className="text-slate-800 font-semibold">{goal.GoalCategory || "General"}</span>
            </p>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Weightage</span>
              <span className="text-xl font-bold text-slate-800 mt-1">{goal.Weightage}%</span>
            </div>
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Timeline</span>
              <span className="text-sm font-bold text-slate-800 mt-1">
                {goal.Timeline ? new Date(goal.Timeline).toLocaleDateString() : "N/A"}
              </span>
            </div>
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Cross-Functional</span>
              <span className="text-sm font-bold text-slate-800 mt-1">
                {goal.CrossFunctionalGoal ? "Yes" : "No"}
              </span>
            </div>
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 flex flex-col justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Draft Version</span>
              <span className="text-sm font-bold text-slate-800 mt-1">v{goal.DraftVersion || 1}</span>
            </div>
          </div>

          {/* Description & Measurability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <h4 className="font-bold mb-2 text-xs uppercase tracking-wider text-slate-400">
                Goal Description
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed">
                {goal.GoalDescription || "No description provided."}
              </p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
              <h4 className="font-bold mb-2 text-xs uppercase tracking-wider text-slate-400">
                Measurability & Validation
              </h4>
              <p className="text-slate-600 text-sm leading-relaxed">
                {goal.Measurability || "N/A"}
              </p>
              {goal.ValidationSource && (
                <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-indigo-600 font-medium flex items-center gap-1.5">
                  <span className="font-bold uppercase tracking-wider text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">Source</span>
                  <span>{goal.ValidationSource}</span>
                </div>
              )}
            </div>
          </div>

          {/* Performance Criteria Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-emerald-50/40 p-5 rounded-2xl border border-emerald-100">
              <h4 className="font-bold text-emerald-900 mb-2 text-xs uppercase tracking-wider">
                Meet Performance
              </h4>
              <p className="text-emerald-800/90 text-sm leading-relaxed">
                {goal.MeetPerformance || "Not specified"}
              </p>
            </div>
            <div className="bg-indigo-50/40 p-5 rounded-2xl border border-indigo-100">
              <h4 className="font-bold text-indigo-900 mb-2 text-xs uppercase tracking-wider">
                Exceed Performance
              </h4>
              <p className="text-indigo-800/90 text-sm leading-relaxed">
                {goal.ExceedPerformance || "Not specified"}
              </p>
            </div>
          </div>

          {goal.JointAccountability && (
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60 text-sm">
              <span className="font-bold text-slate-700">Joint Accountability: </span>
              <span className="text-slate-600">{goal.JointAccountability}</span>
            </div>
          )}

          <hr className="border-slate-100 my-6" />

          {/* Quarterly Progress Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-800">Quarterly Progress</h3>
              {canLogQuarterlyUpdate && (
                <Link
                  to={`/goals/quarterly-update/${goal.GoalID}`}
                  className="inline-flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition border border-indigo-100 cursor-pointer"
                >
                  + Log Quarterly Update
                </Link>
              )}
            </div>

            {quarterlyUpdates.length > 0 ? (
              <div className="space-y-3">
                {quarterlyUpdates.map((update) => {
                  const isOpen = expandedQuarter === update.Quarter;
                  return (
                    <div key={update.Quarter} className="border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-2xs">
                      <button
                        type="button"
                        onClick={() => setExpandedQuarter(isOpen ? null : update.Quarter)}
                        className="w-full flex justify-between items-center p-4 hover:bg-slate-50/80 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase">
                            {update.Quarter}
                          </span>
                          <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-0.5 rounded-full">
                            {update.ProgressPercentage}% Progress
                          </span>
                        </div>
                        <span className="text-slate-400 text-xs">
                          {isOpen ? "▲" : "▼"}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Achievements</span>
                            <p className="text-sm text-slate-700 mt-1">{update.Achievements || "None recorded."}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Challenges</span>
                            <p className="text-sm text-slate-700 mt-1">{update.Challenges || "None recorded."}</p>
                          </div>
                          {update.EvidenceUrl && (
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Evidence</span>
                              <p className="text-sm mt-1">
                                <a
                                  href={update.EvidenceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-600 hover:text-indigo-800 font-medium underline break-all"
                                >
                                  {update.EvidenceUrl}
                                </a>
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : quarterlyUpdatesError ? (
              <div className="text-xs text-rose-600 bg-rose-50 p-6 rounded-2xl text-center border border-rose-200 font-medium">
                {quarterlyUpdatesError}
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-slate-50 p-6 rounded-2xl text-center border border-dashed border-slate-200 font-medium">
                No quarterly updates logged yet for this goal.
              </div>
            )}
          </div>

          <hr className="border-slate-100 my-6" />

          {/* Sub-Goals Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Associated Sub-Goals</h3>
            {goal.SubGoals?.filter((sub) => sub.SubGoalTitle?.trim()).length > 0 ? (
              <div className="space-y-3">
                {goal.SubGoals
                  .filter((sub) => sub.SubGoalTitle?.trim())
                  .map((sub, index) => (
                    <div
                      key={sub.SubGoalID || index}
                      className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-slate-200/80 rounded-xl bg-white shadow-2xs gap-3"
                    >
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded">
                          Sub-Goal #{sub.SubGoalNo || index + 1}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900">{sub.SubGoalTitle}</h4>
                        {sub.Target && (
                          <p className="text-xs text-slate-500">Target: {sub.Target}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                          Weight: {sub.Weightage}%
                        </span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                          sub.Status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" : "bg-sky-50 text-sky-700 border border-sky-200/60"
                        }`}>
                          {sub.Status}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-slate-50 p-6 rounded-2xl text-center border border-dashed border-slate-200 font-medium">
                No sub-goals added for this goal.
              </div>
            )}
          </div>

          {/* Existing Reviewer Feedback */}
          {goal.ManagerRating && (
            <>
              <hr className="border-slate-100 my-6" />
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-slate-800">Reviewer Feedback</h3>
                <div className="bg-amber-50/40 p-5 rounded-2xl border border-amber-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-lg ${star <= goal.ManagerRating ? "text-amber-400" : "text-slate-200"}`}
                        >
                          ★
                        </span>
                      ))}
                      <span className="ml-2 text-xs font-bold text-amber-900">
                        {goal.ManagerRating} / 5
                      </span>
                    </div>
                    {goal.ReviewedDate && (
                      <span className="text-xs text-slate-400">
                        Reviewed on {new Date(goal.ReviewedDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 text-sm leading-relaxed pt-1">
                    {goal.ManagerComment || "No comments provided."}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Submit Review Form */}
          {canSubmitReview && (
            <>
              <hr className="border-slate-100 my-6" />
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Submit Your Review</h3>
                <div className="bg-indigo-50/30 p-6 rounded-2xl border border-indigo-100 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Rating (1 to 5 Stars)
                    </label>
                    <div className="flex space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setReviewRating(star)}
                          className={`text-2xl transition transform hover:scale-110 focus:outline-hidden ${
                            star <= reviewRating ? "text-amber-400" : "text-slate-200"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Comments
                    </label>
                    <textarea
                      rows="3"
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm text-slate-800 placeholder-slate-400 outline-hidden transition"
                      placeholder="Provide constructive feedback or comments..."
                    />
                  </div>

                  <button
                    onClick={handleSubmitReview}
                    disabled={reviewSubmitting}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-bold text-sm shadow-xs transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                  >
                    {reviewSubmitting ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Bottom Action Section */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
            {goal.GoalStatus === "Draft" ? (
              <Link
                to={`/goals/edit/${goal.GoalID}`}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm shadow-xs transition ml-auto cursor-pointer"
              >
                Edit Goal
              </Link>
            ) : canShowCfoActions ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  CFO approval required:
                </span>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to={`/goals/edit/${goal.GoalID}`}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-center rounded-xl font-bold text-sm shadow-xs transition cursor-pointer"
                  >
                    Edit Goal
                  </Link>
                  <button
                    onClick={() => handleGoalAction("Rejected")}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? "Processing..." : "Reject Goal"}
                  </button>
                  <button
                    onClick={() => handleGoalAction("Approved")}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? "Processing..." : "Approve Goal"}
                  </button>
                </div>
              </div>
            ) : isApproved && !reviewableStatuses.includes(goal.GoalStatus) ? (
              <div className="w-full flex items-center justify-center bg-emerald-50 border border-emerald-200/60 text-emerald-800 py-3 px-4 rounded-xl font-semibold text-sm">
                ✓ This goal has been successfully {goal.GoalStatus}.
              </div>
            ) : canShowApproveReject ? (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between w-full gap-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Review and take action on this goal:
                </span>
                <div className="flex space-x-3">
                  <Link
                    to={`/goals/edit/${goal.GoalID}`}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-center rounded-xl font-bold text-sm shadow-xs transition cursor-pointer"
                  >
                    Modify Goal
                  </Link>
                  <button
                    onClick={() => handleGoalAction("Rejected")}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? "Processing..." : "Reject Goal"}
                  </button>
                  <button
                    onClick={() => handleGoalAction(approvalStatus)}
                    disabled={actionLoading}
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-xs transition disabled:opacity-50 cursor-pointer"
                  >
                    {actionLoading ? "Processing..." : "Approve Goal"}
                  </button>
                </div>
              </div>
            ) : canSubmitReview ? (
              <div className="w-full text-center text-xs font-medium text-slate-400 py-1">
                Please submit your review above to proceed.
              </div>
            ) : (
              <div className="w-full text-center text-xs font-medium text-slate-400 py-1">
                {goal.GoalStatus === "Rejected"
                  ? "This goal has been rejected."
                  : goal.GoalStatus === "HOD Approved"
                    ? "This goal has been approved by HOD."
                    : goal.GoalStatus === "Manager Approved"
                      ? "This goal has been approved by Manager."
                    : "Goal is currently pending review."}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ViewGoal;
