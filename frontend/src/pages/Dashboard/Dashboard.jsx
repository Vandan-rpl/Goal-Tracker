import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronDown,
  Calendar,
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Filter,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getEmployeeGoals } from "../../services/dashboardService";

// ---------------------------------------------------------------------------
// STATUS STYLING — mapped to the real GoalStatus enum values.
// Sub-goal-driven progress isn't available from getGoals yet, so progress is
// derived purely from GoalStatus for now: Completed = 100%, everything else
// = 0%. Swap this out once GoalSubGoal rows (with Weightage + Status) are
// included in the API response.
// ---------------------------------------------------------------------------
const STATUS_STYLES = {
  "Draft": { bg: "bg-gray-100", text: "text-gray-600", ring: "ring-gray-200", bar: "bg-gray-400", icon: Clock },
  "Submitted": { bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200", bar: "bg-indigo-500", icon: Clock },
  "Running": { bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200", bar: "bg-indigo-500", icon: Clock },
  "HOD Approved": { bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-200", bar: "bg-teal-500", icon: CheckCircle2 },
  "Manager Approved": { bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-200", bar: "bg-teal-500", icon: CheckCircle2 },
  "Reviewed By HOD": { bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-200", bar: "bg-teal-500", icon: Clock },
  "Business Head Approved": { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", bar: "bg-emerald-500", icon: CheckCircle2 },
  "Review By Business Head": { bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-200", bar: "bg-teal-500", icon: Clock },
  "Approved": { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", bar: "bg-emerald-500", icon: CheckCircle2 },
  "Completed": { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", bar: "bg-emerald-500", icon: CheckCircle2 },
  "Rejected": { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200", bar: "bg-red-500", icon: XCircle },
  "Cancelled": { bg: "bg-gray-100", text: "text-gray-500", ring: "ring-gray-200", bar: "bg-gray-400", icon: XCircle },
  "Postpone": { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", bar: "bg-amber-400", icon: AlertTriangle },
};
const DEFAULT_STATUS_STYLE = STATUS_STYLES["Draft"];

const PRIORITY_STYLES = {
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-gray-100 text-gray-600",
};

function progressFromStatus(status) {
  return status === "Completed" ? 100 : 0;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// GOAL CARD
// ---------------------------------------------------------------------------
function GoalCard({ goal }) {
  const [open, setOpen] = useState(false);
  const style = STATUS_STYLES[goal.GoalStatus] || DEFAULT_STATUS_STYLE;
  const StatusIcon = style.icon;
  const progress = progressFromStatus(goal.GoalStatus);
  const days = daysUntil(goal.Timeline);
  const overdue = days !== null && days < 0 && goal.GoalStatus !== "Completed" && goal.GoalStatus !== "Cancelled";

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-400">#{goal.GoalNumber}</span>
            {goal.Priority && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[goal.Priority] || PRIORITY_STYLES.Low}`}>
                {goal.Priority}
              </span>
            )}
            {goal.GoalCategory && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {goal.GoalCategory}
              </span>
            )}
            {goal.CrossFunctionalGoal && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 flex items-center gap-1">
                <Users size={12} /> Shared
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-gray-900 truncate">{goal.GoalTitle}</h3>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {formatDate(goal.Timeline)}
            </span>
            {days !== null && (
              <span className={overdue ? "text-red-600 font-medium" : ""}>
                {overdue ? `${Math.abs(days)}d overdue` : goal.GoalStatus === "Completed" ? "Done" : `${days}d left`}
              </span>
            )}
            {goal.Weightage != null && <span>Weight {goal.Weightage}%</span>}
          </div>
        </div>

        <div className="flex items-center gap-4 sm:w-64">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className={`font-medium ${style.text} flex items-center gap-1`}>
                <StatusIcon size={13} />
                {goal.GoalStatus}
              </span>
              <span className="text-gray-500">{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${style.bar} transition-all`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <ChevronDown
            size={18}
            className={`text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="px-5 sm:px-6 pb-6 pt-1 border-t border-gray-100 space-y-5">
          {goal.GoalDescription && (
            <p className="text-sm text-gray-600 leading-relaxed">{goal.GoalDescription}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 mb-1">Meet target</p>
              <p className="text-sm text-gray-800">{goal.MeetPerformance || "—"}</p>
            </div>
            <div className="bg-indigo-50/60 rounded-xl p-4">
              <p className="text-xs font-semibold text-indigo-400 mb-1">Exceed target</p>
              <p className="text-sm text-gray-800">{goal.ExceedPerformance || "—"}</p>
            </div>
          </div>

          {goal.Measurability && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 mb-1">Measurability</p>
              <p className="text-sm text-gray-800">{goal.Measurability}</p>
              {goal.ValidationSource && (
                <p className="text-xs text-gray-400 mt-2">Source: {goal.ValidationSource}</p>
              )}
            </div>
          )}

          {goal.CrossFunctionalGoal && goal.JointAccountability && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Users size={12} /> Joint accountability: {goal.JointAccountability}
            </p>
          )}

          {/* Sub-goals: not returned by GET /api/v1/goals yet — see dashboardService.js note. */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
            Sub-goals aren't loaded yet — this goal's progress is currently based on its status only,
            not a sub-goal rollup.
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD
// ---------------------------------------------------------------------------
export default function GoalDashboard() {
  const { user } = useAuth();
  const isAuthReady = !!user;

  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchGoals = useCallback(async () => {
    if (!isAuthReady) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getEmployeeGoals();
      setGoals(data || []);
    } catch (err) {
      setError(
        err?.response?.status === 404
          ? "No goals found for your account yet."
          : err?.response?.data?.message || "Couldn't load your goals. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [isAuthReady]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const overallProgress = useMemo(() => {
    const totalWeight = goals.reduce((s, g) => s + (g.Weightage || 0), 0);
    const achieved = goals.reduce((s, g) => s + (g.Weightage || 0) * (progressFromStatus(g.GoalStatus) / 100), 0);
    return totalWeight ? Math.round((achieved / totalWeight) * 100) : 0;
  }, [goals]);

  const statusCounts = useMemo(() => {
    const c = {};
    goals.forEach((g) => {
      c[g.GoalStatus] = (c[g.GoalStatus] || 0) + 1;
    });
    return c;
  }, [goals]);

  const filtered = statusFilter === "All" ? goals : goals.filter((g) => g.GoalStatus === statusFilter);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Loader2 size={18} className="animate-spin" />
          Loading your goals...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle size={28} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchGoals}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 cursor-pointer"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        <div>
          <p className="text-xs font-medium text-gray-400 mb-1">Your goals</p>
          <h1 className="text-2xl font-bold text-gray-900">My Goals</h1>
        </div>

        {/* Summary strip */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <path
                  className="text-gray-100"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-indigo-600"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeDasharray={`${overallProgress}, 100`}
                  strokeLinecap="round"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-900">{overallProgress}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Weighted progress</p>
              <p className="text-xs text-gray-400">Across {goals.length} goals, by weightage · status-based for now</p>
            </div>
          </div>

          {/* Status filter dropdown — 12 possible GoalStatus values is too many for a tile grid */}
          <div className="flex-1 flex items-center gap-2">
            <Filter size={14} className="text-gray-400 shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="All">All statuses ({goals.length})</option>
              {Object.entries(statusCounts).map(([status, count]) => (
                <option key={status} value={status}>
                  {status} ({count})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Goal list */}
        <div className="space-y-4">
          {filtered.map((goal) => (
            <GoalCard key={goal.GoalID} goal={goal} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">No goals match this filter.</div>
          )}
        </div>
      </div>
    </div>
  );
}