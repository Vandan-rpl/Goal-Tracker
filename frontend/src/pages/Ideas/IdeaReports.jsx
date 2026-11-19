import { Link } from "react-router-dom";
import ModuleReports from "../../components/ModuleReports/ModuleReports";
import IdeaStatusBadge from "../../components/IdeaStatusBadge/IdeaStatusBadge";
import { DASHBOARD_COLORS as C } from "../../components/Dashboard/dashboardStyles";
import { getIdeaApiError, getIdeaReport } from "../../services/ideaService";
import { formatIdeaDate } from "../../utils/ideaStatus";

const STATUS_COLORS = {
  "Pending Approval": C.amber,
  "In Progress": C.navy,
  Overdue: C.red,
  Completed: C.green,
  Rejected: "#8a5a9d",
};

// Same purpose colours as the Ideas dashboard (backend order).
const PURPOSE_PALETTE = [C.navy, "#1f8a9d", C.amber, C.green, C.slate, C.red];
const PURPOSE_COLORS = Object.fromEntries(
  [
    "Process Improvement",
    "Reduce Manual Intervention",
    "Automation",
    "Statutory Requirement",
    "Management's Suggestion",
  ].map((purpose, index) => [purpose, PURPOSE_PALETTE[index % PURPOSE_PALETTE.length]]),
);

const summaryCards = (summary) => [
  { label: "Total Ideas", value: summary.total, accent: "text-[#2c3e82]" },
  { label: "Pending Approval", value: summary.pendingApproval, accent: "text-[#d08a1c]" },
  { label: "In Progress", value: summary.inProgress, accent: "text-[#2c3e82]" },
  { label: "Overdue", value: summary.overdue, accent: "text-[#b3403f]" },
  { label: "Completed", value: summary.completed, accent: "text-[#1f9d6b]" },
  { label: "Rejected", value: summary.rejected, accent: "text-[#8a5a9d]" },
  { label: "Completion %", value: `${summary.completionPercent}%`, accent: "text-[#2c3e82]" },
];

const ITEM_COLUMNS = [
  {
    label: "Idea No.",
    className: "whitespace-nowrap font-semibold",
    render: (idea) => (
      <Link to={`/ideas/view/${idea.IdeaID}`} className="text-[#2c3e82] hover:underline">
        {idea.IdeaNumber || "—"}
      </Link>
    ),
  },
  { label: "Title", className: "whitespace-pre-wrap wrap-break-word", render: (idea) => idea.Title },
  { label: "Purpose", render: (idea) => idea.Purpose || "—" },
  { label: "Submitted", className: "whitespace-nowrap", render: (idea) => formatIdeaDate(idea.SubmittedDate) },
  { label: "Target Date", className: "whitespace-nowrap", render: (idea) => formatIdeaDate(idea.TargetDate) },
  { label: "Reporting Manager", render: (idea) => idea.ReportingManagerName || "—" },
  {
    label: "Status",
    render: (idea) => <IdeaStatusBadge status={idea.Status} overdue={idea.IsOverdue} />,
  },
];

/**
 * Innovation Ideas: CFO Reports & Analytics (GET /ideas/reports). Same
 * views as the Goal Tracker's Business Head report; see ModuleReports.
 */
const IdeaReports = () => (
  <ModuleReports
    noun="idea"
    nounPlural="ideas"
    fetchReport={getIdeaReport}
    getApiError={getIdeaApiError}
    statusColors={STATUS_COLORS}
    category={{ title: "Purpose Breakdown", colors: PURPOSE_COLORS, yAxisWidth: 170 }}
    summaryCards={summaryCards}
    itemColumns={ITEM_COLUMNS}
    itemKey="IdeaID"
    footer="Ideas are counted in the fiscal year they were submitted; Drafts are left out. In Progress = approved and being implemented, not overdue. Completion % = Completed ÷ approved ideas (In Progress + Overdue + Completed)."
  />
);

export default IdeaReports;
