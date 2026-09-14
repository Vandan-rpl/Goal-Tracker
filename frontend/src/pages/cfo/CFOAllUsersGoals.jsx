import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

const statusBadgeClass = (status) => {
  if (status?.includes("Approved")) return "bg-green-100 text-green-700";
  if (status?.includes("Rejected")) return "bg-red-100 text-red-700";
  if (status === "Submitted") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-700";
};

const normalizedStatus = (status) => String(status || "").trim().toLowerCase();

const CFOAllUsersGoals = () => {
  const [allGoals, setAllGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingOn, setActingOn] = useState(null);

  useEffect(() => {
    fetchAllGoals();
  }, []);

  const fetchAllGoals = async () => {
    try {
      setLoading(true);
      const res = await api.get("/goals/all-employee-goals");
      setAllGoals(res.data.data || []);
    } catch (err) {
      console.error("Failed to fetch enterprise goals", err);
      setError(err.response?.data?.message || "Failed to load goals.");
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-800 mb-6">
        Enterprise-Wide Goals Overview (CFO Access)
      </h2>

      {loading ? (
        <p className="text-gray-500">Loading goals...</p>
      ) : error ? (
        <p className="text-red-600">{error}</p>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Goal Title
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
              {allGoals.length > 0 ? (
                allGoals.map((goal) => (
                  <tr key={goal.GoalID}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {goal.FirstName} {goal.LastName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {goal.GoalTitle}
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
                        {[
                          "hod approved",
                          "reviewed by hod",
                          "review by business head",
                          "business head approved",
                        ].includes(normalizedStatus(goal.GoalStatus)) && (
                          <div className="flex gap-2">
                            <button
                              disabled={actingOn === goal.GoalID}
                              onClick={() =>
                                handleStatusUpdate(goal.GoalID, "Approved")
                              }
                              className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Approve
                            </button>

                            <button
                              disabled={actingOn === goal.GoalID}
                              onClick={() =>
                                handleStatusUpdate(goal.GoalID, "Rejected")
                              }
                              className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
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
                        <Link
                          to={`/goals/edit/${goal.GoalID}`}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          Edit
                        </Link>
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
                    No organization data found.
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
