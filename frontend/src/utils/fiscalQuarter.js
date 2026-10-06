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

export const getFiscalQuarterOptions = () => {
  return FISCAL_YEAR_ENDS.flatMap((endYear) => {
    const fiscalYear = getFiscalYearLabel(endYear);
    return QUARTERS.map((quarter) => ({
      value: `Q${quarter}-${endYear}`,
      label: `${QUARTER_END_MONTHS[quarter - 1]} Quarter ${fiscalYear}`,
    }));
  });
};