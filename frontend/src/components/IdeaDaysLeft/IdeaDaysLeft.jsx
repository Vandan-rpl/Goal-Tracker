import { formatDays } from "../../utils/ideaStatus";

// "Days Left" cell for idea tables. DaysRemaining is only set by the backend
// for Active / In Implementation ideas, so anything else shows "—".
export default function IdeaDaysLeft({ idea }) {
  if (idea.IsOverdue) {
    return (
      <span className="text-sm font-semibold text-red-600">
        Overdue by {formatDays(Math.abs(idea.DaysRemaining))}
      </span>
    );
  }

  if (idea.DaysRemaining == null) return <span className="text-sm text-gray-400">—</span>;

  return (
    <span className="text-sm text-gray-700">
      {idea.DaysRemaining === 0 ? "Due today" : `${formatDays(idea.DaysRemaining)} left`}
    </span>
  );
}
