// Innovation Ideas statuses, in workflow order (same values as the backend).
export const IDEA_STATUSES = [
  "Draft",
  "Submitted",
  "Under Review",
  "Accepted",
  "On Hold",
  "In Implementation",
  "Implemented",
  "Rejected",
];

const IDEA_STATUS_CLASSES = {
  Draft: "bg-gray-100 text-gray-700",
  Submitted: "bg-blue-100 text-blue-800",
  "Under Review": "bg-indigo-100 text-indigo-800",
  Accepted: "bg-teal-100 text-teal-800",
  "On Hold": "bg-amber-100 text-amber-800",
  "In Implementation": "bg-orange-100 text-orange-800",
  Implemented: "bg-emerald-100 text-emerald-800",
  Rejected: "bg-red-100 text-red-800",
};

// Tailwind classes for a status label (rounded-full pill like the goal tables).
export const getIdeaStatusClasses = (status) =>
  IDEA_STATUS_CLASSES[status] || IDEA_STATUS_CLASSES.Draft;

// 'YYYY-MM-DD...' from the API as DD/MM/YYYY, or "—". Uses the date part as
// sent so it never shifts a day across time zones.
export const formatIdeaDate = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
};

const pad2 = (value) => String(value).padStart(2, "0");

// Today's date as 'YYYY-MM-DD' (local date).
export const getTodayKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

// 'YYYY-MM-DD...' plus `days` as 'YYYY-MM-DD' (calendar math in UTC, so no
// daylight-saving or time-zone drift), or "" for an invalid date.
export const addDaysToDateKey = (value, days) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "";

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
};

// "1 day" / "5 days"
export const formatDays = (days) => `${days} day${Math.abs(days) === 1 ? "" : "s"}`;

// 'YYYY-MM-DDTHH:mm...' as "DD/MM/YYYY, h:mm AM", or "—". Like formatIdeaDate,
// shows the server's stored time as-is without a time-zone conversion.
export const formatIdeaDateTime = (value) => {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return "—";

  const [, year, month, day, hours, minutes] = match;
  const hour = Number(hours);
  const displayHour = hour % 12 || 12;
  return `${day}/${month}/${year}, ${displayHour}:${minutes} ${hour < 12 ? "AM" : "PM"}`;
};

// Values written to IdeaActivityLog.Action, with their timeline label and
// dot color. Unknown actions are shown as-is with a grey dot.
export const IDEA_ACTIONS = {
  CREATED: "Created",
  SUBMITTED: "Submitted",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  ON_HOLD: "On Hold",
  IMPLEMENTATION_STARTED: "Implementation Started",
  IMPLEMENTED: "Implemented",
  TIMELINE_EXTENDED: "Timeline Extended",
};

const IDEA_ACTION_DISPLAY = {
  [IDEA_ACTIONS.CREATED]: { label: "Draft Created", dot: "bg-gray-400" },
  [IDEA_ACTIONS.SUBMITTED]: { label: "Submitted", dot: "bg-blue-500" },
  [IDEA_ACTIONS.ACCEPTED]: { label: "Accepted", dot: "bg-teal-500" },
  [IDEA_ACTIONS.REJECTED]: { label: "Rejected", dot: "bg-red-500" },
  [IDEA_ACTIONS.ON_HOLD]: { label: "On Hold", dot: "bg-amber-500" },
  [IDEA_ACTIONS.IMPLEMENTATION_STARTED]: { label: "Implementation Started", dot: "bg-orange-500" },
  [IDEA_ACTIONS.IMPLEMENTED]: { label: "Implemented", dot: "bg-emerald-500" },
  [IDEA_ACTIONS.TIMELINE_EXTENDED]: { label: "Timeline Extended", dot: "bg-amber-500" },
};

export const getIdeaActionDisplay = (action) =>
  IDEA_ACTION_DISPLAY[action] || { label: action || "Updated", dot: "bg-gray-400" };
