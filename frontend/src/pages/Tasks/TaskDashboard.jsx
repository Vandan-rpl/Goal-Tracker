import React, { useEffect, useState } from "react";
import TaskWorkbookFrame from "../../components/TaskWorkbookFrame/TaskWorkbookFrame";
import {
  DashboardBreakdowns,
  DashboardEmptyState,
  DashboardError,
  DashboardListTable,
  DashboardLoading,
  SummaryCards,
} from "../../components/Dashboard/Dashboard";
import {
  DASHBOARD_COLORS as C,
  dashboardCellClass as cellClass,
  dashboardHeadClass as headClass,
  dashboardTagClass as tagClass,
} from "../../components/Dashboard/dashboardStyles";
import { getTaskApiError, getTaskDashboard } from "../../services/taskService";
import { formatTaskDate, getTaskPriorityClasses } from "../../utils/taskStatus";

const STATUS_COLORS = {
  Completed: C.green,
  Overdue: C.red,
  "In Progress": C.navy,
};

const PRIORITY_COLORS = {
  High: C.red,
  Medium: C.amber,
  Low: C.slate,
};

const SNAPSHOT_COLORS = {
  Completed: C.green,
  Remaining: C.slate,
};

const STATUS_TAG_CLASSES = {
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Overdue: "bg-red-100 text-red-800 border-red-200",
  "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
};

/**
 * Task Tracker Dashboard: the logged-in user's own tasks (self-added or
 * assigned by the Business Head; no project tasks). Only Completed,
 * In Progress and Overdue tasks are counted. Read-only. Every number comes
 * from the backend (GET /tasks/dashboard), so cards, tables and charts
 * always match. Layout pieces are shared with the Ideas dashboard
 * (components/Dashboard).
 */
const TaskDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    getTaskDashboard()
      .then((result) => {
        if (!ignore) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (!ignore) setError(getTaskApiError(err, "Failed to load your dashboard.").message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const summary = data?.summary;
  const tasks = data?.tasks || [];
  const hasTasks = (summary?.total || 0) > 0;

  return (
    <TaskWorkbookFrame
      barSubtitle="Dashboard"
      badge="DASHBOARD"
      title="My Dashboard"
      description="Your own tasks and tasks assigned to you by the CFO. Project tasks are not included."
      footer="Only Completed, In Progress and Overdue tasks are counted. A task that is not Completed and is past its due date counts as Overdue only."
    >
      <DashboardError message={error} />

      {loading ? (
        <DashboardLoading />
      ) : summary && (
        <div className="space-y-6">
          <SummaryCards
            gridClassName="grid-cols-2 xl:grid-cols-4"
            cards={[
              { label: "Total Tasks", value: summary.total, accent: "text-[#2c3e82]" },
              { label: "Completed", value: summary.completed, accent: "text-[#1f9d6b]" },
              { label: "Overdue", value: summary.overdue, accent: "text-[#b3403f]" },
              { label: "High Priority", value: summary.highPriority, accent: "text-[#b3403f]" },
            ]}
          />

          {!hasTasks ? (
            <DashboardEmptyState
              title="No tasks to show yet"
              description="Tasks that are In Progress, Completed or Overdue will show up here. Add tasks in My Tasks."
            />
          ) : (
            <>
              <DashboardBreakdowns
                status={{ title: "Status Breakdown", rows: data.statusBreakdown, colors: STATUS_COLORS }}
                bar={{ title: "Priority Breakdown", rows: data.priorityBreakdown, colors: PRIORITY_COLORS, barName: "Tasks" }}
                snapshot={{ title: "Completion Snapshot", rows: data.completionSnapshot, colors: SNAPSHOT_COLORS }}
              />

              <DashboardListTable title="All Tasks">
                <thead>
                  <tr>
                    <th className={`${headClass} w-14 text-center`}>Sr.No.</th>
                    <th className={headClass}>Task Name</th>
                    <th className={headClass}>Priority</th>
                    <th className={headClass}>Due Date</th>
                    <th className={headClass}>Status</th>
                    <th className={headClass}>CFO's Remarks</th>
                    <th className={headClass}>User's Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => (
                    <tr key={task.TaskID} className="hover:bg-[#f7f9fc]">
                      <td className={`${cellClass} text-center bg-[#f4f6fa]`}>{index + 1}</td>
                      <td className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>{task.TaskName}</td>
                      <td className={cellClass}>
                        <span className={`${tagClass} ${getTaskPriorityClasses(task.Priority)}`}>{task.Priority}</span>
                      </td>
                      <td className={`${cellClass} whitespace-nowrap`}>{formatTaskDate(task.DueDate)}</td>
                      <td className={cellClass}>
                        <span className={`${tagClass} ${STATUS_TAG_CLASSES[task.DashboardStatus]}`}>{task.DashboardStatus}</span>
                      </td>
                      <td className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>{task.CFORemarks || "—"}</td>
                      <td className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>{task.UserRemarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </DashboardListTable>
            </>
          )}
        </div>
      )}
    </TaskWorkbookFrame>
  );
};

export default TaskDashboard;
