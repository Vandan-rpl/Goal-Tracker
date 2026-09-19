import { useEffect, useState } from "react";
import { getGoalHistory } from "../../services/goalService";

const FIELD_LABELS = {
  GoalNumber: "Goal Number",
  GoalTitle: "Goal Title",
  GoalDescription: "Description",
  Measurability: "Measurability",
  JointAccountability: "Joint Accountability",
  Weightage: "Weightage",
  Priority: "Priority",
  Timeline: "Timeline",
  MeetPerformance: "Meet Performance",
  ExceedPerformance: "Exceed Performance",
  ValidationSource: "Validation Source",
  CrossFunctionalGoal: "Cross-Functional Goal",
  GoalCategory: "Category",
  GoalStatus: "Status",
};

const formatValue = (val) => {
  if (val === null || val === undefined || val === "") {
    return <span className="italic text-slate-400 font-normal">—</span>;
  }
  return String(val);
};

const getInitials = (name) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
};

export default function GoalHistory({ goalId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openEntries, setOpenEntries] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getGoalHistory(goalId)
      .then((data) => {
        if (!cancelled) {
          const list = data.history || [];
          setHistory(list);
          // Expand the most recent history entry by default
          if (list.length > 0) {
            setOpenEntries({ [list[0].historyId]: true });
          }
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load goal history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [goalId]);

  const toggleEntry = (id) => {
    setOpenEntries((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // State: Loading
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl border border-slate-200/80 shadow-sm">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-3" />
        <span className="text-sm font-medium">Loading history timeline…</span>
      </div>
    );
  }

  // State: Error
  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 text-sm text-red-700 bg-red-50 rounded-xl border border-red-200">
        <svg className="h-5 w-5 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
        </svg>
        <span className="font-medium">{error}</span>
      </div>
    );
  }

  // State: Empty
  if (history.length === 0) {
    return (
      <div className="text-center p-10 bg-white rounded-xl border border-slate-200/80 shadow-sm">
        <div className="inline-flex p-3 rounded-full bg-slate-100 text-slate-400 mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h4 className="text-base font-semibold text-slate-800">No history recorded</h4>
        <p className="text-sm text-slate-500 mt-1">No changes have been made to this goal yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        {/* <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-bold text-slate-800">Audit History</h3>
        </div> */}
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
          {history.length} {history.length === 1 ? "Revision" : "Revisions"}
        </span>
      </div>

      {/* Timeline container */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {history.map((entry, index) => {
          const isOpen = !!openEntries[entry.historyId];
          const hasChanges = entry.changes && entry.changes.length > 0;

          return (
            <div key={entry.historyId || index} className="relative group">
              {/* Timeline Bullet Node */}
              <div
                className={`absolute -left-6 top-4 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 bg-white transition-colors duration-200 ${
                  isOpen
                    ? "border-indigo-600 bg-indigo-600 ring-4 ring-indigo-50"
                    : "border-slate-300 group-hover:border-slate-400"
                }`}
              />

              {/* Revision Card */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden transition-all hover:border-slate-300 hover:shadow">
                {/* Card Header */}
                <button
                  type="button"
                  onClick={() => toggleEntry(entry.historyId)}
                  className="w-full flex items-center gap-3 p-4 text-left bg-white hover:bg-slate-50/80 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
                >
                  {/* Avatar */}
                  <div className="flex shrink-0 items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-semibold text-xs shadow-sm">
                    {getInitials(entry.performedBy)}
                  </div>

                  {/* Performer & Timestamp */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {entry.performedBy || "Unknown user"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(entry.performedDate).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>

                  {/* Remarks tag */}
                  {entry.remarks && (
                    <div className="hidden sm:block max-w-[200px] truncate text-xs italic text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200/60" title={entry.remarks}>
                      "{entry.remarks}"
                    </div>
                  )}

                  {/* Controls / Metadata */}
                  <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60">
                      {hasChanges
                        ? `${entry.changes.length} change${entry.changes.length > 1 ? "s" : ""}`
                        : "No field changes"}
                    </span>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180 text-slate-600" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Mobile Remarks view */}
                {entry.remarks && (
                  <div className="sm:hidden px-4 pb-3 -mt-1 text-xs italic text-slate-600">
                    Remark: "{entry.remarks}"
                  </div>
                )}

                {/* Card Body - Field Changes */}
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4">
                    {!hasChanges ? (
                      <p className="text-xs italic text-slate-500 py-1">
                        No field-level changes recorded for this entry.
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold tracking-wider uppercase text-[10px]">
                              <th className="py-2.5 px-3.5 w-1/4">Field</th>
                              <th className="py-2.5 px-3.5 w-3/8">Previous Value</th>
                              <th className="py-2.5 px-3.5 w-3/8">New Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {entry.changes.map((change) => (
                              <tr key={change.field} className="hover:bg-slate-50/50">
                                <td className="py-2.5 px-3.5 font-semibold text-slate-800 align-top">
                                  {FIELD_LABELS[change.field] || change.field}
                                </td>
                                <td className="py-2.5 px-3.5 text-rose-700 bg-rose-50/60 font-mono text-[11px] align-top break-words ">
                                  {formatValue(change.oldValue)}
                                </td>
                                <td className="py-2.5 px-3.5 text-emerald-800 bg-emerald-50/60 font-mono text-[11px] align-top break-words font-medium">
                                  {formatValue(change.newValue)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}