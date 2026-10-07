import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
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
  Plus,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getEmployeeGoals } from "../../services/dashboardService";
import { getCurrentFiscalQuarterValue } from "../../utils/fiscalQuarter";

const MAX_GOALS_PER_QUARTER = 8;
const STATUS_GROUPS = {
  Draft: ["draft"],
  "Pending approval": [
    "submitted",
    "manager approved",
    "hod approved",
    "reviewed by hod",
    "review by business head",
  ],
  Approved: ["approved", "business head approved", "running"],
  Rejected: ["rejected"],
  Completed: ["completed"],
};

// ---------------------------------------------------------------------------
// STATUS STYLING — mapped to the real GoalStatus enum values.
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

function normalizeGoalStatus(status) {
  return String(status || "Draft").trim().toLowerCase();
}

function progressFromStatus(status) {
  return normalizeGoalStatus(status) === "completed" ? 100 : 0;
}

function progressFromGoal(goal) {
  const completion = Number(goal.SubGoalCompletionPercentage);
  return Number.isFinite(completion)
    ? Math.max(0, Math.min(100, completion))
    : progressFromStatus(goal.GoalStatus);
}

function getDateOnly(dateStr) {
  if (!dateStr) return null;

  const dateMatch = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    return {
      year: Number(dateMatch[1]),
      month: Number(dateMatch[2]),
      day: Number(dateMatch[3]),
    };
  }

  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

function daysUntil(dateStr) {
  const date = getDateOnly(dateStr);
  if (!date) return null;

  const today = new Date();
  const targetDay = Date.UTC(date.year, date.month - 1, date.day);
  const todayDay = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.round((targetDay - todayDay) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = getDateOnly(dateStr);
  if (!date) return "—";
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString(
    "en-IN",
    { day: "numeric", month: "short", year: "numeric" },
  );
}

// ---------------------------------------------------------------------------
// GOAL CARD
// ---------------------------------------------------------------------------
function GoalCard({ goal }) {
  const [open, setOpen] = useState(false);
  const isCompleted = normalizeGoalStatus(goal.GoalStatus) === "completed";
  const style = isCompleted
    ? STATUS_STYLES.Completed
    : STATUS_STYLES[goal.GoalStatus] || DEFAULT_STATUS_STYLE;
  const StatusIcon = style.icon;
  const progress = progressFromGoal(goal);
  const displayedTimeline = goal.DashboardTimeline || goal.Timeline;
  const days = daysUntil(displayedTimeline);
  const normalizedStatus = normalizeGoalStatus(goal.GoalStatus);
  const overdue = days !== null && days < 0 && !["completed", "cancelled"].includes(normalizedStatus);

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
              {formatDate(displayedTimeline)}
            </span>
            {days !== null && (
              <span className={overdue ? "text-red-600 font-medium" : ""}>
                {overdue ? `${Math.abs(days)}d overdue` : isCompleted ? "Done" : `${days}d left`}
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
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchGoals = useCallback(async () => {
    if (!isAuthReady) return;
    setLoading(true);
    setError(null);
    try {
      const dashboard = await getEmployeeGoals();
      setGoals(dashboard.goals || []);
      setDashboardSummary(dashboard.summary || null);
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

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") fetchGoals();
    };

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [fetchGoals]);

  const statusCounts = useMemo(() => {
    const c = {};
    goals.forEach((g) => {
      c[g.GoalStatus] = (c[g.GoalStatus] || 0) + 1;
    });
    return c;
  }, [goals]);

  const currentQuarterAllocation = useMemo(() => {
    if (dashboardSummary?.currentQuarterWeightage) {
      return dashboardSummary.currentQuarterWeightage;
    }
    return {
      quarter: getCurrentFiscalQuarterValue(),
      goalCount: 0,
      allocated: 0,
      achieved: 0,
      unallocated: 100,
    };
  }, [dashboardSummary]);

  const currentQuarterAllocated = Math.round(
    Number(currentQuarterAllocation.allocated || 0),
  );
  const currentQuarterAchieved = Math.round(
    Number(currentQuarterAllocation.achieved || 0),
  );
  const currentQuarterUnallocated = Math.round(
    Number(currentQuarterAllocation.unallocated || 0),
  );

  const goalStatusCounts =
    dashboardSummary?.goalStatusCounts ||
    Object.fromEntries(
      Object.entries(STATUS_GROUPS).map(([group, statuses]) => [
        group,
        goals.filter((goal) =>
          statuses.includes(normalizeGoalStatus(goal.GoalStatus)),
        ).length,
      ]),
    );
  const subGoalStatusCounts = dashboardSummary?.subGoalStatusCounts || {
    completed: 0,
    inProgress: 0,
    pending: 0,
  };
  const filtered =
    statusFilter === "All"
      ? goals
      : goals.filter((goal) => {
          const groupStatuses = STATUS_GROUPS[statusFilter];
          return groupStatuses
            ? groupStatuses.includes(normalizeGoalStatus(goal.GoalStatus))
            : goal.GoalStatus === statusFilter;
        });

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

        <section
          className="rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm"
          aria-label={`${currentQuarterAllocation.quarter} progress`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-gray-800">
              {currentQuarterAllocation.quarter} progress
            </p>
            <p className="shrink-0 text-xs font-medium text-gray-500">
              {currentQuarterAllocation.goalCount} of {MAX_GOALS_PER_QUARTER} goals
            </p>
          </div>

          {currentQuarterAllocation.goalCount === 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-400">
                No goals added for this quarter yet
              </p>
              <Link
                to="/goals/add"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
              >
                <Plus size={15} />
                Create Goal
              </Link>
            </div>
          ) : (
            <>
              <div
                className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-100"
                role="progressbar"
                aria-label="Quarterly goal weightage allocated"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, currentQuarterAllocation.allocated)}
                aria-valuetext={`Allocated ${currentQuarterAllocated}%, achieved ${currentQuarterAchieved}%`}
              >
                <div
                  className="relative h-full rounded-full bg-indigo-200 transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, currentQuarterAllocation.allocated))}%`,
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-indigo-600 transition-all"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          currentQuarterAllocation.allocated,
                          currentQuarterAllocation.achieved,
                        ),
                      ) / Math.max(0.01, currentQuarterAllocation.allocated) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-200" />
                  Allocated {currentQuarterAllocated}%
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-600" />
                  Achieved {currentQuarterAchieved}%
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-gray-100 ring-1 ring-gray-200" />
                  {currentQuarterUnallocated}% unallocated
                </span>
              </div>
            </>
          )}
        </section>

        {dashboardSummary?.carryForward?.windowOpen && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold">Carry-forward window is open</p>
              <p className="mt-1 text-xs text-amber-800">
                {dashboardSummary.carryForward.eligibleGoalCount} eligible{" "}
                {dashboardSummary.carryForward.eligibleGoalCount === 1
                  ? "goal is"
                  : "goals are"}{" "}
                available to carry forward.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800">Goal status</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(STATUS_GROUPS).map(([group]) => (
                <a
                  key={group}
                  href="#goal-list"
                  onClick={() => setStatusFilter(group)}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-3 transition hover:border-indigo-200 hover:bg-indigo-50"
                >
                  <span className="block text-xs text-gray-500">{group}</span>
                  <span className="mt-1 block text-xl font-bold text-gray-900">
                    {goalStatusCounts[group] || 0}
                  </span>
                </a>
              ))}
            </div>
            {goals.length === 0 && (
              <p className="mt-3 text-xs text-gray-400">No goals to summarize yet.</p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800">
              Sub-goal progress · {currentQuarterAllocation.quarter}
            </h2>
            {currentQuarterAllocation.goalCount === 0 ? (
              <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-400">
                No goals in this quarter yet.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  ["Completed", subGoalStatusCounts.completed, "text-emerald-700"],
                  ["In Progress", subGoalStatusCounts.inProgress, "text-indigo-700"],
                  ["Pending", subGoalStatusCounts.pending, "text-gray-600"],
                ].map(([label, count, color]) => (
                  <div key={label} className="rounded-xl bg-gray-50 p-3">
                    <span className="block text-xs text-gray-500">{label}</span>
                    <span className={`mt-1 block text-xl font-bold ${color}`}>
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800">Needs attention</h2>
            {dashboardSummary?.needsAttention?.length ? (
              <ul className="mt-3 divide-y divide-gray-100">
                {dashboardSummary.needsAttention.map((goal) => (
                  <li key={goal.GoalID} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      to={`/goals/view/${goal.GoalID}`}
                      className="flex items-center justify-between gap-3 text-sm hover:text-indigo-700"
                    >
                      <span className="truncate font-medium text-gray-800">
                        {goal.GoalTitle}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        goal.AttentionReason === "Rejected"
                          ? "bg-red-50 text-red-700"
                          : goal.AttentionReason === "Overdue"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-gray-100 text-gray-600"
                      }`}>
                        {goal.AttentionReason}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-400">
                No goals need attention.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-800">Upcoming deadlines</h2>
            {dashboardSummary?.upcomingDeadlines?.length ? (
              <ul className="mt-3 divide-y divide-gray-100">
                {dashboardSummary.upcomingDeadlines.map((goal) => (
                  <li key={goal.GoalID} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      to={`/goals/view/${goal.GoalID}`}
                      className="flex items-center justify-between gap-3 text-sm hover:text-indigo-700"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">
                          {goal.GoalTitle}
                        </span>
                        <span className="mt-0.5 block text-xs text-gray-400">
                          {formatDate(goal.Timeline)} · {goal.DaysUntilDeadline === 0
                            ? "Due today"
                            : `${goal.DaysUntilDeadline}d left`}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-indigo-700">
                        {progressFromGoal(goal)}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-400">
                No deadlines in the next 14 days.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:col-span-2">
            <h2 className="text-sm font-semibold text-gray-800">Quarter history</h2>
            {dashboardSummary?.quarterHistory?.some(
              (quarter) =>
                quarter.allocatedPercentage > 0 ||
                quarter.achievedPercentage > 0 ||
                quarter.completedGoals > 0 ||
                quarter.carriedForwardGoals > 0,
            ) ? (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs text-gray-400">
                    <tr>
                      <th className="pb-2 pr-4 font-medium">Quarter</th>
                      <th className="pb-2 px-3 font-medium">Allocated</th>
                      <th className="pb-2 px-3 font-medium">Achieved</th>
                      <th className="pb-2 px-3 font-medium">Completed</th>
                      <th className="pb-2 pl-3 font-medium">Carried forward</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {dashboardSummary.quarterHistory.map((quarter) => (
                      <tr key={quarter.quarter}>
                        <th className="py-3 pr-4 font-medium text-gray-700">
                          {quarter.quarter}
                        </th>
                        <td className="px-3 py-3 text-gray-600">
                          {Number(quarter.allocatedPercentage).toFixed(2)}%
                        </td>
                        <td className="px-3 py-3 text-gray-600">
                          {Number(quarter.achievedPercentage).toFixed(2)}%
                        </td>
                        <td className="px-3 py-3 text-gray-600">{quarter.completedGoals}</td>
                        <td className="py-3 pl-3 text-gray-600">
                          {quarter.carriedForwardGoals}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-400">
                Quarter history will appear when you have goals.
              </p>
            )}
          </section>

        </div>

        {/* Goal list */}
        <div id="goal-list" className="space-y-4 scroll-mt-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Your goals</h2>
              <p className="mt-1 text-xs text-gray-400">
                {filtered.length} {filtered.length === 1 ? "goal" : "goals"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={14} className="shrink-0 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter goals by status"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 focus:ring-2 focus:ring-indigo-500 sm:w-auto"
              >
                <option value="All">All statuses ({goals.length})</option>
                {Object.entries(STATUS_GROUPS).map(([group]) => (
                  <option key={group} value={group}>
                    {group} ({goalStatusCounts[group] || 0})
                  </option>
                ))}
                {Object.entries(statusCounts)
                  .filter(
                    ([status]) =>
                      !Object.values(STATUS_GROUPS).some((statuses) =>
                        statuses.includes(normalizeGoalStatus(status)),
                      ),
                  )
                  .map(([status, count]) => (
                    <option key={status} value={status}>
                      {status} ({count})
                    </option>
                  ))}
              </select>
            </div>
          </div>
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