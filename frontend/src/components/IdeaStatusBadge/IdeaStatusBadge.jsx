import { getIdeaStatusClasses } from "../../utils/ideaStatus";

// Idea status label, plus a red "Overdue" label when `overdue` is true.
export default function IdeaStatusBadge({ status, overdue = false }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getIdeaStatusClasses(
          status,
        )}`}
      >
        {status}
      </span>
      {overdue && (
        <span className="px-2 py-0.5 inline-flex text-[11px] leading-5 font-semibold rounded-full bg-red-50 text-red-700 border border-red-200">
          Overdue
        </span>
      )}
    </div>
  );
}
