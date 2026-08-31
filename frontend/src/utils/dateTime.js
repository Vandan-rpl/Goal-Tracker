/**
 * ============================================================
 * Goal Tracker Management System
 * Date & Time Utility
 * ============================================================
 */

const DEFAULT_LOCALE = "en-IN";

const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Current Date Object
 */
export const now = () => new Date();

/**
 * Format Date
 * Output: 21/07/2026
 */
export const formatDate = (
  date = new Date(),
  locale = DEFAULT_LOCALE
) => {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(date));
};

/**
 * Format Time
 * Output: 10:45:22 AM
 */
export const formatTime = (
  date = new Date(),
  locale = DEFAULT_LOCALE
) => {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(date));
};

/**
 * Format Date Time
 * Output:
 * 21/07/2026, 10:45:22 AM
 */
export const formatDateTime = (
  date = new Date(),
  locale = DEFAULT_LOCALE
) => {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(date));
};

/**
 * Long Date
 * Output:
 * Tuesday, 21 July 2026
 */
export const formatLongDate = (
  date = new Date(),
  locale = DEFAULT_LOCALE
) => {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: DEFAULT_TIMEZONE,
  }).format(new Date(date));
};

/**
 * ISO Date
 */
export const toISODate = (date = new Date()) => {
  return new Date(date).toISOString();
};

/**
 * Greeting
 */
export const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";

  if (hour < 17) return "Good Afternoon";

  if (hour < 21) return "Good Evening";

  return "Good Night";
};

/**
 * Relative Time
 */
export const getRelativeTime = (date) => {
  const target = new Date(date);

  const seconds = Math.floor((target - new Date()) / 1000);

  const formatter = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, {
    numeric: "auto",
  });

  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
    { label: "second", seconds: 1 },
  ];

  for (const interval of intervals) {
    const value = Math.floor(seconds / interval.seconds);

    if (value !== 0) {
      return formatter.format(value, interval.label);
    }
  }

  return "just now";
};

/**
 * Dashboard Header Clock
 */
export const getCurrentDateTime = () => ({
  date: formatDate(),
  time: formatTime(),
  dateTime: formatDateTime(),
  longDate: formatLongDate(),
});

/**
 * Timestamp
 */
export const getTimestamp = () => Date.now();

/**
 * Check Today
 */
export const isToday = (date) => {
  const current = new Date();
  const target = new Date(date);

  return (
    current.getDate() === target.getDate() &&
    current.getMonth() === target.getMonth() &&
    current.getFullYear() === target.getFullYear()
  );
};

/**
 * Check Future Date
 */
export const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

/**
 * Check Past Date
 */
export const isPastDate = (date) => {
  return new Date(date) < new Date();
};

/**
 * Start of Day
 */
export const startOfDay = (date = new Date()) => {
  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  return d;
};

/**
 * End of Day
 */
export const endOfDay = (date = new Date()) => {
  const d = new Date(date);

  d.setHours(23, 59, 59, 999);

  return d;
};

/**
 * Default Export
 */
const DateTime = {
  now,
  formatDate,
  formatTime,
  formatDateTime,
  formatLongDate,
  toISODate,
  getGreeting,
  getRelativeTime,
  getCurrentDateTime,
  getTimestamp,
  isToday,
  isFutureDate,
  isPastDate,
  startOfDay,
  endOfDay,
};

export default DateTime;