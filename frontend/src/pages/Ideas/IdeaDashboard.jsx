import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import TaskWorkbookFrame, { taskPrimaryButtonClass } from "../../components/TaskWorkbookFrame/TaskWorkbookFrame";
import IdeaStatusBadge from "../../components/IdeaStatusBadge/IdeaStatusBadge";
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
} from "../../components/Dashboard/dashboardStyles";
import { getIdeaApiError, getIdeaDashboard } from "../../services/ideaService";
import { formatIdeaDate } from "../../utils/ideaStatus";

const STATUS_COLORS = {
  "HOD/Manager approval pending": C.amber,
  "Final approval pending": "#1f8a9d",
  "In Implementation": C.navy,
  Overdue: C.red,
  Implemented: C.green,
};

const SNAPSHOT_COLORS = {
  Implemented: C.green,
  Remaining: C.slate,
};

// Purposes come from the backend's predefined list, coloured in order.
const PURPOSE_PALETTE = [C.navy, "#1f8a9d", C.amber, C.green, C.slate, C.red];
const purposeColors = (rows = []) =>
  Object.fromEntries(rows.map((row, index) => [row.label, PURPOSE_PALETTE[index % PURPOSE_PALETTE.length]]));

/**
 * Innovation Ideas Dashboard: ideas the logged-in user submitted (no
 * Drafts; not ideas they only review or approve). Read-only. Every number
 * comes from the backend (GET /ideas/dashboard), so cards, tables and
 * charts always match. Same layout as the Task Tracker dashboard
 * (components/Dashboard).
 */
const IdeaDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    getIdeaDashboard()
      .then((result) => {
        if (!ignore) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (!ignore) setError(getIdeaApiError(err, "Failed to load your dashboard.").message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const summary = data?.summary;
  const ideas = data?.ideas || [];
  const hasIdeas = (summary?.total || 0) > 0;

  return (
    <TaskWorkbookFrame
      barLabel="INNOVATION IDEAS"
      barSubtitle="Dashboard"
      badge="DASHBOARD"
      title="My Dashboard"
      description="Ideas you have submitted. Drafts are not included."
      actions={
        <Link to="/ideas/share" className={taskPrimaryButtonClass}>
          <Plus size={15} />
          Share Idea
        </Link>
      }
      footer="Final approval moves an idea straight to In Implementation. The In Implementation card counts every idea being implemented, overdue ones included; in the Status Breakdown an idea past its target date counts as Overdue only. Implementation % = Implemented / (In Implementation + Implemented). Rejected ideas are shown only in the Rejected card."
    >
      <DashboardError message={error} />

      {loading ? (
        <DashboardLoading />
      ) : summary && (
        <div className="space-y-6">
          <SummaryCards
            gridClassName="grid-cols-2 sm:grid-cols-4 2xl:grid-cols-8"
            cards={[
              { label: "Total Ideas", value: summary.total, accent: "text-[#2c3e82]" },
              { label: "HOD/Manager approval pending", value: summary.pendingManager, accent: "text-[#d08a1c]" },
              { label: "Final approval pending", value: summary.pendingFinal, accent: "text-[#d08a1c]" },
              { label: "In Implementation", value: summary.inImplementation, accent: "text-[#2c3e82]" },
              { label: "Implemented", value: summary.implemented, accent: "text-[#1f9d6b]" },
              { label: "Rejected", value: summary.rejected, accent: "text-[#b3403f]" },
              { label: "Overdue", value: summary.overdue, accent: "text-[#b3403f]" },
              { label: "Implementation %", value: `${summary.implementationPercent}%`, accent: "text-[#2c3e82]" },
            ]}
          />

          {!hasIdeas ? (
            <DashboardEmptyState
              title="No ideas to show yet"
              description="Ideas you submit will show up here. Share an idea to get started."
            />
          ) : (
            <>
              <DashboardBreakdowns
                status={{ title: "Status Breakdown", rows: data.statusBreakdown, colors: STATUS_COLORS }}
                bar={{
                  title: "Purpose Breakdown",
                  rows: data.purposeBreakdown,
                  colors: purposeColors(data.purposeBreakdown),
                  barName: "Ideas",
                  yAxisWidth: 170,
                }}
                snapshot={{ title: "Implementation Snapshot", rows: data.implementationSnapshot, colors: SNAPSHOT_COLORS }}
              />

              <DashboardListTable title="All Ideas">
                <thead>
                  <tr>
                    <th className={headClass}>Idea No.</th>
                    <th className={headClass}>Title</th>
                    <th className={headClass}>Purpose</th>
                    <th className={headClass}>Submitted Date</th>
                    <th className={headClass}>Target Date</th>
                    <th className={headClass}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ideas.map((idea) => (
                    <tr key={idea.IdeaID} className="hover:bg-[#f7f9fc]">
                      <td className={`${cellClass} whitespace-nowrap font-semibold`}>{idea.IdeaNumber || "—"}</td>
                      <td className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>{idea.Title || "—"}</td>
                      <td className={`${cellClass} whitespace-nowrap`}>{idea.Purpose || "—"}</td>
                      <td className={`${cellClass} whitespace-nowrap`}>{formatIdeaDate(idea.SubmittedDate)}</td>
                      <td className={`${cellClass} whitespace-nowrap`}>{formatIdeaDate(idea.TargetDate)}</td>
                      <td className={cellClass}>
                        {/* One status per idea, as in the Status Breakdown:
                            an idea past its target date shows as Overdue only. */}
                        <IdeaStatusBadge status={idea.IsOverdue ? "Overdue" : idea.Status} />
                      </td>
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

export default IdeaDashboard;
