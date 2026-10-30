import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import TableLoader from "../../components/loaders/TableLoader";
import EmptyState from "../../components/EmptyState/EmptyState";
import IdeaStatusBadge from "../../components/IdeaStatusBadge/IdeaStatusBadge";
import IdeaCountBoxes from "../../components/IdeaCountBoxes/IdeaCountBoxes";
import TablePagination from "../../components/TablePagination/TablePagination";
import IdeaDaysLeft from "../../components/IdeaDaysLeft/IdeaDaysLeft";
import { getAssignedIdeas, getIdeaApiError, getIdeaPurposes } from "../../services/ideaService";
import { IDEA_STATUSES, formatIdeaDate } from "../../utils/ideaStatus";

const PAGE_SIZE = 10;
const COLUMN_COUNT = 9;
const OVERDUE_KEY = "overdue";
const PENDING_KEY = "pending";

// Assigned ideas are never Drafts.
const STATUS_OPTIONS = IDEA_STATUSES.filter((status) => status !== "Draft");

// Pending with Me and Overdue filter on a flag; the others on status.
const FLAG_FILTERS = {
  [PENDING_KEY]: { label: "Pending with me", matches: (idea) => idea.IsPendingWithMe },
  [OVERDUE_KEY]: { label: "Overdue only", matches: (idea) => idea.IsOverdue },
};

const COUNT_BOXES = [
  { key: PENDING_KEY, label: "Pending with Me" },
  { key: "Pending Final Approval", label: "Pending Final Approval" },
  { key: "Active", label: "Active" },
  { key: "In Implementation", label: "In Implementation" },
  { key: OVERDUE_KEY, label: "Overdue", tone: "danger" },
  { key: "Implemented", label: "Implemented" },
  { key: "Rejected", label: "Rejected" },
];

// The viewer's role on the idea (can be both).
const roleLabel = (idea) =>
  [idea.IsLead && "Reporting Manager", idea.IsFinalApprover && "Final Approver"].filter(Boolean).join(", ");

const selectClass =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500";

// Waiting for the viewer's decision first (oldest submission first: waited
// longest), then overdue ideas (most overdue first), then the rest by
// target date.
const sortRank = (idea) => (idea.IsPendingWithMe ? 0 : idea.IsOverdue ? 1 : 2);

const compareIdeas = (a, b) => {
  const rankDiff = sortRank(a) - sortRank(b);
  if (rankDiff !== 0) return rankDiff;

  if (sortRank(a) === 0) {
    return String(a.SubmittedDate || "").localeCompare(String(b.SubmittedDate || ""));
  }

  // Ideas without a target date go last.
  if (a.TargetDate && !b.TargetDate) return -1;
  if (!a.TargetDate && b.TargetDate) return 1;
  const targetDiff = String(a.TargetDate || "").localeCompare(String(b.TargetDate || ""));
  if (targetDiff !== 0) return targetDiff;

  return String(b.SubmittedDate || "").localeCompare(String(a.SubmittedDate || ""));
};

const AssignedIdeas = () => {
  const navigate = useNavigate();

  const [ideas, setIdeas] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  // "" | PENDING_KEY | OVERDUE_KEY
  const [flag, setFlag] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let ignore = false;

    const loadIdeas = async () => {
      try {
        setLoading(true);
        setError("");
        const [ideaList, purposeList] = await Promise.all([
          getAssignedIdeas(),
          // The table still works without the purpose filter options.
          getIdeaPurposes().catch(() => []),
        ]);
        if (ignore) return;
        setIdeas(ideaList || []);
        setPurposes(purposeList || []);
      } catch (err) {
        if (!ignore) setError(getIdeaApiError(err, "Failed to load ideas assigned to you.").message);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadIdeas();
    return () => {
      ignore = true;
    };
  }, []);

  const counts = useMemo(
    () =>
      ideas.reduce(
        (totals, idea) => ({
          ...totals,
          [idea.Status]: (totals[idea.Status] || 0) + 1,
          [OVERDUE_KEY]: totals[OVERDUE_KEY] + (idea.IsOverdue ? 1 : 0),
          [PENDING_KEY]: totals[PENDING_KEY] + (idea.IsPendingWithMe ? 1 : 0),
        }),
        { [OVERDUE_KEY]: 0, [PENDING_KEY]: 0 },
      ),
    [ideas],
  );

  const filteredIdeas = useMemo(() => {
    const term = search.trim().toLowerCase();

    return ideas
      .filter((idea) => {
        if (status && idea.Status !== status) return false;
        if (flag && !FLAG_FILTERS[flag].matches(idea)) return false;
        if (purpose && idea.Purpose !== purpose) return false;
        if (!term) return true;
        return (
          (idea.IdeaNumber || "").toLowerCase().includes(term) ||
          (idea.Title || "").toLowerCase().includes(term)
        );
      })
      .sort(compareIdeas);
  }, [ideas, search, status, purpose, flag]);

  const totalPages = Math.max(1, Math.ceil(filteredIdeas.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageIdeas = filteredIdeas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasFilters = Boolean(search || status || purpose || flag);

  const activeBox = flag ? (status ? null : flag) : status;

  // Any filter change goes back to the first page.
  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };
  const changeStatus = (value) => {
    setStatus(value);
    setPage(1);
  };
  const changePurpose = (value) => {
    setPurpose(value);
    setPage(1);
  };

  // Clicking the active box again clears it.
  const selectBox = (key) => {
    const clear = key === activeBox;
    const isFlag = Boolean(FLAG_FILTERS[key]);
    setFlag(!clear && isFlag ? key : "");
    setStatus(clear || isFlag ? "" : key);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPurpose("");
    setFlag("");
    setPage(1);
  };

  const openIdea = (idea) => navigate(`/ideas/view/${idea.IdeaID}`);

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">Assigned to Me</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ideas where you are the reporting manager or the final approver. Ideas waiting for your
            decision are listed first.
          </p>
        </div>

        {/* Count Boxes */}
        <IdeaCountBoxes
          boxes={COUNT_BOXES.map((box) => ({ ...box, count: counts[box.key] || 0 }))}
          activeKey={activeBox}
          loading={loading}
          onSelect={selectBox}
          gridClassName="grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"
        />

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-[2]">
              <label htmlFor="assigned-search" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Search
              </label>
              <input
                id="assigned-search"
                type="search"
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
                placeholder="Idea number or title"
                className={selectClass}
              />
            </div>

            <div className="flex-1">
              <label htmlFor="assigned-status" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                id="assigned-status"
                value={status}
                onChange={(e) => changeStatus(e.target.value)}
                className={selectClass}
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label htmlFor="assigned-purpose" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Purpose
              </label>
              <select
                id="assigned-purpose"
                value={purpose}
                onChange={(e) => changePurpose(e.target.value)}
                className={selectClass}
              >
                <option value="">All Purposes</option>
                {purposes.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>

          {/* The flag filters have no dropdown, so show them as a removable chip. */}
          {flag && (
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
              {FLAG_FILTERS[flag].label}
              <button
                type="button"
                aria-label={`Remove ${FLAG_FILTERS[flag].label.toLowerCase()} filter`}
                onClick={() => {
                  setFlag("");
                  setPage(1);
                }}
                className="hover:text-red-900 cursor-pointer"
              >
                ✕
              </button>
            </span>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>
        )}

        {/* Ideas Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/75">
                <tr>
                  {["Idea No.", "Title", "Submitted By", "My Role", "Purpose", "Submitted Date", "Target Date", "Status", "Days Left"].map(
                    (heading) => (
                      <th
                        key={heading}
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="p-0">
                      <TableLoader rows={5} columns={COLUMN_COUNT} showToolbar={false} paper={false} />
                    </td>
                  </tr>
                ) : pageIdeas.length > 0 ? (
                  pageIdeas.map((idea) => (
                    <tr
                      key={idea.IdeaID}
                      onClick={() => openIdea(idea)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") openIdea(idea);
                      }}
                      tabIndex={0}
                      title="View details"
                      className="hover:bg-gray-50/50 transition cursor-pointer focus:outline-none focus:bg-indigo-50/40"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{idea.IdeaNumber}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 max-w-xs">
                        <div className="truncate">{idea.Title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{idea.SubmitterName}</div>
                        {idea.SubmitterDepartment && (
                          <div className="text-xs text-gray-400">{idea.SubmitterDepartment}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{roleLabel(idea)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{idea.Purpose || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatIdeaDate(idea.SubmittedDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatIdeaDate(idea.TargetDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <IdeaStatusBadge status={idea.Status} />
                        {idea.IsPendingWithMe && (
                          <div className="mt-1 text-xs font-semibold text-indigo-700">Awaiting your action</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <IdeaDaysLeft idea={idea} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="p-0">
                      {ideas.length === 0 && !error ? (
                        <EmptyState
                          icon={<AssignmentIndOutlinedIcon sx={{ fontSize: 40 }} />}
                          title="No ideas are assigned to you yet."
                          description="Ideas from your team, and ideas sent to you for final approval, will appear here."
                        />
                      ) : (
                        <EmptyState
                          icon={<SearchOffOutlinedIcon sx={{ fontSize: 40 }} />}
                          title="No ideas match the selected filters."
                          action={
                            hasFilters ? (
                              <Button size="small" onClick={clearFilters}>
                                Clear filters
                              </Button>
                            ) : null
                          }
                        />
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!loading && (
            <TablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredIdeas.length}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignedIdeas;
