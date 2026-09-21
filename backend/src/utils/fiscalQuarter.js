function getQuarterStartDate(quarterEndDate) {
  const start = new Date(quarterEndDate);
  start.setMonth(start.getMonth() - 2, 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getFiscalQuarter(date = new Date()) {
  const month = date.getMonth();
  const year = date.getFullYear();
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

  const fyLabel = `FY${String(fyStartYear).slice(-2)}-${String(fyStartYear + 1).slice(-2)}`;
  return { label: `Q${quarter}-${fyLabel}`, quarterEndDate };
}

function getNextFiscalQuarter(fromQuarterEndDate) {
  const nextStart = new Date(fromQuarterEndDate);
  nextStart.setDate(nextStart.getDate() + 1);
  return getFiscalQuarter(nextStart);
}

module.exports = { getFiscalQuarter, getNextFiscalQuarter, getQuarterStartDate };