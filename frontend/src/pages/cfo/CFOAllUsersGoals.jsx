import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import {
  getCfoApprovalWindow,
  getFiscalQuarterOptions,
} from "../../utils/fiscalQuarter";
import { canEditGoal } from "../../utils/goalEditability";

const statusBadgeClass = (status) => {
  if (status?.includes("Approved")) return "bg-green-100 text-green-700";
  if (status?.includes("Rejected")) return "bg-red-100 text-red-700";
  if (status === "Submitted") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
};

const normalizedStatus = (status) =>
  String(status || "")
    .trim()
    .toLowerCase();

// This screen only ever returns goals in these statuses (hardcoded
// server-side in getAllEmployeeGoals), so the filter is scoped to match.
const PENDING_STATUS_OPTIONS = [
  "HOD Approved",
  "Manager Approved",
  "Reviewed By HOD",
  "Review By Business Head",
  "Business Head Approved",
  "Approved",
];

const QUARTER_OPTIONS = getFiscalQuarterOptions();

const ACTIONABLE_STATUSES = [
  "hod approved",
  "manager approved",
  "reviewed by hod",
  "review by business head",
];

const isActionable = (goal) =>
  ACTIONABLE_STATUSES.includes(normalizedStatus(goal.GoalStatus));

// One entry per employee, in the order the goals arrived.
const groupGoalsByUser = (goals) => {
  const users = new Map();
  goals.forEach((goal) => {
    if (!users.has(goal.UserID)) {
      users.set(goal.UserID, {
        UserID: goal.UserID,
        name: `${goal.FirstName || ""} ${goal.LastName || ""}`.trim(),
        Designation: goal.Designation,
        goalCount: 0,
        actionableCount: 0,
      });
    }
    const user = users.get(goal.UserID);
    user.goalCount += 1;
    if (isActionable(goal)) user.actionableCount += 1;
  });
  return [...users.values()];
};

const CFOAllUsersGoals = () => {
  const [allGoals, setAllGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingOn, setActingOn] = useState(null);
  // Filters and the selected employee live in the URL so returning from
  // "View details" lands back on the same employee.
  const [searchParams, setSearchParams] = useSearchParams();
  const quarter = searchParams.get("quarter") || "";
  const status = searchParams.get("status") || "";
  const selectedUserId = searchParams.get("user") || "";
  // Employees seen in any load, so the selected employee's name still shows
  // when the filters leave them with no goals.
  const [knownUsers, setKnownUsers] = useState({});
  const approvalWindow = getCfoApprovalWindow();

  const updateParams = (changes) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(changes).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      return next;
    });
  };
  const setQuarter = (value) => updateParams({ quarter: value });
  const setStatus = (value) => updateParams({ status: value });

  const fetchAllGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (quarter) params.quarter = quarter;
      if (status) params.status = status;

      const res = await api.get("/goals/all-employee-goals", { params });
      const goals = res.data.data || [];
      setAllGoals(goals);
      setKnownUsers((prev) => {
        const next = { ...prev };
        groupGoalsByUser(goals).forEach((user) => {
          next[String(user.UserID)] = user;
        });
        return next;
      });
    } catch (err) {
      console.error("Failed to fetch enterprise goals", err);
      setError(err.response?.data?.message || "Failed to load goals.");
    } finally {
      setLoading(false);
    }
  }, [quarter, status]);

  useEffect(() => {
    fetchAllGoals();
  }, [fetchAllGoals]);

  const handleStatusUpdate = async (goalId, goalStatus) => {
    try {
      setActingOn(goalId);
      await api.put(`/goals/status/${goalId}`, { goalStatus });
      setAllGoals((prev) =>
        prev.map((g) =>
          g.GoalID === goalId ? { ...g, GoalStatus: goalStatus } : g,
        ),
      );
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update goal status.");
    } finally {
      setActingOn(null);
    }
  };

  const users = useMemo(() => groupGoalsByUser(allGoals), [allGoals]);
  const selectedUser = selectedUserId ? knownUsers[selectedUserId] : null;
  const selectedGoals = selectedUserId
    ? allGoals.filter((goal) => String(goal.UserID) === selectedUserId)
    : [];

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">
        All Employee Goals
      </h2>

      <div
        className={`mb-6 rounded-lg border p-4 text-sm font-medium ${
          approvalWindow.isOpen
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : "border-amber-200 bg-amber-50 text-amber-900"
        }`}
        role="status"
      >
        {approvalWindow.isOpen
          ? "Your approvals are open through "
          : "Your approvals are open only on quarter days 16-30. This quarter's window is "}
        {approvalWindow.startDate.toLocaleDateString()} through{" "}
        {approvalWindow.endDate.toLocaleDateString()}.
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white shadow rounded-lg p-4 mb-6">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Quarter
          </label>
          <select
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Quarters</option>
            {QUARTER_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Status
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Pending Statuses</option>
            {PENDING_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {(quarter || status) && (
          <div className="flex items-end">
            <button
              onClick={() => updateParams({ quarter: "", status: "" })}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-gray-500">Loading goals...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : !selectedUserId ? (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Designation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Goals
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Awaiting Approval
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length > 0 ? (
                users.map((user) => (
                  <tr
                    key={user.UserID}
                    onClick={() => updateParams({ user: String(user.UserID) })}
                    className="cursor-pointer hover:bg-indigo-50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.Designation || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.goalCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {user.actionableCount > 0 ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                          {user.actionableCount}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="4"
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    No goals match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-200">
            <div>
              <p className="text-base font-semibold text-gray-900">
                {selectedUser?.name || "Selected employee"}
              </p>
              {selectedUser?.Designation && (
                <p className="text-xs text-gray-500">
                  {selectedUser.Designation}
                </p>
              )}
            </div>
            <button
              onClick={() => updateParams({ user: "" })}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              ← All employees
            </button>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Goal Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quarter
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {selectedGoals.length > 0 ? (
                selectedGoals.map((goal) => (
                  <tr key={goal.GoalID}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {goal.GoalTitle}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {goal.Quarter || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(goal.GoalStatus)}`}
                      >
                        {goal.GoalStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {goal.CreatedDate
                        ? new Date(goal.CreatedDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2 items-center">
                        {isActionable(goal) && (
                          <div className="flex gap-2">
                            <button
                              disabled={
                                actingOn === goal.GoalID ||
                                !approvalWindow.isOpen
                              }
                              onClick={() =>
                                handleStatusUpdate(goal.GoalID, "Approved")
                              }
                              className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Approve
                            </button>
                            <button
                              disabled={
                                actingOn === goal.GoalID ||
                                !approvalWindow.isOpen
                              }
                              onClick={() =>
                                handleStatusUpdate(goal.GoalID, "Rejected")
                              }
                              className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        <Link
                          to={`/goals/view/${goal.GoalID}`}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                        >
                          View details
                        </Link>
                        {canEditGoal(goal, true) && (
                          <Link
                            to={`/goals/edit/${goal.GoalID}`}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-4 text-center text-sm text-gray-500"
                  >
                    No goals for this employee match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CFOAllUsersGoals;
