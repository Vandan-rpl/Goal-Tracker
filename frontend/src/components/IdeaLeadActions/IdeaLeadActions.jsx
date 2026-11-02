import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import SearchableSelect from "../SearchableSelect/SearchableSelect";
import {
  approveIdeaClosure,
  approveIdeaExtension,
  finalApproveIdea,
  finalRejectIdea,
  getIdeaApiError,
  getIdeaFinalApprovers,
  managerApproveIdea,
  managerRejectIdea,
  rejectIdeaClosure,
  rejectIdeaExtension,
  requestIdeaClosure,
  requestIdeaExtension,
  startIdeaImplementation,
} from "../../services/ideaService";
import {
  addDaysToDateKey,
  formatDays,
  formatIdeaDate,
  getTodayKey,
} from "../../utils/ideaStatus";

const DAYS_MIN = 1;
const DAYS_MAX = 365;
// Same limit as the backend (keeps the activity log text under 1000 chars).
const REMARK_MAX = 900;

const inputClass = (hasError) =>
  `w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
    hasError ? "border-red-500" : "border-slate-300"
  }`;

const BUTTON_STYLES = {
  primary: "bg-emerald-600 hover:bg-emerald-700 text-white",
  danger: "bg-white hover:bg-rose-50 text-rose-700 border border-rose-200",
  warning: "bg-white hover:bg-amber-50 text-amber-800 border border-amber-300",
};

const REJECT_REMARK = {
  label: "Reason for rejection",
  required: true,
  helper: "Please explain why the idea is being rejected; the submitter will see this.",
};

const REJECT_REQUEST_REMARK = {
  label: "Reason for rejection",
  required: true,
  helper: "Please explain why the request is being rejected; the idea owner will see this.",
};

// Each action: its button, dialog fields and API call.
//   finalApprover -> final approver dropdown
//   days          -> number input (1-365)
//   date          -> date input (after today)
//   remark        -> textarea
//   showRequest   -> shows the owner's pending request
const ACTIONS = {
  managerApprove: {
    label: "Approve",
    buttonStyle: "primary",
    title: "Approve idea",
    message:
      "Choose the final approver and set how many days the implementation needs. The target date is counted from the day the final approver approves.",
    finalApprover: { label: "Final approver" },
    days: { label: "Timeline (days)" },
    remark: { label: "Remark", required: false, placeholder: "Optional note for the submitter" },
    confirmLabel: "Approve",
    busyLabel: "Approving...",
    tone: "success",
    successMessage: "Idea approved and sent for final approval.",
    submit: (ideaId, { finalApproverId, days, remark }) =>
      managerApproveIdea(ideaId, { finalApproverId, timelineDays: days, remark }),
  },
  managerReject: {
    label: "Reject",
    buttonStyle: "danger",
    title: "Reject idea",
    remark: REJECT_REMARK,
    confirmLabel: "Reject",
    busyLabel: "Rejecting...",
    tone: "danger",
    successMessage: "Idea rejected.",
    submit: (ideaId, { remark }) => managerRejectIdea(ideaId, { remark }),
  },
  finalApprove: {
    label: "Approve",
    buttonStyle: "primary",
    title: "Give final approval",
    message: "The idea moves straight to In Implementation, and the target date is counted from today.",
    remark: { label: "Remark", required: false, placeholder: "Optional" },
    confirmLabel: "Approve",
    busyLabel: "Approving...",
    tone: "success",
    successMessage: "Idea approved. It is now In Implementation.",
    submit: (ideaId, { remark }) => finalApproveIdea(ideaId, { remark }),
  },
  finalReject: {
    label: "Reject",
    buttonStyle: "danger",
    title: "Reject idea",
    remark: REJECT_REMARK,
    confirmLabel: "Reject",
    busyLabel: "Rejecting...",
    tone: "danger",
    successMessage: "Idea rejected.",
    submit: (ideaId, { remark }) => finalRejectIdea(ideaId, { remark }),
  },
  start: {
    label: "Start Implementation",
    buttonStyle: "primary",
    title: "Start implementation?",
    message: "The idea will move to In Implementation.",
    remark: { label: "Remark", required: false, placeholder: "Optional" },
    confirmLabel: "Start Implementation",
    busyLabel: "Starting...",
    tone: "success",
    successMessage: "Implementation started.",
    submit: (ideaId, { remark }) => startIdeaImplementation(ideaId, { remark }),
  },
  // Idea owner's requests (the reporting manager approves or rejects them).
  requestClosure: {
    label: "Request Closure",
    buttonStyle: "primary",
    title: "Request closure",
    message:
      "Your reporting manager will be asked to approve closing this idea. Once approved, it is marked as Implemented.",
    remark: { label: "Closure remark", required: true, placeholder: "What was implemented and why the idea can be closed" },
    confirmLabel: "Send Request",
    busyLabel: "Sending...",
    tone: "success",
    successMessage: "Closure request sent to your reporting manager.",
    submit: (ideaId, { remark }) => requestIdeaClosure(ideaId, { remark }),
  },
  requestExtension: {
    label: "Request Extension",
    buttonStyle: "warning",
    title: "Request timeline extension",
    message: "Your reporting manager will be asked to approve the new target date.",
    date: { label: "New target date" },
    remark: { label: "Reason", required: true, placeholder: "Why is more time needed?" },
    confirmLabel: "Send Request",
    busyLabel: "Sending...",
    tone: "success",
    successMessage: "Extension request sent to your reporting manager.",
    submit: (ideaId, { date, remark }) => requestIdeaExtension(ideaId, { newTargetDate: date, reason: remark }),
  },
  // Reporting manager's decision on the owner's request.
  approveClosure: {
    label: "Approve Closure",
    buttonStyle: "primary",
    title: "Approve closure?",
    message: "The idea will be marked as Implemented. This is the final step.",
    showRequest: true,
    remark: { label: "Remark", required: false, placeholder: "Optional note for the idea owner" },
    confirmLabel: "Approve Closure",
    busyLabel: "Approving...",
    tone: "success",
    successMessage: "Closure approved. The idea is now Implemented.",
    submit: (ideaId, { remark }) => approveIdeaClosure(ideaId, { remark }),
  },
  rejectClosure: {
    label: "Reject Closure",
    buttonStyle: "danger",
    title: "Reject closure request",
    message: "The idea stays In Implementation.",
    showRequest: true,
    remark: REJECT_REQUEST_REMARK,
    confirmLabel: "Reject",
    busyLabel: "Rejecting...",
    tone: "danger",
    successMessage: "Closure request rejected.",
    submit: (ideaId, { remark }) => rejectIdeaClosure(ideaId, { remark }),
  },
  approveExtension: {
    label: "Approve Extension",
    buttonStyle: "primary",
    title: "Approve timeline extension?",
    message: "The requested date becomes the new target date.",
    showRequest: true,
    remark: { label: "Remark", required: false, placeholder: "Optional note for the idea owner" },
    confirmLabel: "Approve Extension",
    busyLabel: "Approving...",
    tone: "success",
    successMessage: "Extension approved. The target date has been updated.",
    submit: (ideaId, { remark }) => approveIdeaExtension(ideaId, { remark }),
  },
  rejectExtension: {
    label: "Reject Extension",
    buttonStyle: "danger",
    title: "Reject extension request",
    message: "The target date stays unchanged. The idea owner can send a new request.",
    showRequest: true,
    remark: REJECT_REQUEST_REMARK,
    confirmLabel: "Reject",
    busyLabel: "Rejecting...",
    tone: "danger",
    successMessage: "Extension request rejected.",
    submit: (ideaId, { remark }) => rejectIdeaExtension(ideaId, { remark }),
  },
};

// Reporting manager's buttons for the owner's pending request.
const PENDING_REQUEST_ACTIONS = {
  Close: ["approveClosure", "rejectClosure"],
  Extend: ["approveExtension", "rejectExtension"],
};

// Buttons available to the viewer for the idea's status: the idea owner
// (IsSubmitter; CanRequest* from the backend), the reporting manager
// (IsLead) or the final approver (IsFinalApprover). The backend checks the
// same rules.
const getAvailableActions = (idea) => {
  if (idea.IsFinalApprover && idea.Status === "Pending Final Approval") return ["finalApprove", "finalReject"];
  if (idea.IsSubmitter) {
    return [idea.CanRequestClosure && "requestClosure", idea.CanRequestExtension && "requestExtension"].filter(Boolean);
  }
  if (!idea.IsLead) return [];
  if (idea.Status === "Submitted") return ["managerApprove", "managerReject"];

  const requestActions = PENDING_REQUEST_ACTIONS[idea.PendingRequestType] || [];
  // Active = final-approved before approval went straight to In Implementation.
  if (idea.Status === "Active") return ["start", ...requestActions];
  if (idea.Status === "In Implementation") return requestActions;
  return [];
};

const parseDays = (value) => (/^\d+$/.test(String(value).trim()) ? Number(value) : NaN);

const isValidDays = (days) => Number.isInteger(days) && days >= DAYS_MIN && days <= DAYS_MAX;

function LeadActionDialog({ actionKey, idea, onClose, onCompleted }) {
  const action = ACTIONS[actionKey];

  const [finalApproverId, setFinalApproverId] = useState(null);
  const [days, setDays] = useState("");
  const [date, setDate] = useState("");
  const [remark, setRemark] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [approvers, setApprovers] = useState([]);
  const [approversLoading, setApproversLoading] = useState(Boolean(action.finalApprover));
  const [approversError, setApproversError] = useState("");

  useEffect(() => {
    if (!action.finalApprover) return undefined;
    let ignore = false;

    getIdeaFinalApprovers()
      .then((list) => {
        if (!ignore) setApprovers(list || []);
      })
      .catch((err) => {
        if (!ignore) setApproversError(getIdeaApiError(err, "Unable to load the final approvers.").message);
      })
      .finally(() => {
        if (!ignore) setApproversLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [action.finalApprover]);

  // The viewer here is the reporting manager (AssignedLeadID); neither they
  // nor the submitter can be the final approver.
  const approverOptions = useMemo(
    () =>
      approvers
        .filter((approver) => approver.UserID !== idea.AssignedLeadID && approver.UserID !== idea.UserID)
        .map((approver) => ({
          value: approver.UserID,
          label: [approver.FullName, approver.Designation, approver.DepartmentName].filter(Boolean).join(" – "),
        })),
    [approvers, idea.AssignedLeadID, idea.UserID],
  );

  const daysValue = parseDays(days);
  const daysValid = isValidDays(daysValue);
  const todayKey = getTodayKey();
  // The new target date must be a future date.
  const minDateKey = addDaysToDateKey(todayKey, 1);

  // Live previews
  const finalTargetKey =
    actionKey === "finalApprove" && idea.TimelineDays ? addDaysToDateKey(todayKey, idea.TimelineDays) : "";
  const overdueDays = idea.IsOverdue ? Math.abs(idea.DaysRemaining ?? 0) : 0;

  const validate = () => {
    const errors = {};

    if (action.finalApprover && !finalApproverId) {
      errors.finalApprover = "Select a final approver.";
    }

    if (action.days && !daysValid) {
      errors.days = `Enter a whole number from ${DAYS_MIN} to ${DAYS_MAX}.`;
    }

    if (action.date && !date) {
      errors.date = `${action.date.label} is required.`;
    } else if (action.date && date < minDateKey) {
      errors.date = `${action.date.label} must be a future date.`;
    }

    if (action.remark.required && !remark.trim()) {
      errors.remark = `${action.remark.label} is required.`;
    } else if (remark.trim().length > REMARK_MAX) {
      errors.remark = `${action.remark.label} cannot exceed ${REMARK_MAX} characters.`;
    }

    return errors;
  };

  const handleConfirm = async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setBusy(true);
    setApiError(null);

    try {
      const updatedIdea = await action.submit(idea.IdeaID, {
        finalApproverId,
        days: daysValue,
        date,
        remark: remark.trim(),
      });
      onCompleted(updatedIdea, action.successMessage);
    } catch (err) {
      // Keep the dialog open with what was entered.
      setApiError(getIdeaApiError(err, `Failed to ${action.label.toLowerCase()}.`));
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      title={action.title}
      message={action.message}
      confirmLabel={action.confirmLabel}
      busyLabel={action.busyLabel}
      tone={action.tone}
      busy={busy}
      autoFocusConfirm={false}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="space-y-4">
        {action.showRequest && idea.PendingRequestType && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 space-y-1">
            {idea.PendingRequestType === "Extend" && (
              <p>
                Target date: <span className="font-semibold">{formatIdeaDate(idea.TargetDate)}</span> &rarr; requested{" "}
                <span className="font-semibold">{formatIdeaDate(idea.PendingRequestedTargetDate)}</span>
              </p>
            )}
            <p className="font-semibold">
              {idea.PendingRequestType === "Extend" ? "Owner's reason" : "Owner's closure remark"}
            </p>
            <p className="whitespace-pre-wrap break-words">{idea.PendingRequestRemark || "—"}</p>
          </div>
        )}

        {actionKey === "requestExtension" && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p>
              Current target date: <span className="font-semibold">{formatIdeaDate(idea.TargetDate)}</span>
            </p>
            {overdueDays > 0 && <p className="font-semibold mt-0.5">Overdue by {formatDays(overdueDays)}</p>}
          </div>
        )}

        {finalTargetKey && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p>
              Timeline set by the reporting manager:{" "}
              <span className="font-semibold">{formatDays(idea.TimelineDays)}</span>
            </p>
            <p className="mt-0.5">
              Target date will be <span className="font-semibold">{formatIdeaDate(finalTargetKey)}</span>.
            </p>
          </div>
        )}

        {apiError && (
          <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm font-medium">
            <span className="text-red-500 font-bold">✕</span>
            <div>
              <p>{apiError.message}</p>
              {apiError.details.length > 0 && apiError.details[0] !== apiError.message && (
                <ul className="mt-1 list-disc pl-5 font-normal">
                  {apiError.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {action.finalApprover && (
          <div>
            <label htmlFor="lead-action-final-approver" className="block text-xs font-semibold text-slate-700 mb-1">
              {action.finalApprover.label} <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              id="lead-action-final-approver"
              options={approverOptions}
              value={finalApproverId}
              onChange={(value) => {
                setFinalApproverId(value);
                setFieldErrors((prev) => ({ ...prev, finalApprover: undefined }));
              }}
              placeholder="Search by name or department"
              disabled={busy}
              loading={approversLoading}
              hasError={Boolean(fieldErrors.finalApprover)}
              noOptionsText={approversLoading ? "Loading..." : "No final approvers available"}
              aria-invalid={Boolean(fieldErrors.finalApprover)}
            />
            {(fieldErrors.finalApprover || approversError) && (
              <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.finalApprover || approversError}</p>
            )}
          </div>
        )}

        {action.days && (
          <div>
            <label htmlFor="lead-action-days" className="block text-xs font-semibold text-slate-700 mb-1">
              {action.days.label} <span className="text-red-500">*</span>
            </label>
            <input
              id="lead-action-days"
              type="number"
              inputMode="numeric"
              min={DAYS_MIN}
              max={DAYS_MAX}
              step={1}
              autoFocus={!action.finalApprover}
              disabled={busy}
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                setFieldErrors((prev) => ({ ...prev, days: undefined }));
              }}
              placeholder={`${DAYS_MIN}–${DAYS_MAX}`}
              aria-invalid={Boolean(fieldErrors.days)}
              className={inputClass(fieldErrors.days)}
            />
            {fieldErrors.days && <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.days}</p>}
          </div>
        )}

        {action.date && (
          <div>
            <label htmlFor="lead-action-date" className="block text-xs font-semibold text-slate-700 mb-1">
              {action.date.label} <span className="text-red-500">*</span>
            </label>
            <input
              id="lead-action-date"
              type="date"
              min={minDateKey}
              autoFocus
              disabled={busy}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setFieldErrors((prev) => ({ ...prev, date: undefined }));
              }}
              aria-invalid={Boolean(fieldErrors.date)}
              className={inputClass(fieldErrors.date)}
            />
            {fieldErrors.date && <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.date}</p>}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="lead-action-remark" className="block text-xs font-semibold text-slate-700">
              {action.remark.label} {action.remark.required && <span className="text-red-500">*</span>}
            </label>
            <span className={`text-xs ${remark.length > REMARK_MAX ? "text-red-600 font-semibold" : "text-slate-400"}`}>
              {remark.length}/{REMARK_MAX}
            </span>
          </div>
          <textarea
            id="lead-action-remark"
            rows={4}
            maxLength={REMARK_MAX}
            autoFocus={!action.days && !action.finalApprover && !action.date}
            disabled={busy}
            value={remark}
            onChange={(e) => {
              setRemark(e.target.value);
              setFieldErrors((prev) => ({ ...prev, remark: undefined }));
            }}
            placeholder={action.remark.placeholder}
            aria-invalid={Boolean(fieldErrors.remark)}
            className={`${inputClass(fieldErrors.remark)} resize-y`}
          />
          {fieldErrors.remark ? (
            <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.remark}</p>
          ) : (
            action.remark.helper && <p className="text-slate-500 text-xs mt-1">{action.remark.helper}</p>
          )}
        </div>
      </div>
    </ConfirmDialog>
  );
}

/**
 * Action buttons for Idea Details, for the idea's owner (close / extend
 * requests), reporting manager (lead) or final approver; shows the buttons
 * their role and the status allow.
 * `onUpdated(updatedIdea, successMessage)` receives the idea returned by the
 * API (with its refreshed activity log).
 */
export default function IdeaLeadActions({ idea, onUpdated }) {
  const [openAction, setOpenAction] = useState(null);
  const available = getAvailableActions(idea);

  if (available.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        {idea.IsSubmitter && idea.PendingRequestType
          ? "Your request is pending with your reporting manager."
          : "No further actions."}
      </p>
    );
  }

  // Requests go to the reporting manager; the backend blocks them too.
  if (idea.IsSubmitter && !idea.LeadIsActive) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        This idea has no active reporting manager, so a closure or extension can't be requested. Please contact the
        Admin.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {available.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setOpenAction(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
              BUTTON_STYLES[ACTIONS[key].buttonStyle]
            }`}
          >
            {ACTIONS[key].label}
          </button>
        ))}
      </div>

      {openAction && (
        <LeadActionDialog
          // Fresh fields every time a dialog opens.
          key={openAction}
          actionKey={openAction}
          idea={idea}
          onClose={() => setOpenAction(null)}
          onCompleted={(updatedIdea, message) => {
            setOpenAction(null);
            onUpdated(updatedIdea, message);
          }}
        />
      )}
    </>
  );
}
