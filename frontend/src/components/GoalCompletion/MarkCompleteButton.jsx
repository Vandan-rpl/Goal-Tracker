import { useState } from "react";
import api from "../../services/api";

// Owner-only action on an Approved goal: submits it for completion approval.
// Used as "Mark Complete" for goals without sub-goals, and as "Resubmit for
// completion" for goals whose sub-goals are all still ticked after a
// rejected completion. The caller decides visibility; the backend re-checks
// owner, status and sub-goals.
export default function MarkCompleteButton({
  goalId,
  goalTitle,
  onCompleted,
  compact = false,
  label = "Mark Complete",
  confirmPrompt = `Mark "${goalTitle}" as complete?`,
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleClick = async (event) => {
    event.stopPropagation();
    const confirmed = window.confirm(
      `${confirmPrompt}\n\nIt will be sent to your manager for completion approval and can no longer be edited.`,
    );
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const response = await api.post(`/goals/${goalId}/completion/request`);
      if (response.data.success) {
        alert(response.data.message || "Goal completion submitted for approval.");
        await onCompleted?.();
      } else {
        alert(response.data.message || "Failed to request goal completion.");
      }
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Server error while requesting goal completion.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={submitting}
      className={`inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer ${
        compact ? "px-3.5 py-1.5 rounded-lg" : "px-4 py-2 rounded-xl"
      }`}
    >
      {submitting ? "Submitting..." : label}
    </button>
  );
}
