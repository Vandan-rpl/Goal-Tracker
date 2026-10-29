import { useEffect } from "react";

const CONFIRM_TONES = {
  success: "bg-emerald-600 hover:bg-emerald-700",
  danger: "bg-red-600 hover:bg-red-700",
  neutral: "bg-slate-900 hover:bg-slate-800",
};

// Generic confirmation modal, same look as LastSubGoalDialog. Escape and a
// backdrop click cancel, except while `busy`. Optional `children` (e.g. form
// fields) render below the message; pass autoFocusConfirm={false} when a
// field should get focus instead of the confirm button.
export default function ConfirmDialog({
  title,
  message,
  children,
  confirmLabel = "Confirm",
  busyLabel = "Please wait...",
  cancelLabel = "Cancel",
  tone = "success",
  busy = false,
  confirmDisabled = false,
  autoFocusConfirm = true,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, busy]);

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/40 px-4"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-base font-bold text-slate-900">
          {title}
        </h2>
        {message && <p className="text-sm text-slate-600">{message}</p>}
        {children}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
            autoFocus={autoFocusConfirm}
            className={`px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 cursor-pointer ${
              CONFIRM_TONES[tone] || CONFIRM_TONES.success
            }`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
