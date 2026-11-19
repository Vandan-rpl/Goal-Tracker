import ModuleReports from "../../components/ModuleReports/ModuleReports";
import {
  DASHBOARD_COLORS as C,
  dashboardTagClass as tagClass,
} from "../../components/Dashboard/dashboardStyles";
import { getTaskApiError, getTaskReport } from "../../services/taskService";
import { formatTaskDate, getTaskPriorityClasses } from "../../utils/taskStatus";

const STATUS_COLORS = {
  "Not Started": C.slate,
  "In Progress": C.navy,
  Overdue: C.red,
  Completed: C.green,
};

const PRIORITY_COLORS = {
  High: C.red,
  Medium: C.amber,
  Low: C.slate,
};

const STATUS_TAG_CLASSES = {
  Completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Overdue: "bg-red-100 text-red-800 border-red-200",
  "In Progress": "bg-blue-100 text-blue-800 border-blue-200",
  "Not Started": "bg-slate-100 text-slate-700 border-slate-200",
};

const summaryCards = (summary) => [
  { label: "Total Tasks", value: summary.total, accent: "text-[#2c3e82]" },
  { label: "Not Started", value: summary.notStarted, accent: "text-[#7c8ba3]" },
  { label: "In Progress", value: summary.inProgress, accent: "text-[#2c3e82]" },
  { label: "Overdue", value: summary.overdue, accent: "text-[#b3403f]" },
  { label: "Completed", value: summary.completed, accent: "text-[#1f9d6b]" },
  { label: "High Priority", value: summary.highPriority, accent: "text-[#b3403f]" },
  { label: "Completion %", value: `${summary.completionPercent}%`, accent: "text-[#2c3e82]" },
];

const sourceLabel = (task) =>
  task.Source === "Project"
    ? `Project: ${task.ProjectName || "—"}`
    : task.Source === "Assigned"
      ? `Assigned by ${task.AssignedByName || "—"}`
      : "Self-added";

const ITEM_COLUMNS = [
  { label: "Task Name", className: "whitespace-pre-wrap wrap-break-word", render: (task) => task.TaskName },
  { label: "Source", render: sourceLabel },
  {
    label: "Priority",
    render: (task) => <span className={`${tagClass} ${getTaskPriorityClasses(task.Priority)}`}>{task.Priority}</span>,
  },
  { label: "Due Date", className: "whitespace-nowrap", render: (task) => formatTaskDate(task.DueDate) },
  {
    label: "Status",
    render: (task) => <span className={`${tagClass} ${STATUS_TAG_CLASSES[task.ReportStatus]}`}>{task.ReportStatus}</span>,
  },
  { label: "CFO's Remarks", className: "whitespace-pre-wrap wrap-break-word", render: (task) => task.CFORemarks || "—" },
  { label: "User's Remarks", className: "whitespace-pre-wrap wrap-break-word", render: (task) => task.UserRemarks || "—" },
];

/**
 * Task Tracker: CFO Reports & Analytics (GET /tasks/reports). Same views
 * as the Goal Tracker's Business Head report; see ModuleReports.
 */
const TaskReports = () => (
  <ModuleReports
    noun="task"
    nounPlural="tasks"
    fetchReport={getTaskReport}
    getApiError={getTaskApiError}
    statusColors={STATUS_COLORS}
    category={{ title: "Priority Breakdown", colors: PRIORITY_COLORS }}
    summaryCards={summaryCards}
    itemColumns={ITEM_COLUMNS}
    itemKey="TaskID"
    footer="Every task counts (self-added, assigned and project tasks), in the fiscal year it was assigned or added. A task that is not Completed and is past its due date counts as Overdue only. Completion % = Completed ÷ all tasks."
  />
);

export default TaskReports;
