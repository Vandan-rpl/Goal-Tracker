const QUARTERS = [1, 2, 3, 4];
const QUARTER_END_MONTHS = ["June", "September", "December", "March"];
const FISCAL_YEAR_ENDS = [2027];

const getFiscalYearStart = (date) =>
  date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;

// Display form of a fiscal year, given the year it ENDS in:
// 2027 (Apr 2026 - Mar 2027) -> "F.Y. 2026-27". Use for text shown to users.
export const formatFiscalYearLabel = (endYear) => {
  const year = Number(endYear);
  return `F.Y. ${year - 1}-${String(year).slice(-2)}`;
};

const getFiscalYearLabel = formatFiscalYearLabel;

export const getCurrentFiscalQuarterValue = (date = new Date()) => {
  const quarter = Math.floor(((date.getMonth() + 9) % 12) / 3) + 1;
  return `Q${quarter}-${getFiscalYearStart(date) + 1}`;
};

export const getQuarterDayWindow = (startDay, endDay, date = new Date()) => {
  const quarterIndex = Math.floor(((date.getMonth() + 9) % 12) / 3);
  const startMonth = (quarterIndex * 3 + 3) % 12;
  const quarterStart = new Date(date.getFullYear(), startMonth, 1);
  const startDate = new Date(quarterStart);
  startDate.setDate(startDate.getDate() + startDay - 1);
  const endDate = new Date(quarterStart);
  endDate.setDate(endDate.getDate() + endDay - 1);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return {
    startDate,
    endDate,
    isOpen: today >= startDate && today <= endDate,
  };
};

// Goal windows run in the LAST month of each quarter (same as the backend's
// utils/fiscalQuarter.js). `endDay` null = the month's last day. E.g.
// Oct-Dec quarter: Add Goal 1-7 Dec, Manager/HOD 8-15 Dec, CFO 16-31 Dec.
export const getQuarterLastMonthWindow = (startDay, endDay, date = new Date()) => {
  const quarterIndex = Math.floor(((date.getMonth() + 9) % 12) / 3);
  const lastMonth = (quarterIndex * 3 + 5) % 12;
  // Q4 (Jan-Mar) ends in March of the same calendar year as `date`.
  const year = date.getFullYear();
  const startDate = new Date(year, lastMonth, startDay);
  const endDate = endDay ? new Date(year, lastMonth, endDay) : new Date(year, lastMonth + 1, 0);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return {
    startDate,
    endDate,
    isOpen: today >= startDate && today <= endDate,
  };
};

//Goal add window
export const getGoalCreationWindow = (date = new Date()) => {
  const reopeningStart = new Date(2026, 10, 1);
  const reopeningEnd = new Date(2026, 10, 20);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (today >= reopeningStart && today <= reopeningEnd) {
    return {
      startDate: reopeningStart,
      endDate: reopeningEnd,
      isOpen: true,
    };
  }

  return getQuarterLastMonthWindow(1, 7, date);
};

//Manager/HOD approval window
export const getManagerHodApprovalWindow = (date = new Date()) => {
  const reopeningStart = new Date(2026, 10, 14);
  const reopeningEnd = new Date(2026, 10, 30);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (today >= reopeningStart && today <= reopeningEnd) {
    return {
      startDate: reopeningStart,
      endDate: reopeningEnd,
      isOpen: true,
    };
  }

  return getQuarterLastMonthWindow(8, 15, date);
};

export const getCfoApprovalWindow = (date = new Date()) => {
  const reopeningStart = new Date(2026, 10, 16);
  const reopeningEnd = new Date(2026, 10, 30);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  today.setHours(0, 0, 0, 0);

  if (today >= reopeningStart && today <= reopeningEnd) {
    return {
      startDate: reopeningStart,
      endDate: reopeningEnd,
      isOpen: true,
    };
  }

  return getQuarterLastMonthWindow(16, null, date);
}

export const getFiscalQuarterValue = (dateValue) => {
  if (!dateValue) return "";
  const date =
    dateValue instanceof Date
      ? dateValue
      : new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : getCurrentFiscalQuarterValue(date);
};

const toLocalDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

// Inclusive 'YYYY-MM-DD' bounds of the fiscal quarter containing `dateValue`
// (a Date or 'YYYY-MM-DD' string), for date input min/max.
export const getFiscalQuarterDateRange = (dateValue = new Date()) => {
  const date =
    dateValue instanceof Date
      ? dateValue
      : new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const startMonth = (Math.floor(((date.getMonth() + 9) % 12) / 3) * 3 + 3) % 12;
  const startYear =
    startMonth === 0 ? date.getFullYear() : getFiscalYearStart(date);
  const start = new Date(startYear, startMonth, 1);
  const end = new Date(startYear, startMonth + 3, 0);
  return {
    quarter: getCurrentFiscalQuarterValue(date),
    min: toLocalDateKey(start),
    max: toLocalDateKey(end),
  };
};

// Bounds of the fiscal quarter after the one containing `dateValue`. Goal
// entry opens before the quarter ends, so new goals target the next quarter.
export const getNextFiscalQuarterDateRange = (dateValue = new Date()) => {
  const current = getFiscalQuarterDateRange(dateValue);
  if (!current) return null;
  const nextStart = new Date(`${current.max}T00:00:00`);
  nextStart.setDate(nextStart.getDate() + 1);
  return getFiscalQuarterDateRange(nextStart);
};

const MONTH_SHORT_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Stored quarter labels use the fiscal year END year ("Q1-2027" = Apr-Jun
// 2026). For display, show the calendar months instead: "Q1 (Apr–Jun 2026)".
// Use this only for text shown to users; keep the raw label for values/API.
export const formatQuarterLabel = (label) => {
  const match = /^Q([1-4])-(\d{4})$/.exec(String(label || "").trim());
  if (!match) return label || "";
  const quarter = Number(match[1]);
  const fyEndYear = Number(match[2]);
  const startMonth = (quarter * 3) % 12;
  const year = quarter === 4 ? fyEndYear : fyEndYear - 1;
  return `Q${quarter} (${MONTH_SHORT_NAMES[startMonth]}–${MONTH_SHORT_NAMES[startMonth + 2]} ${year})`;
};

export const getFiscalQuarterOptions = () => {
  return FISCAL_YEAR_ENDS.flatMap((endYear) => {
    const fiscalYear = getFiscalYearLabel(endYear);
    return QUARTERS.map((quarter) => ({
      value: `Q${quarter}-${endYear}`,
      label: `${QUARTER_END_MONTHS[quarter - 1]} Quarter ${fiscalYear}`,
    }));
  });
};

// Display form of a stored quarter label: "Q1-2027" -> "Q1 F.Y. 2026-27".
// Stored labels use the fiscal year END year (Apr 2026 - Mar 2027 = 2027).
// Use this only for text shown to users; keep the raw label for values/API.
export const formatFiscalQuarterLabel = (label) => {
  const match = /^Q([1-4])-(\d{4})$/.exec(String(label || "").trim());
  if (!match) return label || "";
  return `Q${match[1]} ${formatFiscalYearLabel(match[2])}`;
};
