function toDate(dateValue) {
  if (dateValue instanceof Date) return dateValue;

  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    const [year, month, day] = dateValue.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(dateValue);
}

function getQuarterStartDate(quarterEndDate) {
  const start = new Date(quarterEndDate);
  start.setMonth(start.getMonth() - 2, 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

// Quarter-day windows use inclusive offsets from the fiscal quarter start.
function getQuarterDayWindow(startDay, endDay, date = new Date()) {
  const { quarterEndDate } = getFiscalQuarter(date);
  const startDate = getQuarterStartDate(quarterEndDate);
  const windowStartDate = new Date(startDate);
  windowStartDate.setDate(windowStartDate.getDate() + startDay - 1);
  const windowEndDate = new Date(startDate);
  windowEndDate.setDate(windowEndDate.getDate() + endDay - 1);

  const today = new Date(toDate(date));
  today.setHours(0, 0, 0, 0);

  return {
    startDate: windowStartDate,
    endDate: windowEndDate,
    isOpen: today >= windowStartDate && today <= windowEndDate,
  };
}

// Goal windows run in the LAST month of each quarter (days are that month's
// dates, inclusive); goals are added and approved for the next quarter.
// `endDay` null = the month's last day. E.g. Oct-Dec quarter: Add Goal 1-7
// Dec, Manager/HOD approval 8-15 Dec, CFO approval 16-31 Dec.
const GOAL_CREATION_DAYS = [1, 7];
const MANAGER_HOD_APPROVAL_DAYS = [8, 15];
const CFO_APPROVAL_DAYS = [16, null];

function getQuarterLastMonthWindow(startDay, endDay, date = new Date()) {
  const { quarterEndDate } = getFiscalQuarter(date);
  const year = quarterEndDate.getFullYear();
  const month = quarterEndDate.getMonth();
  const windowStartDate = new Date(year, month, startDay);
  const windowEndDate = endDay ? new Date(year, month, endDay) : new Date(year, month + 1, 0);

  const today = new Date(toDate(date));
  today.setHours(0, 0, 0, 0);

  return {
    startDate: windowStartDate,
    endDate: windowEndDate,
    isOpen: today >= windowStartDate && today <= windowEndDate,
  };
}

function getGoalCreationWindow(date = new Date()) {
  const reopeningStart = new Date(2026, 10, 1);
  const reopeningEnd = new Date(2026, 10, 20);
  const today = new Date(toDate(date));
  today.setHours(0, 0, 0, 0);

  if (today >= reopeningStart && today <= reopeningEnd) {
    return {
      startDate: reopeningStart,
      endDate: reopeningEnd,
      isOpen: true,
    };
  }

  return getQuarterLastMonthWindow(...GOAL_CREATION_DAYS, date);
}

function getManagerHodApprovalWindow(date = new Date()) {
  const reopeningStart = new Date(2026, 10, 14);
  const reopeningEnd = new Date(2026, 10, 30);
  const today = new Date(toDate(date));
  today.setHours(0, 0, 0, 0);

  if (today >= reopeningStart && today <= reopeningEnd) {
    return {
      startDate: reopeningStart,
      endDate: reopeningEnd,
      isOpen: true,
    };
  }

  return getQuarterLastMonthWindow(...MANAGER_HOD_APPROVAL_DAYS, date);
}

function getCfoApprovalWindow(date = new Date()) {
  const reopeningStart = new Date(2026, 10, 16);
  const reopeningEnd = new Date(2026, 10, 30);
  const today = new Date(toDate(date));
  today.setHours(0, 0, 0, 0);

  if (today >= reopeningStart && today <= reopeningEnd) {
    return {
      startDate: reopeningStart,
      endDate: reopeningEnd,
      isOpen: true,
    };
  }

  return getQuarterLastMonthWindow(...CFO_APPROVAL_DAYS, date);
}

function getFiscalQuarter(date = new Date()) {
  const localDate = toDate(date);
  if (Number.isNaN(localDate.getTime())) {
    throw new RangeError("A valid date is required to calculate a fiscal quarter.");
  }

  const month = localDate.getMonth();
  const year = localDate.getFullYear();
  let quarter, fyStartYear, quarterEndDate;

  if (month >= 3 && month <= 5) {
    quarter = 1; fyStartYear = year;
    quarterEndDate = new Date(year, 5, 30);
  } else if (month >= 6 && month <= 8) {
    quarter = 2; fyStartYear = year;
    quarterEndDate = new Date(year, 8, 30);
  } else if (month >= 9 && month <= 11) {
    quarter = 3; fyStartYear = year;
    quarterEndDate = new Date(year, 11, 31);
  } else {
    quarter = 4; fyStartYear = year - 1;
    quarterEndDate = new Date(year, 2, 31);
  }

  return { label: `Q${quarter}-${fyStartYear + 1}`, quarterEndDate };
}

const pad2 = (value) => String(value).padStart(2, "0");

// Local calendar date -> 'YYYY-MM-DD' without any UTC conversion.
function formatLocalDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// Normalises a 'YYYY-MM-DD' string, or a Date read from a SQL DATE column
// (mssql returns those as UTC midnight), to 'YYYY-MM-DD'. Returns null when
// the value is missing or not a real calendar date.
function toDateKey(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }

  const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [year, month, day] = match.slice(1).map(Number);
  const check = new Date(year, month - 1, day);
  if (
    check.getFullYear() !== year ||
    check.getMonth() !== month - 1 ||
    check.getDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

// Inclusive 'YYYY-MM-DD' bounds of the fiscal quarter containing `date`.
function getFiscalQuarterBounds(date = new Date()) {
  const { label, quarterEndDate } = getFiscalQuarter(date);
  return {
    label,
    startKey: formatLocalDateKey(getQuarterStartDate(quarterEndDate)),
    endKey: formatLocalDateKey(quarterEndDate),
  };
}

// Bounds for a stored quarter label such as "Q3-2027" (year = FY end year).
function getFiscalQuarterBoundsFromLabel(label) {
  const match = /^Q([1-4])-(\d{4})$/.exec(String(label || "").trim());
  if (!match) return null;

  const quarter = Number(match[1]);
  const fyEndYear = Number(match[2]);
  const firstDayOfQuarter =
    quarter === 4
      ? `${fyEndYear}-01-01`
      : `${fyEndYear - 1}-${pad2(quarter * 3 + 1)}-01`;
  return getFiscalQuarterBounds(firstDayOfQuarter);
}

// Q1-Q4 of the fiscal year containing `date`, in order, each with inclusive
// 'YYYY-MM-DD' bounds.
function getFiscalYearQuarters(date = new Date()) {
  const fyEndYear = Number(getFiscalQuarter(date).label.slice(-4));
  return [1, 2, 3, 4].map((quarter) =>
    getFiscalQuarterBoundsFromLabel(`Q${quarter}-${fyEndYear}`),
  );
}

function getNextFiscalQuarter(fromQuarterEndDate) {
  const nextStart = new Date(fromQuarterEndDate);
  nextStart.setDate(nextStart.getDate() + 1);
  return getFiscalQuarter(nextStart);
}

// Go-live opening. GOAL_ENTRY_GO_LIVE_OPENING=true in the backend .env opens
// goal entry for all four quarters (Q1-Q4) of the current fiscal year outside
// the normal windows, and exempts goals in those quarters from the approval
// windows. One-time go-live exception: Q4 was added on 2026-11-21 after its
// normal entry window had closed. Set the switch to false (or remove it) after
// go-live to return to the date-based windows only. This is the only place the
// switch is read.
const GO_LIVE_OPEN_QUARTER_NUMBERS = [1, 2, 3, 4];

const isGoLiveOpeningEnabled = () =>
  String(process.env.GOAL_ENTRY_GO_LIVE_OPENING || "").trim().toLowerCase() ===
  "true";

// Bounds of the go-live quarters, or [] while the switch is off.
function getGoLiveOpenQuarters(date = new Date()) {
  if (!isGoLiveOpeningEnabled()) return [];
  return getFiscalYearQuarters(date).filter((_, index) =>
    GO_LIVE_OPEN_QUARTER_NUMBERS.includes(index + 1),
  );
}

function isGoLiveOpenQuarter(label, date = new Date()) {
  return getGoLiveOpenQuarters(date).some((quarter) => quarter.label === label);
}

// Temporary goal-entry override. Opens goal entry for ONE quarter between two
// dates (inclusive), outside the normal window. Read here only, like the
// go-live switch above; it only adds a quarter to getOpenGoalEntryQuarters
// (no approval-window exemption). Outside its dates, or when off, the normal
// window applies with no change needed.
//   GOAL_ENTRY_OVERRIDE_ENABLED=true
//   GOAL_ENTRY_OVERRIDE_QUARTER=Q4        (or a full label, e.g. Q4-2027)
//   GOAL_ENTRY_OVERRIDE_START=2026-11-27  (YYYY-MM-DD, inclusive)
//   GOAL_ENTRY_OVERRIDE_END=2026-11-28    (YYYY-MM-DD, inclusive)
// "Q4" alone = the first Q4 that has not ended by the start date. Dates are
// compared as calendar days in the server's time zone, the same clock as the
// normal windows. An invalid setting turns the override off.
function readGoalEntryOverride() {
  const env = (name) => String(process.env[name] || "").trim();
  if (env("GOAL_ENTRY_OVERRIDE_ENABLED").toLowerCase() !== "true") {
    return { enabled: false };
  }

  const startKey = toDateKey(env("GOAL_ENTRY_OVERRIDE_START"));
  const endKey = toDateKey(env("GOAL_ENTRY_OVERRIDE_END"));
  if (!startKey || !endKey || startKey > endKey) {
    return {
      enabled: false,
      error: "GOAL_ENTRY_OVERRIDE_START / GOAL_ENTRY_OVERRIDE_END must be YYYY-MM-DD dates, start on or before end.",
    };
  }

  const quarterSetting = env("GOAL_ENTRY_OVERRIDE_QUARTER").toUpperCase();
  let bounds = null;
  if (/^Q[1-4]-\d{4}$/.test(quarterSetting)) {
    bounds = getFiscalQuarterBoundsFromLabel(quarterSetting);
  } else if (/^Q[1-4]$/.test(quarterSetting)) {
    // The first quarter with that number that ends on or after the start date.
    let candidate = getFiscalQuarterBounds(startKey);
    for (let i = 0; i < 4 && !candidate.label.startsWith(`${quarterSetting}-`); i += 1) {
      candidate = getFiscalQuarterBoundsFromLabel(
        getNextFiscalQuarter(toDate(candidate.endKey)).label,
      );
    }
    bounds = candidate;
  }
  if (!bounds) {
    return {
      enabled: false,
      error: `GOAL_ENTRY_OVERRIDE_QUARTER "${quarterSetting}" must be Q1-Q4 or a label such as Q4-2027.`,
    };
  }

  return { enabled: true, quarter: bounds, startKey, endKey };
}

// The override's quarter bounds while today is within its dates, else null.
function getGoalEntryOverrideQuarter(date = new Date()) {
  const override = readGoalEntryOverride();
  if (!override.enabled) return null;
  const todayKey = formatLocalDateKey(toDate(date));
  return todayKey >= override.startKey && todayKey <= override.endKey
    ? override.quarter
    : null;
}

// Called once at startup (server.js).
function logGoalEntryOverrideMode(logger = console) {
  const override = readGoalEntryOverride();
  if (override.error) {
    logger.error(`[GOAL ENTRY OVERRIDE] Ignored: ${override.error}`);
  } else if (override.enabled) {
    logger.warn(`[GOAL ENTRY OVERRIDE] Goal entry for ${override.quarter.label} is open from ${override.startKey} to ${override.endKey} (inclusive).`);
  }
}

// Quarters goals can be entered for now, in order: the go-live quarters,
// the override quarter while its dates are current, plus the normal target
// quarter (the one after the current quarter) while the normal
// goal-creation window is open. A quarter opened by more than one rule is
// listed once.
function getOpenGoalEntryQuarters(date = new Date()) {
  const quarters = [...getGoLiveOpenQuarters(date)];
  const overrideQuarter = getGoalEntryOverrideQuarter(date);
  if (overrideQuarter && !quarters.some((quarter) => quarter.label === overrideQuarter.label)) {
    quarters.push(overrideQuarter);
  }
  if (getGoalCreationWindow(date).isOpen) {
    const target = getFiscalQuarterBoundsFromLabel(
      getNextFiscalQuarter(getFiscalQuarter(date).quarterEndDate).label,
    );
    if (!quarters.some((quarter) => quarter.label === target.label)) {
      quarters.push(target);
    }
  }
  return quarters;
}

module.exports = {
  getFiscalQuarter,
  getFiscalQuarterBounds,
  getFiscalQuarterBoundsFromLabel,
  getFiscalYearQuarters,
  toDateKey,
  formatLocalDateKey,
  getNextFiscalQuarter,
  getQuarterStartDate,
  getQuarterDayWindow,
  getQuarterLastMonthWindow,
  getGoalCreationWindow,
  getManagerHodApprovalWindow,
  getCfoApprovalWindow,
  getGoLiveOpenQuarters,
  isGoLiveOpenQuarter,
  getOpenGoalEntryQuarters,
  getGoalEntryOverrideQuarter,
  logGoalEntryOverrideMode,
};