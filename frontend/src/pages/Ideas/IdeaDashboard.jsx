import React, { useEffect, useState } from "react";
import TaskWorkbookFrame from "../../components/TaskWorkbookFrame/TaskWorkbookFrame";
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
  "Pending Approval": C.amber,
  "In Progress": C.navy,
  Overdue: C.red,
  Completed: C.green,
};

const SNAPSHOT_COLORS = {
  Completed: C.green,
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
      footer="Completion % = Completed / ideas that got final approval. In Progress = Active ideas plus ideas waiting for the Reporting Manager to approve completion. An Active or In Implementation idea past its target date counts as Overdue only. Rejected ideas are shown only in the Rejected card."
    >
      <DashboardError message={error} />

      {loading ? (
        <DashboardLoading />
      ) : summary && (
        <div className="space-y-6">
          <SummaryCards
            gridClassName="grid-cols-2 md:grid-cols-4 xl:grid-cols-7"
            cards={[
              { label: "Total Ideas", value: summary.total, accent: "text-[#2c3e82]" },
              { label: "Pending Approval", value: summary.pendingApproval, accent: "text-[#d08a1c]" },
              { label: "Approved Ideas", value: summary.approved, accent: "text-[#2c3e82]" },
              { label: "Completed", value: summary.completed, accent: "text-[#1f9d6b]" },
              { label: "Rejected", value: summary.rejected, accent: "text-[#b3403f]" },
              { label: "Overdue", value: summary.overdue, accent: "text-[#b3403f]" },
              { label: "Completion %", value: `${summary.completionPercent}%`, accent: "text-[#2c3e82]" },
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
                snapshot={{ title: "Completion Snapshot", rows: data.completionSnapshot, colors: SNAPSHOT_COLORS }}
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
                        <IdeaStatusBadge status={idea.Status} overdue={idea.IsOverdue} pendingRequest={idea.PendingRequestType} />
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
