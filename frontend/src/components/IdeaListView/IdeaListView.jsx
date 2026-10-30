import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import TableLoader from "../loaders/TableLoader";
import EmptyState from "../EmptyState/EmptyState";
import IdeaStatusBadge from "../IdeaStatusBadge/IdeaStatusBadge";
import IdeaCountBoxes from "../IdeaCountBoxes/IdeaCountBoxes";
import IdeaDaysLeft from "../IdeaDaysLeft/IdeaDaysLeft";
import TablePagination from "../TablePagination/TablePagination";
import { getIdeaApiError } from "../../services/ideaService";
import { IDEA_STATUSES, formatIdeaDate } from "../../utils/ideaStatus";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

// Lists never contain Drafts.
const STATUS_OPTIONS = IDEA_STATUSES.filter((status) => status !== "Draft");

const COUNT_BOXES = [
  { key: "Submitted", label: "Submitted" },
  { key: "Pending Final Approval", label: "Pending Final Approval" },
  { key: "Active", label: "Active" },
  { key: "In Implementation", label: "In Implementation" },
  { key: "Overdue", label: "Overdue", tone: "danger" },
  { key: "Implemented", label: "Implemented" },
  { key: "Rejected", label: "Rejected" },
];

// `sortKey` = the API's sortBy value; `firstDir` = direction on first click.
const COLUMNS = [
  { label: "Idea No.", sortKey: "ideaNumber", firstDir: "desc" },
  { label: "Title", sortKey: "title", firstDir: "asc" },
  { label: "Submitted By", sortKey: "submitter", firstDir: "asc" },
  { label: "Reporting Manager" },
  { label: "Final Approver" },
  { label: "Purpose" },
  { label: "Submitted Date", sortKey: "submittedDate", firstDir: "desc" },
  { label: "Target Date", sortKey: "targetDate", firstDir: "asc" },
  { label: "Status", sortKey: "status", firstDir: "asc" },
  { label: "Days Left" },
];

const DEFAULT_SORT_BY = "submittedDate";
const DEFAULT_SORT_DIR = "desc";

// URL params that count as filters (sorting and paging don't).
const BASE_FILTER_PARAMS = ["search", "status", "purpose", "overdueOnly", "submittedFrom", "submittedTo"];

const selectClass =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500";
const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

// Keep a selected value visible even if it's not in the loaded options
// (e.g. a link with an old purpose).
const withSelected = (options, value) =>
  value && !options.some((option) => option.value === value) ? [{ value, label: value }, ...options] : options;

const PersonCell = ({ name, department }) =>
  name ? (
    <>
      <div className="text-sm font-medium text-gray-900">{name}</div>
      {department && <div className="text-xs text-gray-400">{department}</div>}
    </>
  ) : (
    <span className="text-sm text-gray-400">—</span>
  );

/**
 * View-only ideas list shared by Team Ideas and All Ideas: count boxes,
 * filters, a sortable table and paging, all served by the backend.
 *
 * Filters, sort and page live in the URL query string, so they survive
 * opening an idea and coming back (and a refresh or a shared link).
 *
 * Props:
 *   title, description
 *   fetchIdeas(params)      -> { items, total, page, totalPages, counts }
 *   fetchFilterOptions()    -> { purposes, ...extra filter lists }
 *   extraFilters            -> [{ param, label, allLabel, getOptions(filterOptions) -> [{ value, label }] }]
 *   emptyTitle              -> shown when there are no ideas at all
 */
export default function IdeaListView({ title, description, fetchIdeas, fetchFilterOptions, extraFilters = [], emptyTitle }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const paramsKey = searchParams.toString();
  const getParam = (name) => searchParams.get(name) || "";

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ purposes: [] });

  const status = getParam("status");
  const overdueOnly = getParam("overdueOnly") === "true";
  const sortBy = getParam("sortBy") || DEFAULT_SORT_BY;
  const sortDir = getParam("sortDir") || DEFAULT_SORT_DIR;

  const filterParams = [...BASE_FILTER_PARAMS, ...extraFilters.map((filter) => filter.param)];
  const hasFilters = filterParams.some((name) => searchParams.get(name));

  // Set/remove query params; any filter or sort change goes back to page 1.
  // `replace` keeps filter tweaks out of the Back-button history.
  const updateParams = useCallback(
    (updates, { resetPage = true } = {}) => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          Object.entries(updates).forEach(([name, value]) => {
            if (value === "" || value === null || value === undefined || value === false) next.delete(name);
            else next.set(name, String(value));
          });
          if (resetPage) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // Search box: typed locally, written to the URL after a short pause.
  const urlSearch = getParam("search");
  const [searchText, setSearchText] = useState(urlSearch);
  const [prevUrlSearch, setPrevUrlSearch] = useState(urlSearch);
  if (urlSearch !== prevUrlSearch) {
    // URL changed from outside the box (e.g. Clear filters).
    setPrevUrlSearch(urlSearch);
    if (urlSearch !== searchText.trim()) setSearchText(urlSearch);
  }

  useEffect(() => {
    const value = searchText.trim();
    if (value === urlSearch) return undefined;
    const timer = setTimeout(() => updateParams({ search: value }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, urlSearch, updateParams]);

  useEffect(() => {
    let ignore = false;

    const loadOptions = async () => {
      try {
        const options = await fetchFilterOptions();
        if (!ignore) setFilterOptions({ purposes: [], ...options });
      } catch (err) {
        // The list still works; only the dropdown choices are missing.
        console.error("Error loading idea filter options", err);
      }
    };

    loadOptions();
    return () => {
      ignore = true;
    };
  }, [fetchFilterOptions]);

  useEffect(() => {
    let ignore = false;

    const loadIdeas = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = Object.fromEntries(new URLSearchParams(paramsKey));
        const data = await fetchIdeas({ ...params, pageSize: PAGE_SIZE });
        if (ignore) return;

        // A page past the end (e.g. after narrowing the filters in another
        // tab) goes to the last page instead of showing nothing.
        if (data.items.length === 0 && data.total > 0 && data.page > data.totalPages) {
          updateParams({ page: data.totalPages }, { resetPage: false });
          return;
        }

        setResult(data);
      } catch (err) {
        if (!ignore) {
          setResult(null);
          setError(getIdeaApiError(err, "Failed to load ideas."));
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadIdeas();
    return () => {
      ignore = true;
    };
  }, [paramsKey, fetchIdeas, updateParams]);

  // Count boxes: Overdue filters on the overdue flag, the others on status.
  // Clicking the active box again clears it.
  const activeBox = overdueOnly ? (status ? null : "Overdue") : status;
  const selectBox = (key) => {
    const clear = key === activeBox;
    updateParams({
      status: clear || key === "Overdue" ? "" : key,
      overdueOnly: !clear && key === "Overdue" ? "true" : "",
    });
  };

  const clearFilters = () => {
    setSearchText("");
    updateParams(Object.fromEntries(filterParams.map((name) => [name, ""])));
  };

  const changeSort = (column) => {
    const nextDir = sortBy === column.sortKey ? (sortDir === "asc" ? "desc" : "asc") : column.firstDir;
    updateParams({ sortBy: column.sortKey, sortDir: nextDir });
  };

  const counts = result?.counts || {};
  const items = result?.items || [];
  const purposeOptions = withSelected(
    (filterOptions.purposes || []).map((purpose) => ({ value: purpose, label: purpose })),
    getParam("purpose"),
  );

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>

        {/* Count Boxes (current filters, ignoring status) */}
        <IdeaCountBoxes
          boxes={COUNT_BOXES.map((box) => ({ ...box, count: counts[box.key] || 0 }))}
          activeKey={activeBox}
          loading={loading && !result}
          onSelect={selectBox}
          gridClassName="grid-cols-2 sm:grid-cols-4 lg:grid-cols-7"
        />

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="idea-list-search" className={labelClass}>
                Search
              </label>
              <input
                id="idea-list-search"
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Idea number or title"
                className={selectClass}
              />
            </div>

            <div>
              <label htmlFor="idea-list-status" className={labelClass}>
                Status
              </label>
              <select
                id="idea-list-status"
                value={status}
                onChange={(e) => updateParams({ status: e.target.value })}
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

            <div>
              <label htmlFor="idea-list-purpose" className={labelClass}>
                Purpose
              </label>
              <select
                id="idea-list-purpose"
                value={getParam("purpose")}
                onChange={(e) => updateParams({ purpose: e.target.value })}
                className={selectClass}
              >
                <option value="">All Purposes</option>
                {purposeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {extraFilters.map((filter) => {
              const value = getParam(filter.param);
              const options = withSelected(filter.getOptions(filterOptions), value);
              return (
                <div key={filter.param}>
                  <label htmlFor={`idea-list-${filter.param}`} className={labelClass}>
                    {filter.label}
                  </label>
                  <select
                    id={`idea-list-${filter.param}`}
                    value={value}
                    onChange={(e) => updateParams({ [filter.param]: e.target.value })}
                    className={selectClass}
                  >
                    <option value="">{filter.allLabel}</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}

            <div>
              <label htmlFor="idea-list-from" className={labelClass}>
                Submitted From
              </label>
              <input
                id="idea-list-from"
                type="date"
                value={getParam("submittedFrom")}
                max={getParam("submittedTo") || undefined}
                onChange={(e) => updateParams({ submittedFrom: e.target.value })}
                className={selectClass}
              />
            </div>

            <div>
              <label htmlFor="idea-list-to" className={labelClass}>
                Submitted To
              </label>
              <input
                id="idea-list-to"
                type="date"
                value={getParam("submittedTo")}
                min={getParam("submittedFrom") || undefined}
                onChange={(e) => updateParams({ submittedTo: e.target.value })}
                className={selectClass}
              />
            </div>
          </div>

          {(overdueOnly || hasFilters) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* The overdue filter has no dropdown, so show it as a removable chip. */}
              {overdueOnly ? (
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-semibold">
                  Overdue only
                  <button
                    type="button"
                    aria-label="Remove overdue filter"
                    onClick={() => updateParams({ overdueOnly: "" })}
                    className="hover:text-red-900 cursor-pointer"
                  >
                    ✕
                  </button>
                </span>
              ) : (
                <span />
              )}
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
            <p>{error.message}</p>
            {error.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5 font-normal">
                {error.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Ideas Table Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/75">
                <tr>
                  {COLUMNS.map((column) => {
                    const sorted = column.sortKey && sortBy === column.sortKey;
                    return (
                      <th
                        key={column.label}
                        aria-sort={sorted ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {column.sortKey ? (
                          <button
                            type="button"
                            onClick={() => changeSort(column)}
                            className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-gray-800 ${
                              sorted ? "text-gray-800" : ""
                            }`}
                          >
                            {column.label}
                            <span aria-hidden="true" className={sorted ? "" : "opacity-30"}>
                              {sorted && sortDir === "asc" ? "▲" : "▼"}
                            </span>
                          </button>
                        ) : (
                          column.label
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="p-0">
                      <TableLoader rows={5} columns={COLUMNS.length} showToolbar={false} paper={false} />
                    </td>
                  </tr>
                ) : items.length > 0 ? (
                  items.map((idea) => (
                    <tr
                      key={idea.IdeaID}
                      onClick={() => navigate(`/ideas/view/${idea.IdeaID}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") navigate(`/ideas/view/${idea.IdeaID}`);
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
                        <PersonCell name={idea.SubmitterName} department={idea.SubmitterDepartment} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PersonCell name={idea.LeadName} department={idea.LeadDepartment} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PersonCell name={idea.FinalApproverName} department={idea.FinalApproverDepartment} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{idea.Purpose || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatIdeaDate(idea.SubmittedDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatIdeaDate(idea.TargetDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <IdeaStatusBadge status={idea.Status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <IdeaDaysLeft idea={idea} />
                      </td>
                    </tr>
                  ))
                ) : error ? null : (
                  <tr>
                    <td colSpan={COLUMNS.length} className="p-0">
                      {!hasFilters && !counts.Total ? (
                        <EmptyState icon={<LightbulbOutlinedIcon sx={{ fontSize: 40 }} />} title={emptyTitle} />
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

          {!loading && result && (
            <TablePagination
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              onPageChange={(nextPage) => updateParams({ page: nextPage > 1 ? nextPage : "" }, { resetPage: false })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
