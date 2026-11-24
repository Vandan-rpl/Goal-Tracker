import React, { useState, useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  getCurrentFiscalQuarterValue,
  getFiscalQuarterOptions,
  formatQuarterLabel,
} from "../../utils/fiscalQuarter";
import useAuth from "../../hooks/useAuth";
import CompletionRequests from "../../components/GoalCompletion/CompletionRequests";
import { formatDisplayDate } from "../../utils/dateTime";
import { getGoalStatusLabel } from "../../utils/goalStatus";
import { getRoleLabel } from "../../utils/roleLabel";
import { getGoalReviewActions } from "../../utils/goalReviewActions";
import api from "../../services/api";

const MAX_GOALS_PER_QUARTER = 8;

// One colour per goal status, so the stage is readable at a glance:
// waiting for a decision (amber/sky/violet), approved and in progress
// (blue), completion stages (cyan/green), rejected (red).
const STATUS_BADGE_CLASSES = {
  Submitted: "bg-amber-100 text-amber-800",
  "Manager Approved": "bg-sky-100 text-sky-800",
  "HOD Approved": "bg-sky-100 text-sky-800",
  "Reviewed By HOD": "bg-sky-100 text-sky-800",
  "Business Head Approved": "bg-violet-100 text-violet-800",
  "Review By Business Head": "bg-violet-100 text-violet-800",
  Approved: "bg-blue-100 text-blue-800",
  Running: "bg-blue-100 text-blue-800",
  "Completion Submitted": "bg-cyan-100 text-cyan-800",
  Completed: "bg-emerald-100 text-emerald-800",
  Postpone: "bg-orange-100 text-orange-800",
  Rejected: "bg-red-100 text-red-800",
  Cancelled: "bg-gray-200 text-gray-700",
};
const DEFAULT_STATUS_BADGE_CLASS = "bg-gray-100 text-gray-800";
const QUARTER_OPTIONS = getFiscalQuarterOptions();

// Dot on a row (CFO only): this user has a goal waiting for approval, or
// someone below them in the tree does (shown on every manager above them).
const PendingDot = ({ user }) => {
  const own = Boolean(user.HasPendingGoals);
  const team = Boolean(user.TeamHasPendingGoals);
  if (!own && !team) return null;

  const title = own && team
    ? "Goal waiting for approval, also in their team"
    : own
      ? "Goal waiting for approval"
      : "A team member has a goal waiting for approval";

  return (
    <span
      title={title}
      aria-label={title}
      className="ml-2 inline-block h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-amber-100 align-middle"
    />
  );
};

// Recursive row component: renders one user, and — if expanded — renders
// its own direct reports as nested TeamRow instances underneath it.
const TeamRow = ({ user, depth, onViewGoals, showPending }) => {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && !fetchedOnce) {
      setLoadingChildren(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/teams/members/${user.UserID}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          },
        );

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server returned non-JSON response.");
        }

        const result = await response.json();
        if (result.success) {
          setChildren(result.data);
        }
        setFetchedOnce(true);
      } catch (error) {
        console.error("Error fetching sub-team:", error);
      } finally {
        setLoadingChildren(false);
      }
    }
    setExpanded((prev) => !prev);
  };

  return (
    <>
      <tr className="hover:bg-gray-50 transition">
        <td
          className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
          style={{ paddingLeft: `${depth * 24 + 24}px` }}
        >
          {user.HasDirectReports ? (
            <button
              onClick={toggleExpand}
              className="mr-2 w-4 inline-block text-gray-500 hover:text-gray-800"
            >
              {expanded ? "▾" : "▸"}
            </button>
          ) : (
            <span className="mr-2 w-4 inline-block"></span>
          )}
          {user.FirstName} {user.LastName}
          {showPending && <PendingDot user={user} />}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {user.Designation || getRoleLabel(user.Role)}
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
          <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold">
            {user.TotalGoals} Submitted
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button
            onClick={() =>
              onViewGoals(user.UserID, `${user.FirstName} ${user.LastName}`)
            }
            className="text-indigo-600 hover:text-indigo-900 font-semibold bg-indigo-50 px-3 py-1.5 rounded-md transition hover:bg-indigo-100 cursor-pointer"
          >
            View Goals
          </button>
        </td>
      </tr>

      {loadingChildren && (
        <tr>
          <td
            colSpan="4"
            className="px-6 py-2 text-center text-xs text-gray-400"
          >
            Loading team...
          </td>
        </tr>
      )}

      {expanded &&
        children.map((child) => (
          <TeamRow
            key={child.UserID}
            user={child}
            depth={depth + 1}
            onViewGoals={onViewGoals}
            showPending={showPending}
          />
        ))}
    </>
  );
};

// Logged-in user's id from the JWT (same approach as Final Evaluation).
const getLoggedInUserId = () => {
  try {
    const token = localStorage.getItem("token");
    return token ? jwtDecode(token).userId : null;
  } catch {
    return null;
  }
};

const TeamManagement = () => {
  const { user } = useAuth();
  const loggedInUserId = getLoggedInUserId();
  const role = String(user?.Role || user?.role || "").toUpperCase();
  const [users, setUsers] = useState([]);
  // The user whose goals are open is kept in the URL (?userId=&name=), so
  // "Back to Goals" on a goal page returns to that user's goals, not the list.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedUserId = searchParams.get("userId");
  const selectedUser = useMemo(
    () =>
      selectedUserId
        ? { id: selectedUserId, name: searchParams.get("name") || "" }
        : null,
    [selectedUserId, searchParams],
  );
  // Quarter filter for the user's goals ("" = all), also kept in the URL.
  const quarterFilter = searchParams.get("quarter") || "";

  const setQuarterFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("quarter", value);
    else next.delete("quarter");
    setSearchParams(next, { replace: true });
  };
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const filteredGoals = useMemo(
    () =>
      quarterFilter
        ? goals.filter((goal) => goal.Quarter === quarterFilter)
        : goals,
    [goals, quarterFilter],
  );

  // Allocation of the filtered quarter, or the current one when showing all.
  const quarterGoalSummary = useMemo(() => {
    const quarter = quarterFilter || getCurrentFiscalQuarterValue();
    const activeQuarterGoals = goals.filter(
      (goal) =>
        goal.Quarter === quarter &&
        !["Rejected", "Cancelled"].includes(goal.GoalStatus),
    );
    const allocatedHundredths = activeQuarterGoals.reduce((total, goal) => {
      const weightage = Number(goal.Weightage);
      return (
        total + (Number.isFinite(weightage) ? Math.round(weightage * 100) : 0)
      );
    }, 0);

    return {
      quarter,
      goalCount: activeQuarterGoals.length,
      allocatedPercentage: allocatedHundredths / 100,
      remainingPercentage: Math.max(0, 10000 - allocatedHundredths) / 100,
    };
  }, [goals, quarterFilter]);

  useEffect(() => {
    fetchTeamUsers();
  }, []);

  const fetchTeamUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/teams/members`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(
          "Server returned non-JSON response (HTML page). Check backend route or URL.",
        );
      }

      const result = await response.json();
      if (result.success) {
        setUsers(result.data);
      } else {
        setErrorMsg(result.message || "Failed to fetch team members");
      }
    } catch (error) {
      console.error("Error fetching team users:", error);
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleViewGoals = (userId, userName) => {
    setSearchParams({ userId: String(userId), name: userName });
  };

  const fetchUserGoals = async (userId) => {
    setGoals([]);
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/teams/user-goals/${userId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response for user goals.");
      }

      const result = await response.json();

      if (result.success) {
        setGoals(result.data);
      } else {
        setGoals([]);
      }
    } catch (error) {
      console.error("Error fetching user goals:", error);
    } finally {
      setLoading(false);
    }
  };

  // Approve / Reject from the list: same call as the goal page.
  const [actionGoalId, setActionGoalId] = useState(null);
  const handleGoalAction = async (goal, newStatus, verb) => {
    if (!window.confirm(`Are you sure you want to ${verb} "${goal.GoalTitle}"?`)) return;
    try {
      setActionGoalId(goal.GoalID);
      const response = await api.put(`/goals/status/${goal.GoalID}`, {
        goalStatus: newStatus,
      });
      if (response.data.success) {
        await fetchUserGoals(selectedUserId);
      } else {
        alert(response.data.message || "Failed to update status.");
      }
    } catch (error) {
      alert(error.response?.data?.message || "Server error while updating status.");
    } finally {
      setActionGoalId(null);
    }
  };

  // Load the goals of the user in the URL (also when coming back to it).
  useEffect(() => {
    if (selectedUserId) fetchUserGoals(selectedUserId);
  }, [selectedUserId]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Goal Review & approval
        </h2>
      </div>

      {errorMsg && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md text-sm">
          {errorMsg}
        </div>
      )}

      {/* /teams/members returns only people whose Reporting Manager or HOD
          is the logged-in user (except for the CFO's root view). */}
      {!selectedUser && role !== "BUSINESSHEAD" && users.length > 0 && (
        <CompletionRequests />
      )}

      {!selectedUser ? (
        <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    User Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    Post / Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    Submitted Goals
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-12 text-center text-sm text-gray-500"
                    >
                      Loading team members...
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <TeamRow
                      key={user.UserID}
                      user={user}
                      depth={0}
                      onViewGoals={handleViewGoals}
                      showPending={role === "BUSINESSHEAD"}
                    />
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      className="px-6 py-12 text-center text-sm text-gray-500"
                    >
                      No team members found under your management.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">
              Goals for:{" "}
              <span className="text-indigo-600">{selectedUser.name}</span>
              <span className="ml-2 text-xs font-normal text-gray-500">
                {formatQuarterLabel(quarterGoalSummary.quarter)}:{" "}
                {quarterGoalSummary.allocatedPercentage.toFixed(2)}% allocated,{" "}
                {quarterGoalSummary.remainingPercentage.toFixed(2)}% remaining ·{" "}
                {quarterGoalSummary.goalCount}/{MAX_GOALS_PER_QUARTER} goals
              </span>
            </h3>
            <div className="flex items-center gap-3">
              {/* Nobody can view their own Final Evaluation. */}
              {Number(selectedUser.id) !== Number(loggedInUserId) && (
                <Link
                  to={`/goals/final-evaluation/${selectedUser.id}`}
                  className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-100 font-semibold transition"
                >
                  View Final Evaluation
                </Link>
              )}
              <button
                onClick={() => setSearchParams({})}
                className="text-sm bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-300 font-medium transition"
              >
                &larr; Back to Team List
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="w-full sm:w-72">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Quarter
              </label>
              <select
                value={quarterFilter}
                onChange={(e) => setQuarterFilter(e.target.value)}
                className="w-full border border-gray-200 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Quarters</option>
                {QUARTER_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {quarterFilter && (
              <button
                onClick={() => setQuarterFilter("")}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Clear filter
              </button>
            )}
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/75">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Goal No / Description
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Start Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Due Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Weightage
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Priority
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="px-6 py-12 text-center text-sm text-gray-500"
                      >
                        Loading goals...
                      </td>
                    </tr>
                  ) : filteredGoals.length > 0 ? (
                    filteredGoals.map((goal) => (
                      <tr
                        key={goal.GoalID}
                        className="hover:bg-gray-50/50 transition"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-bold text-gray-900">
                            #{goal.GoalNumber} - {goal.GoalTitle}
                          </div>
                          <div className="text-xs text-gray-400">
                            Created:{" "}
                            {goal.SubmittedDate || goal.CreatedDate
                              ? formatDisplayDate(goal.SubmittedDate || goal.CreatedDate)
                              : "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {goal.StartDate ? formatDisplayDate(goal.StartDate) : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {goal.Timeline ? formatDisplayDate(goal.Timeline) : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                          {goal.Weightage}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              goal.Priority === "High"
                                ? "bg-orange-100 text-orange-800"
                                : goal.Priority === "Medium"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {goal.Priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              STATUS_BADGE_CLASSES[goal.GoalStatus] || DEFAULT_STATUS_BADGE_CLASS
                            }`}
                          >
                            {getGoalStatusLabel(goal.GoalStatus)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                          {(() => {
                            const actions = getGoalReviewActions(goal, role);
                            const busy = actionGoalId === goal.GoalID;
                            return (
                              <>
                                <Link
                                  to={`/goals/view/${goal.GoalID}`}
                                  className="text-indigo-600 hover:text-indigo-900 font-semibold"
                                >
                                  View
                                </Link>
                                {actions.canEdit && (
                                  <Link
                                    to={`/goals/edit/${goal.GoalID}`}
                                    className="text-gray-700 hover:text-gray-900 font-semibold"
                                  >
                                    Edit
                                  </Link>
                                )}
                                {actions.canApproveReject && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        handleGoalAction(goal, actions.approveStatus, "approve")
                                      }
                                      className="text-emerald-600 hover:text-emerald-800 font-semibold disabled:opacity-50 cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() =>
                                        handleGoalAction(goal, "Rejected", "reject")
                                      }
                                      className="text-rose-600 hover:text-rose-800 font-semibold disabled:opacity-50 cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="7"
                        className="px-6 py-12 text-center text-sm text-gray-500"
                      >
                        {quarterFilter
                          ? "No goals found for this user in the selected quarter."
                          : "No active goals found for this user."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
