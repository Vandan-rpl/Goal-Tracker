import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
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
import {
  getEmployeeGoals,
  getEmployeeQuarterSummary,
} from "../../services/dashboardService";
import {
  formatFiscalQuarterLabel,
  getCurrentFiscalQuarterValue,
} from "../../utils/fiscalQuarter";
import {
  getCompletionRejectionRemark,
  getGoalStatusLabel,
  getGoalDisplayStatus,
  getGoalStatusLabelOf,
} from "../../utils/goalStatus";
import QuarterSummaryTable from "../../components/QuarterSummaryTable/QuarterSummaryTable";
import { formatDisplayDate } from "../../utils/dateTime";
import TaskWorkbookFrame, {
  taskFilterControlClass,
} from "../../components/TaskWorkbookFrame/TaskWorkbookFrame";
import { ChartPanel, SummaryCard } from "../../components/Dashboard/Dashboard";

const MAX_GOALS_PER_QUARTER = 8;
// One status card per goal status, in lifecycle order (same statuses as the
// Goal Management filter). Any other status the user's goals are in (e.g.
// Postpone) gets a card after these.
const DASHBOARD_STATUSES = [
  "Draft",
  "Submitted",
  "HOD Approved",
  "Approved",
  "Completion Submitted",
  "Completion Rejected",
  "Completed",
  "Rejected",
];

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
  "Completion Submitted": { bg: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-200", bar: "bg-sky-500", icon: Clock },
  "Completed": { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", bar: "bg-emerald-500", icon: CheckCircle2 },
  "Rejected": { bg: "bg-red-50", text: "text-red-700", ring: "ring-red-200", bar: "bg-red-500", icon: XCircle },
  "Completion Rejected": { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200", bar: "bg-rose-500", icon: XCircle },
  "Cancelled": { bg: "bg-gray-100", text: "text-gray-500", ring: "ring-gray-200", bar: "bg-gray-400", icon: XCircle },
  "Postpone": { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", bar: "bg-amber-400", icon: AlertTriangle },
};
const DEFAULT_STATUS_STYLE = STATUS_STYLES["Draft"];

// Number colour of each status card, in the Ideas / Tasks dashboard palette.
const STATUS_ACCENTS = {
  "Draft": "text-[#7c8ba3]",
  "Submitted": "text-[#d08a1c]",
  "HOD Approved": "text-[#d08a1c]",
  "Manager Approved": "text-[#d08a1c]",
  "Approved": "text-[#2c3e82]",
  "Completion Submitted": "text-[#d08a1c]",
  "Completion Rejected": "text-[#b3403f]",
  "Completed": "text-[#1f9d6b]",
  "Rejected": "text-[#b3403f]",
};
const DEFAULT_STATUS_ACCENT = "text-[#2c3e82]";

// Rounded corners for the dashboard panels (title strip clipped to them).
const PANEL_RADIUS = "overflow-hidden rounded-xl";

// Empty-state note inside a panel.
const panelEmptyClass =
  "rounded-lg border border-dashed border-[#cbd4e2] bg-[#f8fafc] p-4 text-sm text-slate-500";

const PRIORITY_STYLES = {
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-gray-100 text-gray-600",
};

function normalizeGoalStatus(status) {
  return String(status || "Draft").trim().toLowerCase();
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
  return formatDisplayDate(new Date(date.year, date.month - 1, date.day));
}

// ---------------------------------------------------------------------------
// GOAL CARD
// ---------------------------------------------------------------------------
function GoalCard({ goal }) {
  const isCompleted = normalizeGoalStatus(goal.GoalStatus) === "completed";
  const style = isCompleted
    ? STATUS_STYLES.Completed
    : STATUS_STYLES[getGoalDisplayStatus(goal)] || DEFAULT_STATUS_STYLE;
  const StatusIcon = style.icon;
  const totalSubGoals = Number(goal.TotalSubGoalCount || 0);
  const completedSubGoals = Number(goal.CompletedSubGoalCount || 0);
  const completionRejectionRemark = getCompletionRejectionRemark(goal);
  const displayedTimeline = goal.DashboardTimeline || goal.Timeline;
  const days = daysUntil(displayedTimeline);
  const normalizedStatus = normalizeGoalStatus(goal.GoalStatus);
  const overdue = days !== null && days < 0 && !["completed", "cancelled"].includes(normalizedStatus);

  return (
    <Link
      to={`/goals/view/${goal.GoalID}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="w-full text-left p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-gray-400">#{goal.GoalNumber}</span>
            {goal.Priority && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[goal.Priority] || PRIORITY_STYLES.Low}`}>
                {goal.Priority}
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
          {completionRejectionRemark && (
            <p className="mt-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-2.5 py-1.5">
              <span className="font-semibold">Completion rejected: </span>
              {completionRejectionRemark}
            </p>
          )}
        </div>

        <div className="flex items-center gap-4 sm:w-64">
          <div className="flex-1 flex flex-col items-start sm:items-end gap-1 text-xs">
            <span
              className={`font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.text} flex items-center gap-1`}
            >
              <StatusIcon size={13} />
              {getGoalStatusLabelOf(goal)}
            </span>
            {totalSubGoals > 0 && (
              <span className="text-gray-500">
                {completedSubGoals}/{totalSubGoals} steps done
              </span>
            )}
          </div>
          <ChevronRight size={18} className="text-gray-400 shrink-0" />
        </div>
      </div>
    </Link>
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
  const [quarterSummary, setQuarterSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchGoals = useCallback(async () => {
    if (!isAuthReady) return;
    setLoading(true);
    setError(null);
    try {
      const [dashboard, quarters] = await Promise.all([
        getEmployeeGoals(),
        getEmployeeQuarterSummary(),
      ]);
      setGoals(dashboard.goals || []);
      setDashboardSummary(dashboard.summary || null);
      setQuarterSummary(quarters || null);
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
      const status = getGoalDisplayStatus(g);
      c[status] = (c[status] || 0) + 1;
    });
    return c;
  }, [goals]);

  const currentQuarterLabel =
    quarterSummary?.currentQuarter || getCurrentFiscalQuarterValue();
  const currentQuarterGoalCount =
    dashboardSummary?.currentQuarterWeightage?.goalCount ?? 0;

  // Current-quarter progress bar. Achieved counts a goal's full weightage
  // once its completion is approved (status Completed).
  const currentQuarterAllocation = useMemo(() => {
    if (dashboardSummary?.currentQuarterWeightage) {
      return dashboardSummary.currentQuarterWeightage;
    }
    return {
      quarter: getCurrentFiscalQuarterValue(),
      goalCount: 0,
      allocated: 0,
      achieved: 0,
      performancePercentage: null,
      unallocated: 100,
    };
  }, [dashboardSummary]);

  const currentQuarterAllocated = Math.round(
    Number(currentQuarterAllocation.allocated || 0),
  );
  const currentQuarterAchieved = Math.round(
    Number(currentQuarterAllocation.achieved || 0),
  );

  // Every status card: the fixed lifecycle list, then any other status the
  // user's goals are in.
  const statusCards = [
    ...DASHBOARD_STATUSES,
    ...Object.keys(statusCounts).filter(
      (status) => !DASHBOARD_STATUSES.includes(status),
    ),
  ];
  const subGoalStatusCounts = dashboardSummary?.subGoalStatusCounts || {
    completed: 0,
    pending: 0,
  };
  const filtered =
    statusFilter === "All"
      ? goals
      : goals.filter((goal) => getGoalDisplayStatus(goal) === statusFilter);

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
    <TaskWorkbookFrame
      barLabel="GOAL TRACKER"
      barSubtitle="Dashboard"
      badge="DASHBOARD"
      title="My Goals"
      description="Your goals for the current fiscal year."
    >
      <div className="space-y-6">

        <ChartPanel
          className={PANEL_RADIUS}
          title={`${formatFiscalQuarterLabel(currentQuarterAllocation.quarter)} progress · ${currentQuarterAllocation.goalCount} of ${MAX_GOALS_PER_QUARTER} goals`}
        >

          {currentQuarterAllocation.goalCount === 0 ? (
            <p className={panelEmptyClass}>
              No goals added for this quarter yet
            </p>
          ) : (
            <>
              <div
                className="h-3 overflow-hidden rounded-full bg-[#e3e9f2]"
                role="progressbar"
                aria-label="Quarterly goal weightage allocated"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, currentQuarterAllocation.allocated)}
                aria-valuetext={`Allocated ${currentQuarterAllocated}%, achieved ${currentQuarterAchieved}%`}
              >
                <div
                  className="relative h-full rounded-full bg-[#9fb0d6] transition-all"
                  style={{
                    width: `${Math.max(0, Math.min(100, currentQuarterAllocation.allocated))}%`,
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-[#1f9d6b] transition-all"
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
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#30415f]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#9fb0d6]" />
                  Allocated {currentQuarterAllocated}%
                </span>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full bg-[#1f9d6b]" />
                  Achieved {currentQuarterAchieved}%
                </span>
                {/* {currentQuarterAllocation.performancePercentage != null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      Completion{" "}
                      {Number(
                        currentQuarterAllocation.performancePercentage,
                      ).toFixed(2)}%
                    </span>
                  </>
                )} */}
              </div>
            </>
          )}
        </ChartPanel>

        {/* Q1–Q4 of the current fiscal year, calculated on the server. */}
        <ChartPanel className={PANEL_RADIUS} title="Quarter summary">
          {quarterSummary?.quarters?.length ? (
            <QuarterSummaryTable
              quarters={quarterSummary.quarters}
              currentQuarter={currentQuarterLabel}
            />
          ) : (
            <p className={panelEmptyClass}>
              Quarter summary will appear when you have goals.
            </p>
          )}
        </ChartPanel>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ChartPanel className={PANEL_RADIUS} title="Goal status">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {statusCards.map((status) => (
                <a
                  key={status}
                  href="#goal-list"
                  onClick={() => setStatusFilter(status)}
                  className="grid min-w-0 rounded-lg transition hover:brightness-95"
                >
                  <SummaryCard
                    label={getGoalStatusLabel(status)}
                    value={statusCounts[status] || 0}
                    accent={STATUS_ACCENTS[status] || DEFAULT_STATUS_ACCENT}
                    className="rounded-lg"
                  />
                </a>
              ))}
            </div>
            {goals.length === 0 && (
              <p className="mt-3 text-xs text-slate-500">No goals to summarize yet.</p>
            )}
          </ChartPanel>

          <ChartPanel className={PANEL_RADIUS} title={`Sub-goal progress · ${formatFiscalQuarterLabel(currentQuarterLabel)}`}>
            {currentQuarterGoalCount === 0 ? (
              <p className={panelEmptyClass}>
                No goals in this quarter yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <SummaryCard label="Completed" value={subGoalStatusCounts.completed} accent="text-[#1f9d6b]" className="rounded-lg" />
                <SummaryCard label="Pending" value={subGoalStatusCounts.pending} accent="text-[#d08a1c]" className="rounded-lg" />
              </div>
            )}
          </ChartPanel>

          <ChartPanel className={PANEL_RADIUS} title="Needs attention (Overdue goals)">
            {dashboardSummary?.needsAttention?.length ? (
              <ul className="divide-y divide-[#e3e9f2]">
                {dashboardSummary.needsAttention.map((goal) => (
                  <li key={goal.GoalID} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      to={`/goals/view/${goal.GoalID}`}
                      className="flex items-center justify-between gap-3 text-sm hover:text-indigo-700"
                    >
                      <span className="truncate font-medium text-gray-800">
                        {goal.GoalTitle}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        goal.AttentionReason === "Rejected"
                          ? "border border-[#b3403f]/30 bg-[#b3403f]/10 text-[#b3403f]"
                          : goal.AttentionReason === "Overdue"
                            ? "border border-[#d08a1c]/30 bg-[#d08a1c]/10 text-[#a86d12]"
                            : "border border-[#cbd4e2] bg-[#f4f6fa] text-[#30415f]"
                      }`}>
                        {goal.AttentionReason}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={panelEmptyClass}>
                No goals need attention.
              </p>
            )}
          </ChartPanel>

          <ChartPanel className={PANEL_RADIUS} title="Upcoming deadlines">
            {dashboardSummary?.upcomingDeadlines?.length ? (
              <ul className="divide-y divide-[#e3e9f2]">
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
                      <span className="shrink-0 text-xs font-semibold text-[#2c3e82]">
                        {getGoalStatusLabelOf(goal)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={panelEmptyClass}>
                No deadlines in the next 14 days.
              </p>
            )}
          </ChartPanel>

        </div>

        {/* Goal list */}
        <div id="goal-list" className="space-y-4 scroll-mt-6">
          <div className="flex flex-col gap-3 rounded-xl border border-[#cbd4e2] bg-[#f4f6fa] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#30415f]">Your goals</h2>
              <p className="mt-1 text-xs text-slate-500">
                {filtered.length} {filtered.length === 1 ? "goal" : "goals"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Filter size={14} className="shrink-0 text-[#30415f]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter goals by status"
                className={`${taskFilterControlClass} rounded-lg sm:w-auto`}
              >
                <option value="All">All Status ({goals.length})</option>
                {statusCards.map((status) => (
                  <option key={status} value={status}>
                    {getGoalStatusLabel(status)} ({statusCounts[status] || 0})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {filtered.map((goal) => (
            <GoalCard key={goal.GoalID} goal={goal} />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-500 text-sm">No goals match this filter.</div>
          )}
        </div>
      </div>
    </TaskWorkbookFrame>
  );
}
