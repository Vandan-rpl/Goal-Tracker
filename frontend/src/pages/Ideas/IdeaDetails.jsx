import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import IdeaStatusBadge from "../../components/IdeaStatusBadge/IdeaStatusBadge";
import IdeaLeadActions from "../../components/IdeaLeadActions/IdeaLeadActions";
import { getIdea, getIdeaApiError } from "../../services/ideaService";
import { IDEAS_HOME_PATH } from "../../utils/ideasMenu";
import {
  IDEA_ACTIONS,
  formatIdeaDate,
  formatIdeaDateTime,
  getIdeaActionDisplay,
} from "../../utils/ideaStatus";

// One label/value cell in the Idea Information grid.
const InfoItem = ({ label, children }) => (
  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
    <dt className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{label}</dt>
    <dd className="mt-1.5 text-sm font-semibold text-slate-800">{children}</dd>
  </div>
);

const PersonValue = ({ name, department }) =>
  name ? (
    <>
      <span className="block">{name}</span>
      {department && <span className="block text-xs font-medium text-slate-500">{department}</span>}
    </>
  ) : (
    "—"
  );

// Opened from My Ideas, and later from Assigned to Me, Team Ideas and All
// Ideas. Access is decided by the backend.
const IdeaDetails = () => {
  const { ideaId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    const loadIdea = async () => {
      setLoading(true);
      setNotFound(false);
      setError("");

      try {
        const data = await getIdea(ideaId);
        if (ignore) return;

        // The submitter's own draft opens in the form instead.
        if (data.Status === "Draft" && data.IsSubmitter) {
          navigate(`/ideas/edit/${data.IdeaID}`, { replace: true });
          return;
        }

        setIdea(data);
      } catch (err) {
        if (ignore) return;
        const apiError = getIdeaApiError(err, "Failed to load this idea.");

        if (apiError.status === 403) {
          toast.error("You don't have access to this idea");
          navigate(IDEAS_HOME_PATH, { replace: true });
          return;
        }

        // 400 = not a valid idea id, treated the same as a missing idea.
        if (apiError.status === 404 || apiError.status === 400) {
          setNotFound(true);
        } else {
          setError(apiError.message);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadIdea();
    return () => {
      ignore = true;
    };
  }, [ideaId, navigate]);

  // Back to wherever the user came from; a direct link has no in-app history
  // (React Router's first location key is "default").
  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate(IDEAS_HOME_PATH);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-slate-50/50 min-h-screen flex flex-col items-center justify-center text-slate-500 gap-3">
        <div className="w-9 h-9 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-medium animate-pulse">Loading idea details...</p>
      </div>
    );
  }

  if (notFound || error || !idea) {
    return (
      <div className="flex-1 bg-slate-50 min-h-screen p-8 flex flex-col justify-center items-center">
        <div className="bg-red-50/80 border border-red-200 text-red-700 p-6 rounded-2xl max-w-md w-full text-center shadow-xs mb-4">
          <svg className="w-10 h-10 mx-auto text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="font-semibold text-base">{error || "Idea not found"}</p>
        </div>
        <Link
          to={IDEAS_HOME_PATH}
          className="inline-flex items-center gap-2 text-indigo-600 font-semibold hover:text-indigo-800 transition text-sm"
        >
          &larr; Back to My Ideas
        </Link>
      </div>
    );
  }

  const activity = idea.Activity || [];
  const extensionCount = activity.filter(
    (entry) => entry.Action === IDEA_ACTIONS.TIMELINE_EXTENDED,
  ).length;
  const isRejected = idea.Status === "Rejected";

  return (
    <div className="flex-1 bg-slate-50 min-h-screen overflow-y-auto py-10 px-4 sm:px-6 lg:px-8 text-slate-800">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Bar Navigation */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer shadow-xs"
          >
            <span className="transition-transform group-hover:-translate-x-1">←</span>
            <span>Back</span>
          </button>

          <IdeaStatusBadge status={idea.Status} overdue={idea.IsOverdue} />
        </div>

        {/* Main Container Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 sm:p-10 space-y-10">
          {/* Idea Header */}
          <div className="space-y-3">
            <span className="inline-block text-[11px] font-extrabold uppercase tracking-widest text-indigo-700 bg-indigo-50 px-3 py-1 rounded-md border border-indigo-200">
              {idea.Status === "Draft" ? "Draft" : idea.IdeaNumber}
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight break-words">
              {idea.Title || "Untitled idea"}
            </h1>
          </div>

          {/* Idea Information */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Idea Information
            </h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoItem label="Submitted By">
                <PersonValue name={idea.SubmitterName} department={idea.SubmitterDepartment} />
              </InfoItem>
              <InfoItem label="Purpose">{idea.Purpose || "—"}</InfoItem>
              <InfoItem label="Lead">
                <PersonValue name={idea.LeadName} department={idea.LeadDepartment} />
              </InfoItem>
              <InfoItem label="Submitted Date">{formatIdeaDate(idea.SubmittedDate)}</InfoItem>
              <InfoItem label="Accepted Date">{formatIdeaDate(idea.AcceptedDate)}</InfoItem>
              <InfoItem label="Timeline (Days)">{idea.TimelineDays ?? "—"}</InfoItem>
              <InfoItem label="Target Date">
                <span className="flex flex-wrap items-center gap-2">
                  {formatIdeaDate(idea.TargetDate)}
                  {extensionCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                      Extended {extensionCount} {extensionCount === 1 ? "time" : "times"}
                    </span>
                  )}
                </span>
              </InfoItem>
              {idea.Status === "Implemented" && (
                <InfoItem label="Implemented Date">{formatIdeaDate(idea.ImplementedDate)}</InfoItem>
              )}
            </dl>
          </section>

          {/* Description */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Description
            </h2>
            <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap break-words">
              {idea.Description || "—"}
            </p>
          </section>

          {/* Latest Remark */}
          {idea.Remarks && (
            <div
              role="status"
              className={`p-4 rounded-2xl text-sm border ${
                isRejected
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <p className="font-bold">{isRejected ? "Rejection reason" : "Latest remark"}</p>
              <p className="mt-1 whitespace-pre-wrap break-words">{idea.Remarks}</p>
            </div>
          )}

          {/* Activity Timeline */}
          <section className="space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
              Activity Timeline
            </h2>

            {activity.length === 0 ? (
              <p className="text-sm text-slate-500">No activity recorded yet.</p>
            ) : (
              <ol className="relative border-l-2 border-slate-200 ml-2 space-y-6">
                {activity.map((entry) => {
                  const display = getIdeaActionDisplay(entry.Action);

                  return (
                    <li key={entry.LogID} className="relative pl-6">
                      <span
                        className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full ring-4 ring-white ${display.dot}`}
                        aria-hidden="true"
                      />
                      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                        <p className="text-sm font-bold text-slate-900">{display.label}</p>
                        <time className="text-xs text-slate-500" dateTime={entry.ActionDate}>
                          {formatIdeaDateTime(entry.ActionDate)}
                        </time>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">by {entry.ActionByName || "Unknown"}</p>

                      {/* The backend writes the days into the remark: Accepted =
                          "Timeline: N days. ...", Timeline Extended = "Extended by
                          N days. New target date: ... Reason: ..." */}
                      {entry.Remark && (
                        <p className="text-sm text-slate-700 mt-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 whitespace-pre-wrap break-words">
                          {entry.Remark}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* Lead Actions: only for the idea's lead */}
          {idea.IsLead && (
            <section className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-5 space-y-3">
              <h2 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Lead Actions</h2>
              <IdeaLeadActions
                idea={idea}
                onUpdated={(updatedIdea, message) => {
                  // The API returns the refreshed idea and activity log.
                  setIdea(updatedIdea);
                  toast.success(message);
                }}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdeaDetails;
