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

function getGoalCreationWindow(date = new Date()) {
  const reopeningStart = new Date(2026, 9, 14);
  const reopeningEnd = new Date(2026, 9, 20);
  const today = new Date(toDate(date));
  today.setHours(0, 0, 0, 0);

  if (today >= reopeningStart && today <= reopeningEnd) {
    return {
      startDate: reopeningStart,
      endDate: reopeningEnd,
      isOpen: true,
    };
  }

  return getQuarterDayWindow(1, 7, date);
}

function getManagerHodApprovalWindow(date = new Date()) {
  return getQuarterDayWindow(8, 15, date);
}

function getCfoApprovalWindow(date = new Date()) {
  return getQuarterDayWindow(16, 30, date);
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

function getNextFiscalQuarter(fromQuarterEndDate) {
  const nextStart = new Date(fromQuarterEndDate);
  nextStart.setDate(nextStart.getDate() + 1);
  return getFiscalQuarter(nextStart);
}

function isWithinCarryForwardWindow(quarterEndDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const qEnd = new Date(quarterEndDate);
  qEnd.setHours(0, 0, 0, 0);

  const windowStart = new Date(qEnd);
  windowStart.setDate(windowStart.getDate() - 10);

  const windowEnd = new Date(qEnd);
  windowEnd.setDate(windowEnd.getDate() + 15);

  return today >= windowStart && today <= windowEnd;
}


module.exports = {
  getFiscalQuarter,
  getFiscalQuarterBounds,
  getFiscalQuarterBoundsFromLabel,
  toDateKey,
  getNextFiscalQuarter,
  getQuarterStartDate,
  getQuarterDayWindow,
  getGoalCreationWindow,
  getManagerHodApprovalWindow,
  getCfoApprovalWindow,
  isWithinCarryForwardWindow,
};