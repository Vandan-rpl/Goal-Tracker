import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import { Button } from "@mui/material";
import api from "../../services/api";
import TableLoader from "../../components/loaders/TableLoader";
import EmptyState from "../../components/EmptyState/EmptyState";

const JointGoals = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchJointGoals = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await api.get("/goals/joint-accountability");
        if (response.data.success) setGoals(response.data.data || []);
      } catch (err) {
        console.error("Error fetching joint goals", err);
        setError(err.response?.data?.message || "Failed to load joint goals.");
      } finally {
        setLoading(false);
      }
    };

    fetchJointGoals();
  }, []);

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">My Joint Goals</h1>
          <p className="text-sm text-gray-500 mt-1">Goals where you are a joint accountability participant.</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/75">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Goal</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">My Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Goal Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-0">
                      <TableLoader rows={5} columns={5} showToolbar={false} paper={false} />
                    </td>
                  </tr>
                ) : goals.length > 0 ? (
                  goals.map((goal) => (
                    <tr key={goal.JointAccountabilityID} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 min-w-64">
                        <div className="text-sm font-bold text-gray-900">#{goal.GoalNumber} - {goal.GoalTitle}</div>
                        <div className="text-xs text-gray-400">{goal.GoalCategory || "General"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {[goal.OwnerFirstName, goal.OwnerLastName].filter(Boolean).join(" ") || "Unknown"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-full ${
                          goal.JointStatus === "Accepted" ? "bg-emerald-100 text-emerald-800" :
                          goal.JointStatus === "Declined" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {goal.JointStatus || "Pending"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {goal.GoalStatus || "Draft"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link to={`/goals/view/${goal.GoalID}`} className="text-indigo-600 hover:text-indigo-900 font-semibold">View</Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-0">
                      <EmptyState
                        icon={<AssignmentOutlinedIcon sx={{ fontSize: 40 }} />}
                        title="No joint goals"
                        description="You have no joint accountability assignments."
                        action={<Button component={Link} to="/goals" size="small">View owned goals</Button>}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JointGoals;