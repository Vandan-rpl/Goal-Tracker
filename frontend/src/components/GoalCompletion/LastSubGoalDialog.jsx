import { useEffect } from "react";

// Shown when the owner ticks the last pending sub-goal. Submit completes that
// sub-goal and submits the goal for completion approval in one call; Cancel
// leaves everything unchanged.
export default function LastSubGoalDialog({ goalTitle, submitting, onSubmit, onCancel }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, submitting]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={() => !submitting && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="last-sub-goal-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="last-sub-goal-title" className="text-base font-bold text-slate-900">
          Submit for completion approval?
        </h2>
        <p className="text-sm text-slate-600">
          This is the last step.{" "}
          <span className="font-semibold text-slate-800">{goalTitle}</span> will be
          submitted for completion approval.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            autoFocus
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
