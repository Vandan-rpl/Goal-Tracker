import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import api from "../../services/api";
import QuarterSummaryTable from "../../components/QuarterSummaryTable/QuarterSummaryTable";
import { getCurrentFiscalQuarterValue } from "../../utils/fiscalQuarter";
import {
  QUARTER_COMPLETION_TITLE,
  formatScorePercent,
  toSummaryQuarters,
} from "../../utils/yearlyPerformance";

// Manager/HOD view of Reports & Analytics, limited to active direct reports.
// Every quarter and Quarter Average figure comes from the server's Final
// Evaluation calculation (GET analytics/team-performance).

const FUTURE_FILL = "#D1D5DB";

const formatWeight = (value) => `${Number(Number(value || 0).toFixed(2))}%`;

const QUARTER_AVERAGE_TITLE =
  "Average of the Quarter Completion % of started quarters; quarters with nothing due are skipped.";

const fiscalYearLabel = (year) => `FY${year} (Apr ${year - 1} – Mar ${year})`;

const StatCard = ({ label, value, hint, accent }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
      {label}
    </p>
    <p className={`text-3xl font-black mt-1 ${accent}`}>{value}</p>
    {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
  </div>
);

const SectionMessage = ({ children }) => (
  <div className="h-40 flex items-center justify-center text-center text-sm text-gray-400">
    {children}
  </div>
);

// One Quarter Completion column per quarter (labels from the server, e.g.
// "Q1-2027"), then the Goals completed and Quarter Average columns.
// getValue drives sorting; render draws the cell.
const buildTeamColumns = (quarterLabels) => [
  {
    key: "employeeName",
    label: "Employee",
    align: "left",
    getValue: (member) => member.employeeName,
    render: (member) => member.employeeName,
  },
  ...quarterLabels.map((label, index) => ({
    key: label,
    label: label.split("-")[0],
    title: `${label} Quarter Completion. ${QUARTER_COMPLETION_TITLE}`,
    getValue: (member) => {
      const quarter = member.Quarters[index];
      return quarter.isFuture ? null : quarter.QuarterCompletionPercentage;
    },
    render: (member) => {
      const quarter = member.Quarters[index];
      return quarter.isFuture ? (
        <span className="text-gray-400">Not started</span>
      ) : (
        formatScorePercent(quarter.QuarterCompletionPercentage)
      );
    },
  })),
  {
    key: "CompletedCount",
    label: "Goals completed",
    title: "Started quarters only.",
    getValue: (member) => member.CompletedCount,
    render: (member) => `${member.CompletedCount} of ${member.CountedGoalCount}`,
  },
  {
    key: "QuarterAveragePercentage",
    label: "Quarter Average",
    title: QUARTER_AVERAGE_TITLE,
    getValue: (member) => member.QuarterAveragePercentage,
    render: (member) => formatScorePercent(member.QuarterAveragePercentage),
    className: "font-semibold text-indigo-700",
  },
];

// Missing values (nothing due / not started) always sort last.
const compareMembers = (getValue, direction) => (a, b) => {
  const left = getValue(a);
  const right = getValue(b);
  if (left == null || right == null) {
    return left == null ? (right == null ? 0 : 1) : -1;
  }
  const result =
    typeof left === "string"
      ? left.localeCompare(right)
      : Number(left) - Number(right);
  return direction === "asc" ? result : -result;
};

const TeamView = ({ members, fiscalYear, onSelect }) => {
  const [sort, setSort] = useState({ key: "QuarterAveragePercentage", direction: "asc" });

  const columns = useMemo(
    () => buildTeamColumns((members[0]?.Quarters || []).map((quarter) => quarter.Quarter)),
    [members],
  );
  const sortedMembers = useMemo(() => {
    const column = columns.find((c) => c.key === sort.key) || columns[columns.length - 1];
    return [...members].sort(compareMembers(column.getValue, sort.direction));
  }, [members, columns, sort]);
  const chartMembers = useMemo(
    () =>
      members
        .filter((member) => member.QuarterAveragePercentage != null)
        .sort(compareMembers((member) => member.QuarterAveragePercentage, "asc")),
    [members],
  );
  const unscoredCount = members.length - chartMembers.length;

  const toggleSort = (key) =>
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));

  if (members.length === 0) {
    return (
      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <SectionMessage>You have no active direct reports.</SectionMessage>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-gray-800">Quarter Average by team member</h2>
        <p className="text-sm text-gray-500 mt-1">
          FY{fiscalYear}, started quarters only. Select a member to see their quarters.
        </p>
      </div>

      {chartMembers.length > 0 ? (
        <div className="w-full overflow-x-auto">
          <div className="min-w-155">
            <ResponsiveContainer
              width="100%"
              height={Math.min(560, Math.max(260, chartMembers.length * 48))}
            >
              <BarChart
                data={chartMembers}
                layout="vertical"
                margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  domain={[0, (dataMax) => Math.max(100, Math.ceil(dataMax))]}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  type="category"
                  dataKey="employeeName"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip formatter={(value) => formatScorePercent(value)} />
                <Bar
                  dataKey="QuarterAveragePercentage"
                  name="Quarter Average"
                  fill="#4F46E5"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(entry) => onSelect(entry.UserID)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <SectionMessage>Nothing due yet in the started quarters of FY{fiscalYear}.</SectionMessage>
      )}
      {chartMembers.length > 0 && unscoredCount > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {unscoredCount} {unscoredCount === 1 ? "member has" : "members have"} nothing
          due yet and {unscoredCount === 1 ? "is" : "are"} not shown in the chart.
        </p>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-y border-gray-200 text-xs uppercase text-gray-500">
            <tr>
              {columns.map((column) => {
                const isSorted = sort.key === column.key;
                return (
                  <th
                    key={column.key}
                    title={column.title}
                    aria-sort={
                      isSorted ? (sort.direction === "asc" ? "ascending" : "descending") : undefined
                    }
                    className={`py-3 font-semibold whitespace-nowrap ${
                      column.align === "left" ? "pr-4" : "px-3 text-right"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className="uppercase hover:text-gray-800"
                    >
                      {column.label}
                      {isSorted && (sort.direction === "asc" ? " ▲" : " ▼")}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-700">
            {sortedMembers.map((member) => (
              <tr
                key={member.UserID}
                tabIndex={0}
                onClick={() => onSelect(member.UserID)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(member.UserID);
                  }
                }}
                className="cursor-pointer hover:bg-gray-50"
              >
                {columns.map((column) =>
                  column.align === "left" ? (
                    <td key={column.key} className="py-3 pr-4 font-medium text-gray-900">
                      {column.render(member)}
                    </td>
                  ) : (
                    <td
                      key={column.key}
                      className={`py-3 px-3 text-right tabular-nums whitespace-nowrap ${column.className || ""}`}
                    >
                      {column.render(member)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const IndividualView = ({ employee, yearlyPerformance }) => {
  const summaryQuarters = toSummaryQuarters(yearlyPerformance);
  const chartData = summaryQuarters.map((quarter) => ({
    quarter: quarter.quarter,
    isFuture: quarter.isFuture,
    allocated: Number(quarter.allocated || 0),
    // A quarter that has not started has nothing achieved yet.
    achieved: quarter.isFuture
      ? null
      : Number(quarter.achieved || 0) + Number(quarter.broughtForwardAchieved || 0),
  }));
  const hasAnyWork = summaryQuarters.some(
    (quarter) =>
      Number(quarter.allocated || 0) > 0 ||
      Number(quarter.broughtForwardPending || 0) > 0 ||
      Number(quarter.broughtForwardAchieved || 0) > 0,
  );

  const quarterCompletionColumn = {
    label: "Quarter Completion",
    title: QUARTER_COMPLETION_TITLE,
    getValue: (quarter) =>
      quarter.isFuture ? "Not started" : formatScorePercent(quarter.quarterCompletion),
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">{employee.employeeName}</h2>
          <p className="text-sm text-gray-500 mt-1">
            FY{yearlyPerformance.FiscalYear}, quarter by quarter. Grey bars are quarters that have
            not started.
          </p>
        </div>
        <Link
          to={`/goals/final-evaluation/${employee.UserID}?fiscalYear=${yearlyPerformance.FiscalYear}`}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold whitespace-nowrap"
        >
          Open Final Evaluation &rarr;
        </Link>
      </div>

      {hasAnyWork ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="quarter" />
            <YAxis tickFormatter={(value) => `${value}%`} />
            <Tooltip
              formatter={(value, name, item) =>
                item.payload.isFuture && name !== "Allocated"
                  ? "Not started"
                  : formatWeight(value)
              }
            />
            <Legend />
            <Bar dataKey="allocated" name="Allocated" fill="#6366F1" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.quarter} fill={entry.isFuture ? FUTURE_FILL : "#6366F1"} />
              ))}
            </Bar>
            <Bar
              dataKey="achieved"
              name="Achieved + BF achieved"
              fill="#059669"
              radius={[4, 4, 0, 0]}
            >
              {chartData.map((entry) => (
                <Cell key={entry.quarter} fill={entry.isFuture ? FUTURE_FILL : "#059669"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <SectionMessage>No goals for FY{yearlyPerformance.FiscalYear} yet.</SectionMessage>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <QuarterSummaryTable
          quarters={summaryQuarters}
          currentQuarter={getCurrentFiscalQuarterValue()}
          employeeId={employee.UserID}
          achievementRule="evaluation"
          extraColumn={quarterCompletionColumn}
        >
          {/* Same row as the Final Evaluation page: its server-calculated
              Year Score, shown under Achieved. */}
          <tr className="bg-indigo-50/60">
            <th
              className="py-3 pl-2 pr-4 font-bold text-gray-900 whitespace-nowrap"
              title="(Achieved + Brought forward achieved) ÷ Allocated"
            >
              Year Score
            </th>
            <td className="px-3 py-3" />
            <td className="px-3 py-3 font-bold text-indigo-800 whitespace-nowrap">
              {formatScorePercent(yearlyPerformance.YearScorePercentage)}
            </td>
            <td colSpan={3} className="px-3 py-3 text-xs text-gray-500">
              (Achieved + Brought forward achieved) ÷ Allocated
            </td>
            <td className="px-3 py-3" />
          </tr>
        </QuarterSummaryTable>
      </div>

      {/* <div className="flex flex-col gap-1 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">
            Year Average ({yearlyPerformance.ToDateLabel})
          </p>
          <p className="text-xs text-gray-500">{QUARTER_AVERAGE_TITLE}</p>
        </div>
        <p className="text-2xl font-black text-indigo-800">
          {formatScorePercent(yearlyPerformance.QuarterAveragePercentage)}
        </p>
      </div> */}
    </section>
  );
};

const TeamReports = () => {
  // null = the server's current fiscal year (it owns "today").
  const [fiscalYear, setFiscalYear] = useState(null);
  const [employeeId, setEmployeeId] = useState("");
  const [report, setReport] = useState(null);
  const [filterOptions, setFilterOptions] = useState({
    employees: [],
    fiscalYears: [],
    currentFiscalYear: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    const fetchReport = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("analytics/team-performance", {
          params: {
            fiscalYear: fiscalYear ?? undefined,
            employeeId: employeeId || undefined,
          },
        });
        if (ignore) return;
        if (res.data.success) {
          const data = res.data.data;
          setReport(data);
          setFilterOptions({
            employees: data.Employees,
            fiscalYears: data.FiscalYearOptions,
            currentFiscalYear: data.CurrentFiscalYear,
          });
        } else {
          setReport(null);
          setError(res.data.message || "Failed to load team report.");
        }
      } catch (err) {
        if (ignore) return;
        console.error("Failed to load team report", err);
        setReport(null);
        setError(err.response?.data?.message || "Failed to load team report.");
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchReport();
    return () => {
      ignore = true;
    };
  }, [fiscalYear, employeeId]);

  const selectEmployee = (id) => setEmployeeId(id == null ? "" : String(id));
  const summary = report?.Summary;
  const selectedEmployee = filterOptions.employees.find(
    (employee) => String(employee.UserID) === employeeId,
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Employee
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="min-w-56 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All team members</option>
            {filterOptions.employees.map((employee) => (
              <option key={employee.UserID} value={String(employee.UserID)}>
                {employee.employeeName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Fiscal year
          <select
            value={fiscalYear ?? filterOptions.currentFiscalYear ?? ""}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            disabled={filterOptions.fiscalYears.length === 0}
            className="min-w-56 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-800 focus:ring-2 focus:ring-indigo-500"
          >
            {filterOptions.fiscalYears.map((year) => (
              <option key={year} value={year}>
                {fiscalYearLabel(year)}
                {year === filterOptions.currentFiscalYear ? " · current" : ""}
              </option>
            ))}
          </select>
        </label>
        {employeeId && (
          <button
            type="button"
            onClick={() => setEmployeeId("")}
            className="self-start sm:self-end sm:mb-2 text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            &larr; All team members
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <SectionMessage>
            {employeeId ? "Loading employee report..." : "Loading team report..."}
          </SectionMessage>
        </div>
      ) : (
        report && (
          <>
            {summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                  label="Total goals"
                  value={summary.TotalGoals}
                  hint={`Goals in FY${report.FiscalYear}`}
                  accent="text-gray-900"
                />
                <StatCard
                  label="In progress"
                  value={summary.InProgressGoals}
                  hint={
                    summary.InProgressQuarter
                      ? `Approved goals in ${summary.InProgressQuarter}`
                      : "No quarter started"
                  }
                  accent="text-blue-600"
                />
                <StatCard
                  label="Completed"
                  value={summary.CompletedGoals}
                  hint={`Completed in FY${report.FiscalYear}`}
                  accent="text-emerald-600"
                />
                <StatCard
                  label="Brought forward pending"
                  value={summary.BroughtForwardPendingGoals}
                  hint="Carried-forward goals not completed"
                  accent="text-amber-600"
                />
              </div>
            )}

            {employeeId && selectedEmployee && report.YearlyPerformance ? (
              <IndividualView
                employee={selectedEmployee}
                yearlyPerformance={report.YearlyPerformance}
              />
            ) : (
              <TeamView
                members={report.Members}
                fiscalYear={report.FiscalYear}
                onSelect={selectEmployee}
              />
            )}
          </>
        )
      )}
    </>
  );
};

export default TeamReports;
