const QUARTERS = [1, 2, 3, 4];
const QUARTER_END_MONTHS = ["June", "September", "December", "March"];
const FISCAL_YEAR_ENDS = [2027];

const getFiscalYearStart = (date) =>
  date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;

const getFiscalYearLabel = (endYear) =>
  `FY${String(endYear - 1).slice(-2)}-${String(endYear).slice(-2)}`;

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

export const getGoalCreationWindow = (date = new Date()) =>
  getQuarterDayWindow(1, 7, date);

export const getManagerHodApprovalWindow = (date = new Date()) =>
  getQuarterDayWindow(8, 15, date);

export const getCfoApprovalWindow = (date = new Date()) =>
  getQuarterDayWindow(16, 30, date);

export const getFiscalQuarterValue = (dateValue) => {
  if (!dateValue) return "";
  const date =
    dateValue instanceof Date
      ? dateValue
      : new Date(`${dateValue}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "" : getCurrentFiscalQuarterValue(date);
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