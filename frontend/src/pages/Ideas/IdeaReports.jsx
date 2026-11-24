import { Link } from "react-router-dom";
import ModuleReports from "../../components/ModuleReports/ModuleReports";
import IdeaStatusBadge from "../../components/IdeaStatusBadge/IdeaStatusBadge";
import { DASHBOARD_COLORS as C } from "../../components/Dashboard/dashboardStyles";
import { getIdeaApiError, getIdeaReport } from "../../services/ideaService";
import { formatIdeaDate } from "../../utils/ideaStatus";

const STATUS_COLORS = {
  "HOD/Manager approval pending": C.amber,
  "Final approval pending (by IT Team)": "#1f8a9d",
  "In Implementation": C.navy,
  Overdue: C.red,
  Implemented: C.green,
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
  { label: "HOD/Manager approval pending", value: summary.pendingManager, accent: "text-[#d08a1c]" },
  { label: "Final approval pending (by IT Team)", value: summary.pendingFinal, accent: "text-[#d08a1c]" },
  { label: "In Implementation", value: summary.inImplementation, accent: "text-[#2c3e82]" },
  { label: "Implemented", value: summary.implemented, accent: "text-[#1f9d6b]" },
  { label: "Rejected", value: summary.rejected, accent: "text-[#b3403f]" },
  { label: "Overdue", value: summary.overdue, accent: "text-[#b3403f]" },
  { label: "Implementation %", value: `${summary.implementationPercent}%`, accent: "text-[#2c3e82]" },
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
    completion={{ label: "Implementation", status: "Implemented" }}
    summaryGridClassName="grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8"
    footer="Ideas are counted in the fiscal year they were submitted; Drafts are left out. Final approval moves an idea straight to In Implementation. The In Implementation card counts every idea being implemented, overdue ones included; in the tables and charts an idea past its target date counts as Overdue only. Implementation % = Implemented ÷ (In Implementation + Overdue + Implemented)."
  />
);

export default IdeaReports;
