import { useEffect, useMemo, useState } from "react";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import SearchableSelect from "../SearchableSelect/SearchableSelect";
import {
  extendIdeaTimeline,
  finalApproveIdea,
  finalRejectIdea,
  getIdeaApiError,
  getIdeaFinalApprovers,
  managerApproveIdea,
  managerRejectIdea,
  markIdeaImplemented,
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

// Each action: its button, dialog fields and API call.
//   finalApprover -> final approver dropdown
//   days          -> number input (1-365)
//   remark        -> textarea
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
    message: "The idea becomes Active and the reporting manager can start implementation.",
    remark: { label: "Remark", required: false, placeholder: "Optional" },
    confirmLabel: "Approve",
    busyLabel: "Approving...",
    tone: "success",
    successMessage: "Idea approved. It is now Active.",
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
  implement: {
    label: "Mark Completed",
    buttonStyle: "primary",
    title: "Mark as implemented?",
    message: "The idea will be marked as Implemented. This is the final step.",
    remark: { label: "Remark", required: false, placeholder: "Optional" },
    confirmLabel: "Mark Implemented",
    busyLabel: "Saving...",
    tone: "success",
    successMessage: "Idea marked as implemented.",
    submit: (ideaId, { remark }) => markIdeaImplemented(ideaId, { remark }),
  },
  extend: {
    label: "Extend Timeline",
    buttonStyle: "warning",
    title: "Extend timeline",
    days: { label: "Additional days" },
    remark: { label: "Reason", required: true, placeholder: "Why is more time needed?" },
    confirmLabel: "Extend Timeline",
    busyLabel: "Extending...",
    tone: "success",
    successMessage: "Timeline extended.",
    submit: (ideaId, { days, remark }) => extendIdeaTimeline(ideaId, { additionalDays: days, reason: remark }),
  },
};

// Buttons available to the viewer for the idea's status: the reporting
// manager (IsLead) or the final approver (IsFinalApprover). The backend
// checks the same rules.
const getAvailableActions = (idea) => {
  if (idea.IsFinalApprover && idea.Status === "Pending Final Approval") return ["finalApprove", "finalReject"];
  if (!idea.IsLead) return [];
  if (idea.Status === "Submitted") return ["managerApprove", "managerReject"];
  if (idea.Status === "Active") return idea.IsOverdue ? ["start", "extend"] : ["start"];
  if (idea.Status === "In Implementation") return idea.IsOverdue ? ["implement", "extend"] : ["implement"];
  return [];
};

const parseDays = (value) => (/^\d+$/.test(String(value).trim()) ? Number(value) : NaN);

const isValidDays = (days) => Number.isInteger(days) && days >= DAYS_MIN && days <= DAYS_MAX;

function LeadActionDialog({ actionKey, idea, onClose, onCompleted }) {
  const action = ACTIONS[actionKey];

  const [finalApproverId, setFinalApproverId] = useState(null);
  const [days, setDays] = useState("");
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

  // Live previews
  const finalTargetKey =
    actionKey === "finalApprove" && idea.TimelineDays ? addDaysToDateKey(todayKey, idea.TimelineDays) : "";
  const extendTargetKey = actionKey === "extend" && daysValid ? addDaysToDateKey(idea.TargetDate, daysValue) : "";
  const overdueDays = idea.IsOverdue ? Math.abs(idea.DaysRemaining ?? 0) : 0;
  const extendStillPast = Boolean(extendTargetKey) && extendTargetKey < todayKey;

  const validate = () => {
    const errors = {};

    if (action.finalApprover && !finalApproverId) {
      errors.finalApprover = "Select a final approver.";
    }

    if (action.days && !daysValid) {
      errors.days = `Enter a whole number from ${DAYS_MIN} to ${DAYS_MAX}.`;
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
    if (Object.keys(errors).length > 0 || extendStillPast) return;

    setBusy(true);
    setApiError(null);

    try {
      const updatedIdea = await action.submit(idea.IdeaID, {
        finalApproverId,
        days: daysValue,
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
      confirmDisabled={extendStillPast}
      autoFocusConfirm={false}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="space-y-4">
        {actionKey === "extend" && (
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

            {extendTargetKey && !extendStillPast && (
              <p className="text-sm text-slate-700 mt-2">
                New target date will be <span className="font-semibold">{formatIdeaDate(extendTargetKey)}</span>.
              </p>
            )}
            {extendStillPast && (
              <p className="text-sm text-red-700 font-medium mt-2" role="alert">
                The new target date ({formatIdeaDate(extendTargetKey)}) would still be in the past. Add at least{" "}
                {formatDays(overdueDays)}.
              </p>
            )}
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
            autoFocus={!action.days && !action.finalApprover}
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
 * Action buttons for Idea Details, for the idea's reporting manager (lead)
 * or final approver; shows the buttons their role and the status allow.
 * `onUpdated(updatedIdea, successMessage)` receives the idea returned by the
 * API (with its refreshed activity log).
 */
export default function IdeaLeadActions({ idea, onUpdated }) {
  const [openAction, setOpenAction] = useState(null);
  const available = getAvailableActions(idea);

  if (available.length === 0) {
    return <p className="text-sm text-slate-500">No further actions.</p>;
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
