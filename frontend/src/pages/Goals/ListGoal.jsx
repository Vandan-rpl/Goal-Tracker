import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import TableLoader from "../../components/loaders/TableLoader";
import EmptyState from "../../components/EmptyState/EmptyState";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import { Button, Drawer, Tooltip } from "@mui/material";
import api from "../../services/api";
import { getFiscalQuarterOptions } from "../../utils/fiscalQuarter";
import { canEditGoal } from "../../utils/goalEditability";
import { getGoalStatusLabel } from "../../utils/goalStatus";

const STATUS_OPTIONS = [
  "Draft",
  "Submitted",
  "HOD Approved",
  "Reviewed By HOD",
  "Business Head Approved",
  "Review By Business Head",
  "Rejected",
  "Completion Submitted",
  "Completed",
  "Approved",
];

const QUARTER_OPTIONS = getFiscalQuarterOptions();

// 'YYYY-MM-DD' -> 'DD/MM/YYYY'
const formatDateKey = (dateKey) =>
  dateKey ? dateKey.split("-").reverse().join("/") : "N/A";

const ListGoal = () => {
  const navigate = useNavigate();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quarter, setQuarter] = useState("");
  const [status, setStatus] = useState("");

  // From GET /goals/add-status: goal-entry window, target quarter and
  // whether its active goals already total 100%. null while loading.
  const [addStatus, setAddStatus] = useState(null);
  const [addStatusLoaded, setAddStatusLoaded] = useState(false);
  const [bringForwardGoals, setBringForwardGoals] = useState([]);
  const [bringForwardOpen, setBringForwardOpen] = useState(false);

  useEffect(() => {
    let ignore = false;

    const loadAddGoalState = async () => {
      try {
        const [statusRes, bringForwardRes] = await Promise.all([
          api.get("/goals/add-status"),
          api.get("/goals/bring-forward"),
        ]);
        if (ignore) return;
        setAddStatus(statusRes.data?.data || null);
        setBringForwardGoals(bringForwardRes.data?.data?.goals || []);
      } catch (err) {
        // Add Goal falls back to enabled; the Add Goal page and the server
        // still enforce the window and the 100% limit.
        console.error("Error loading Add Goal status", err);
      } finally {
        if (!ignore) setAddStatusLoaded(true);
      }
    };

    loadAddGoalState();
    return () => {
      ignore = true;
    };
  }, []);

  const addGoalDisabledReason = !addStatusLoaded
    ? "Checking whether goals can be added..."
    : addStatus?.reason || "";
  const isWindowOpen = Boolean(addStatus?.window?.isOpen);

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (quarter) params.quarter = quarter;
      if (status) params.status = status;

      const res = await api.get("/goals", { params });
      if (res.data.success) {
        setGoals(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching goals", err);
      setError("Failed to load goals.");
    } finally {
      setLoading(false);
    }
  }, [quarter, status]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleDelete = async (goalId) => {
    if (window.confirm("Are you sure you want to delete this goal?")) {
      try {
        await api.delete(`/goals/${goalId}`);
        setGoals(goals.filter((g) => g.GoalID !== goalId));
      } catch (err) {
        alert(err.response?.data?.message || "Failed to delete goal");
      }
    }
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Goal Management
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              View, track, and manage your performance goals.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isWindowOpen && (
              <button
                type="button"
                onClick={() => setBringForwardOpen(true)}
                disabled={bringForwardGoals.length === 0}
                className="border border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
              >
                Bring forward goals ({bringForwardGoals.length})
              </button>
            )}
            {addGoalDisabledReason ? (
              <Tooltip title={addGoalDisabledReason} arrow>
                {/* Disabled buttons get no pointer events, so the span
                    carries the tooltip. */}
                <span tabIndex={0} className="inline-flex rounded-xl">
                  <button
                    type="button"
                    disabled
                    aria-label={`Add New Goal. ${addGoalDisabledReason}`}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md flex items-center cursor-not-allowed opacity-50 pointer-events-none"
                  >
                    + Add New Goal
                  </button>
                </span>
              </Tooltip>
            ) : (
              <Link
                to="/goals/add"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition flex items-center"
              >
                + Add New Goal
              </Link>
            )}
          </div>
        </div>

        <Drawer
          anchor="right"
          open={bringForwardOpen}
          onClose={() => setBringForwardOpen(false)}
        >
          <div className="flex h-full w-screen max-w-lg flex-col bg-white">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Bring forward goals
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Approved goals ending this quarter or earlier. Select a goal
                  to bring it forward.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBringForwardOpen(false)}
                aria-label="Close"
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-[3.5rem_1fr_5rem_4.5rem_5.5rem] gap-3 border-b border-gray-100 bg-gray-50/75 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <span>No.</span>
                <span>Title</span>
                <span>Quarter</span>
                <span className="text-right">Weight</span>
                <span>End Date</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {bringForwardGoals.map((goal) => (
                  <li key={goal.GoalID}>
                    <button
                      type="button"
                      onClick={() => navigate(`/goals/bring-forward/${goal.GoalID}`)}
                      className="grid w-full grid-cols-[3.5rem_1fr_5rem_4.5rem_5.5rem] items-center gap-3 px-6 py-3.5 text-left text-sm transition hover:bg-indigo-50/60 focus:bg-indigo-50/60 focus:outline-none"
                    >
                      <span className="font-bold text-gray-900">#{goal.GoalNumber}</span>
                      <span className="truncate font-medium text-gray-900" title={goal.GoalTitle}>
                        {goal.GoalTitle}
                      </span>
                      <span className="text-gray-600">{goal.Quarter || "N/A"}</span>
                      <span className="text-right font-semibold text-gray-700">{goal.Weightage}%</span>
                      <span className="text-gray-600">{formatDateKey(goal.Timeline)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Drawer>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Quarter
            </label>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {getGoalStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>

          {(quarter || status) && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setQuarter("");
                  setStatus("");
                }}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Goals Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/75">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Goal No / Title
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Weightage
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="p-0">
                      <TableLoader
                        rows={5}
                        columns={6}
                        showToolbar={false}
                        paper={false}
                      />
                    </td>
                  </tr>
                ) : goals.length > 0 ? (
                  goals.map((goal) => (
                    <tr
                      key={goal.GoalID}
                      className="hover:bg-gray-50/50 transition"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900">
                          #{goal.GoalNumber} - {goal.GoalTitle}
                        </div>
                        <div className="text-xs text-gray-400">
                          Timeline:{" "}
                          {goal.Timeline
                            ? new Date(goal.Timeline).toLocaleDateString()
                            : "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {goal.GoalCategory || "General"}
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
                            goal.GoalStatus === "Approved" ||
                            goal.GoalStatus === "Completed"
                              ? "bg-emerald-100 text-emerald-800"
                              : goal.GoalStatus === "Completion Submitted"
                                ? "bg-sky-100 text-sky-800"
                                : goal.GoalStatus === "Submitted"
                                  ? "bg-indigo-100 text-indigo-800"
                                  : goal.GoalStatus === "Rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {getGoalStatusLabel(goal.GoalStatus)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <Link
                          to={`/goals/view/${goal.GoalID}`}
                          className="text-indigo-600 hover:text-indigo-900 font-semibold"
                        >
                          View
                        </Link>

                        {goal.IsGoalOwner && canEditGoal(goal) && (
                          <Link
                            to={`/goals/edit/${goal.GoalID}`}
                            className="text-blue-600 hover:text-blue-900 font-semibold"
                          >
                            Edit
                          </Link>
                        )}

                        {goal.IsGoalOwner && goal.GoalStatus === "Draft" && (
                          <button
                            onClick={() => handleDelete(goal.GoalID)}
                            className="text-red-600 hover:text-red-900 font-semibold"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-0">
                      <EmptyState
                        icon={<AssignmentOutlinedIcon sx={{ fontSize: 40 }} />}
                        title="No goals found"
                        description="No goals match the selected filters."
                        action={
                          <Button
                            component={Link}
                            to="/goals/add"
                            size="small"
                            disabled={Boolean(addGoalDisabledReason)}
                          >
                            Add New Goal
                          </Button>
                        }
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

export default ListGoal;
