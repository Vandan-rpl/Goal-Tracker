import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ManageSearchOutlinedIcon from "@mui/icons-material/ManageSearchOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import TableLoader from "../../components/loaders/TableLoader";
import EmptyState from "../../components/EmptyState/EmptyState";
import IdeaStatusBadge from "../../components/IdeaStatusBadge/IdeaStatusBadge";
import TablePagination from "../../components/TablePagination/TablePagination";
import SearchableSelect from "../../components/SearchableSelect/SearchableSelect";
import { getIdeaApiError, getTrackIdeaInitiators, trackIdeas } from "../../services/ideaService";
import { formatIdeaDate, getTodayKey } from "../../utils/ideaStatus";

const PAGE_SIZE = 20;
const COLUMNS = ["Idea Number", "Title", "Initiated By", "Submitted Date", "Status", "Pending With"];

const inputClass =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const labelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

// Search any idea the user may see (the backend applies the visibility rules
// and leaves out Drafts). Filled-in fields must all match. The last search is
// kept in the URL, so Back from Idea Details shows the same results.
const TrackIdea = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlIdeaNumber = searchParams.get("ideaNumber") || "";
  const urlSubmittedDate = searchParams.get("submittedDate") || "";
  const urlInitiatedBy = searchParams.get("initiatedBy") || "";
  const urlPage = Math.max(1, Number(searchParams.get("page")) || 1);
  const hasSearch = Boolean(urlIdeaNumber || urlSubmittedDate || urlInitiatedBy);
  const searchKey = hasSearch ? searchParams.toString() : "";

  // The form, starting from the search in the URL.
  const [ideaNumber, setIdeaNumber] = useState(urlIdeaNumber);
  const [submittedDate, setSubmittedDate] = useState(urlSubmittedDate);
  const [initiatedBy, setInitiatedBy] = useState(Number(urlInitiatedBy) || null);

  // null until loaded.
  const [initiators, setInitiators] = useState(null);
  const [initiatorsError, setInitiatorsError] = useState("");

  // The response for the search in `key`; until it matches searchKey the
  // current search is still loading.
  const [response, setResponse] = useState({ key: "", data: null, error: "" });

  useEffect(() => {
    let ignore = false;

    getTrackIdeaInitiators()
      .then((list) => {
        if (!ignore) setInitiators(list || []);
      })
      .catch((err) => {
        if (ignore) return;
        setInitiatorsError(getIdeaApiError(err, "Unable to load employees.").message);
        setInitiators([]);
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!searchKey) return undefined;
    let ignore = false;

    trackIdeas({
      ideaNumber: urlIdeaNumber || undefined,
      submittedDate: urlSubmittedDate || undefined,
      initiatedBy: urlInitiatedBy || undefined,
      page: urlPage,
      pageSize: PAGE_SIZE,
    })
      .then((data) => {
        if (!ignore) setResponse({ key: searchKey, data, error: "" });
      })
      .catch((err) => {
        if (!ignore) {
          setResponse({ key: searchKey, data: null, error: getIdeaApiError(err, "Failed to search ideas.").message });
        }
      });

    return () => {
      ignore = true;
    };
  }, [searchKey, urlIdeaNumber, urlSubmittedDate, urlInitiatedBy, urlPage]);

  const loading = hasSearch && response.key !== searchKey;
  const result = hasSearch && !loading ? response.data : null;
  const error = hasSearch && !loading ? response.error : "";

  const initiatorOptions = useMemo(
    () =>
      (initiators || []).map((user) => ({
        value: user.UserID,
        label: user.EmployeeCode ? `${user.FullName} (${user.EmployeeCode})` : user.FullName,
      })),
    [initiators],
  );

  const canSearch = Boolean(ideaNumber.trim() || submittedDate || initiatedBy);
  const canClear = canSearch || hasSearch;

  // Only the filled-in fields go in the URL.
  const searchParamsFor = (page) => {
    const params = { page: String(page) };
    if (ideaNumber.trim()) params.ideaNumber = ideaNumber.trim();
    if (submittedDate) params.submittedDate = submittedDate;
    if (initiatedBy) params.initiatedBy = String(initiatedBy);
    return params;
  };

  const runSearch = (event) => {
    event.preventDefault();
    if (canSearch) setSearchParams(searchParamsFor(1));
  };

  const clearSearch = () => {
    setIdeaNumber("");
    setSubmittedDate("");
    setInitiatedBy(null);
    setSearchParams({}, { replace: true });
  };

  // Paging keeps the search that produced the results, not unsaved edits.
  const changePage = (page) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    setSearchParams(params);
  };

  const openIdea = (idea) => navigate(`/ideas/view/${idea.IdeaID}`);

  const items = result?.items || [];

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">Track Idea</h1>
          <p className="text-sm text-gray-500 mt-1">
            Find an idea by its number, the date it was submitted, or who submitted it, and see where it is
            in the approval process. Fill in one or more fields.
          </p>
        </div>

        {/* Search */}
        <form
          onSubmit={runSearch}
          className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:flex-row gap-4"
        >
          <div className="flex-1">
            <label htmlFor="track-idea-number" className={labelClass}>
              Idea Number
            </label>
            <input
              id="track-idea-number"
              type="search"
              value={ideaNumber}
              onChange={(e) => setIdeaNumber(e.target.value)}
              placeholder="e.g. 0012"
              maxLength={50}
              className={inputClass}
            />
          </div>

          <div className="lg:w-48">
            <label htmlFor="track-idea-date" className={labelClass}>
              Idea Date
            </label>
            <input
              id="track-idea-date"
              type="date"
              value={submittedDate}
              onChange={(e) => setSubmittedDate(e.target.value)}
              max={getTodayKey()}
              className={inputClass}
            />
          </div>

          <div className="flex-1">
            <label htmlFor="track-initiated-by" className={labelClass}>
              Initiated By
            </label>
            <SearchableSelect
              id="track-initiated-by"
              options={initiatorOptions}
              value={initiatedBy}
              onChange={setInitiatedBy}
              placeholder="Search by name or employee code"
              loading={initiators === null}
              noOptionsText={initiatorOptions.length === 0 ? "No employees available" : "No matches found"}
            />
            {initiatorsError && <p className="text-red-600 text-xs mt-1 font-medium">{initiatorsError}</p>}
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={!canSearch}
              className="flex-1 lg:flex-none px-6 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Search
            </button>
            <button
              type="button"
              onClick={clearSearch}
              disabled={!canClear}
              className="flex-1 lg:flex-none px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear
            </button>
          </div>
        </form>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>
        )}

        {/* Results */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {!hasSearch ? (
            <EmptyState
              icon={<ManageSearchOutlinedIcon sx={{ fontSize: 40 }} />}
              title="Search for an idea"
              description="Fill in one or more fields and select Search."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50/75">
                    <tr>
                      {COLUMNS.map((heading) => (
                        <th
                          key={heading}
                          className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                        >
                          {heading}
                        </th>
                      ))}
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
                            {idea.SubmitterEmployeeCode && (
                              <div className="text-xs text-gray-400">{idea.SubmitterEmployeeCode}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatIdeaDate(idea.SubmittedDate)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <IdeaStatusBadge status={idea.Status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {idea.PendingWithName || "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={COLUMNS.length} className="p-0">
                          {!error && (
                            <EmptyState
                              icon={<SearchOffOutlinedIcon sx={{ fontSize: 40 }} />}
                              title="No ideas found"
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
                  onPageChange={changePage}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackIdea;
