import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import TableLoader from "../../components/loaders/TableLoader";
import EmptyState from "../../components/EmptyState/EmptyState";
import IdeaStatusBadge from "../../components/IdeaStatusBadge/IdeaStatusBadge";
import IdeaCountBoxes from "../../components/IdeaCountBoxes/IdeaCountBoxes";
import TablePagination from "../../components/TablePagination/TablePagination";
import { getIdeaApiError, getIdeaPurposes, getMyIdeas } from "../../services/ideaService";
import { IDEA_STATUSES, formatIdeaDate } from "../../utils/ideaStatus";

const PAGE_SIZE = 10;
const COLUMN_COUNT = 7;

// Count boxes; `status: ""` is Total and clears the status filter.
const COUNT_BOXES = [
  { label: "Total", status: "" },
  { label: "Drafts", status: "Draft" },
  { label: "Submitted", status: "Submitted" },
  { label: "Pending Final Approval", status: "Pending Final Approval" },
  { label: "Active", status: "Active" },
  { label: "In Implementation", status: "In Implementation" },
  { label: "Implemented", status: "Implemented" },
  { label: "Rejected", status: "Rejected" },
];

const selectClass =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const MyIdeas = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [ideas, setIdeas] = useState([]);
  const [purposes, setPurposes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [purpose, setPurpose] = useState("");
  const [page, setPage] = useState(1);

  // Success message passed by Share an Idea (submit / delete draft).
  const [successMessage, setSuccessMessage] = useState(location.state?.successMessage || "");

  // Drop it from history so a refresh or Back doesn't show it again.
  useEffect(() => {
    if (location.state?.successMessage) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    let ignore = false;

    const loadIdeas = async () => {
      try {
        setLoading(true);
        setError("");
        const [ideaList, purposeList] = await Promise.all([
          getMyIdeas(),
          // The table still works without the purpose filter options.
          getIdeaPurposes().catch(() => []),
        ]);
        if (ignore) return;
        setIdeas(ideaList || []);
        setPurposes(purposeList || []);
      } catch (err) {
        if (!ignore) setError(getIdeaApiError(err, "Failed to load your ideas.").message);
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
        (totals, idea) => ({ ...totals, [idea.Status]: (totals[idea.Status] || 0) + 1 }),
        { "": ideas.length },
      ),
    [ideas],
  );

  const filteredIdeas = useMemo(() => {
    const term = search.trim().toLowerCase();

    return ideas.filter((idea) => {
      if (status && idea.Status !== status) return false;
      if (purpose && idea.Purpose !== purpose) return false;
      if (!term) return true;

      // Drafts show no number, so only match it once submitted.
      const ideaNumber = idea.Status === "Draft" ? "" : idea.IdeaNumber || "";
      return (
        ideaNumber.toLowerCase().includes(term) ||
        (idea.Title || "").toLowerCase().includes(term)
      );
    });
  }, [ideas, search, status, purpose]);

  const totalPages = Math.max(1, Math.ceil(filteredIdeas.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageIdeas = filteredIdeas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasFilters = Boolean(search || status || purpose);

  // Any filter change goes back to the first page.
  const applyFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };
  const changeSearch = applyFilter(setSearch);
  const changeStatus = applyFilter(setStatus);
  const changePurpose = applyFilter(setPurpose);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPurpose("");
    setPage(1);
  };

  const openIdea = (idea) => {
    navigate(idea.Status === "Draft" ? `/ideas/edit/${idea.IdeaID}` : `/ideas/view/${idea.IdeaID}`);
  };

  const shareIdeaAction = (
    <Button component={Link} to="/ideas/share" size="small">
      Share an Idea
    </Button>
  );

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {successMessage && (
          <div
            role="status"
            className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm font-medium"
          >
            <span className="text-emerald-600 font-bold">✓</span>
            <p className="flex-1">{successMessage}</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setSuccessMessage("")}
              className="text-emerald-600 hover:text-emerald-800 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Ideas</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track the ideas you have shared and their progress.
            </p>
          </div>
          <Link
            to="/ideas/share"
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition flex items-center"
          >
            + Share an Idea
          </Link>
        </div>

        {/* Count Boxes */}
        <IdeaCountBoxes
          boxes={COUNT_BOXES.map((box) => ({ key: box.status, label: box.label, count: counts[box.status] || 0 }))}
          activeKey={status}
          loading={loading}
          onSelect={changeStatus}
          gridClassName="grid-cols-2 sm:grid-cols-4 lg:grid-cols-8"
        />

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex-[2]">
            <label htmlFor="idea-search" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Search
            </label>
            <input
              id="idea-search"
              type="search"
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
              placeholder="Idea number or title"
              className={selectClass}
            />
          </div>

          <div className="flex-1">
            <label htmlFor="idea-status" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Status
            </label>
            <select
              id="idea-status"
              value={status}
              onChange={(e) => changeStatus(e.target.value)}
              className={selectClass}
            >
              <option value="">All Statuses</option>
              {IDEA_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label htmlFor="idea-purpose" className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Purpose
            </label>
            <select
              id="idea-purpose"
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

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>
        )}

        {/* Ideas Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/75">
                <tr>
                  {["Idea No.", "Title", "Purpose", "Reporting Manager", "Submitted Date", "Target Date", "Status"].map(
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
                  pageIdeas.map((idea) => {
                    const isDraft = idea.Status === "Draft";
                    return (
                      <tr
                        key={idea.IdeaID}
                        onClick={() => openIdea(idea)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") openIdea(idea);
                        }}
                        tabIndex={0}
                        title={isDraft ? "Edit draft" : "View details"}
                        className="hover:bg-gray-50/50 transition cursor-pointer focus:outline-none focus:bg-indigo-50/40"
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {isDraft ? "—" : idea.IdeaNumber}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900 max-w-xs">
                          <div className="truncate">{idea.Title || "Untitled draft"}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {idea.Purpose || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {idea.LeadName || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {isDraft ? "—" : formatIdeaDate(idea.SubmittedDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatIdeaDate(idea.TargetDate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <IdeaStatusBadge status={idea.Status} overdue={idea.IsOverdue} />
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="p-0">
                      {ideas.length === 0 && !error ? (
                        <EmptyState
                          icon={<LightbulbOutlinedIcon sx={{ fontSize: 40 }} />}
                          title="You haven't shared any ideas yet."
                          description="Have an idea to improve a process?"
                          action={shareIdeaAction}
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

          {/* Pagination */}
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

export default MyIdeas;
