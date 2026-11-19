import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import TaskWorkbookFrame, {
  taskFilterControlClass,
  taskFilterLabelClass,
  taskSecondaryButtonClass,
} from "../TaskWorkbookFrame/TaskWorkbookFrame";
import {
  ChartPanel,
  DashboardBreakdowns,
  DashboardEmptyState,
  DashboardError,
  DashboardListTable,
  SummaryCards,
} from "../Dashboard/Dashboard";
import { DASHBOARD_COLORS as C, dashboardCellClass as cellClass, dashboardHeadClass as headClass } from "../Dashboard/dashboardStyles";

// CFO Reports & Analytics for the Innovation Ideas and Task Tracker modules:
// the same two views as the Goal Tracker's Business Head report.
//   Team performance       active employees under the CFO, by member, with
//                          a click-through to one member's ideas / tasks
//   Organisation overview  every employee, by department
// Every number comes from the module's GET /reports (utils/moduleReport on
// the backend). Each page passes its labels, colours and item columns.

const TABS = [
  { key: "team", label: "Team performance" },
  { key: "organisation", label: "Organisation overview" },
];

const SNAPSHOT_COLORS = { Completed: C.green, Remaining: C.slate };

const fiscalYearLabel = (year) => `FY${year} (Apr ${year - 1} – Mar ${year})`;

// Table of count rows (team members or departments): name, total, one
// column per status, completion %. onSelect makes rows clickable.
const CountsTable = ({ title, nameLabel, rows, statuses, statusColors, showDepartment, onSelect }) => (
  <DashboardListTable title={title} minWidthClass="min-w-180">
    <thead>
      <tr>
        <th className={headClass}>{nameLabel}</th>
        {showDepartment && <th className={headClass}>Department</th>}
        <th className={`${headClass} text-right`}>Total</th>
        {statuses.map((status) => (
          <th key={status} className={`${headClass} text-right`}>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 shrink-0" style={{ backgroundColor: statusColors[status] }} aria-hidden="true" />
              {status}
            </span>
          </th>
        ))}
        <th className={`${headClass} text-right`}>Completion %</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row) => (
        <tr
          key={row.key}
          tabIndex={onSelect ? 0 : undefined}
          onClick={onSelect ? () => onSelect(row.key) : undefined}
          onKeyDown={
            onSelect
              ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(row.key);
                  }
                }
              : undefined
          }
          className={onSelect ? "cursor-pointer hover:bg-[#f7f9fc]" : undefined}
        >
          <td className={`${cellClass} font-semibold ${onSelect ? "text-[#2c3e82]" : ""}`}>{row.name}</td>
          {showDepartment && <td className={cellClass}>{row.department}</td>}
          <td className={`${cellClass} text-right font-semibold tabular-nums`}>{row.total}</td>
          {statuses.map((status) => (
            <td key={status} className={`${cellClass} text-right tabular-nums`}>
              {row.counts[status] || 0}
            </td>
          ))}
          <td className={`${cellClass} text-right font-semibold tabular-nums text-[#2c3e82]`}>
            {row.total > 0 ? `${row.completionPercent}%` : "—"}
          </td>
        </tr>
      ))}
    </tbody>
  </DashboardListTable>
);

// Horizontal bars, one per row, stacked by status. onSelect: bar click.
const StackedStatusChart = ({ title, rows, statuses, statusColors, onSelect }) => {
  const data = rows.map((row) => ({ key: row.key, name: row.name, ...row.counts }));
  return (
    <ChartPanel title={title}>
      <ResponsiveContainer width="100%" height={Math.min(640, Math.max(240, data.length * 40 + 60))}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
          <Tooltip cursor={{ fill: "#edf1f7" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {statuses.map((status) => (
            <Bar
              key={status}
              dataKey={status}
              stackId="status"
              fill={statusColors[status]}
              isAnimationActive={false}
              cursor={onSelect ? "pointer" : undefined}
              onClick={onSelect ? (entry) => onSelect(entry.key) : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
};

/**
 * Props:
 *   noun, nounPlural      "idea" / "ideas", "task" / "tasks"
 *   fetchReport(params)   resolves to the backend report
 *   getApiError(err, fb)  { message }
 *   statusColors          { ReportStatus: colour }
 *   category              { title, colors, yAxisWidth } for the second breakdown
 *   summaryCards(summary) [{ label, value, accent }]
 *   itemColumns           [{ label, render(item), className }] for one member's list
 *   itemKey               id column of an item
 *   footer                note under the sheet
 */
const ModuleReports = ({
  noun,
  nounPlural,
  fetchReport,
  getApiError,
  statusColors,
  category,
  summaryCards,
  itemColumns,
  itemKey,
  footer,
}) => {
  const Plural = nounPlural.charAt(0).toUpperCase() + nounPlural.slice(1);
  const [scope, setScope] = useState("team");
  // null = the server's current fiscal year.
  const [fiscalYear, setFiscalYear] = useState(null);
  const [departmentId, setDepartmentId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  // The last response and the filters it was for; loading while the
  // filters have changed since.
  const [result, setResult] = useState({ key: null, report: null, error: "" });
  const requestKey = JSON.stringify([scope, fiscalYear, departmentId, employeeId]);
  const loading = result.key !== requestKey;
  const { report, error } = result;

  useEffect(() => {
    let ignore = false;

    fetchReport({
      scope,
      fiscalYear: fiscalYear ?? undefined,
      departmentId: departmentId || undefined,
      employeeId: scope === "team" ? employeeId || undefined : undefined,
    })
      .then((data) => {
        if (!ignore) setResult({ key: requestKey, report: data, error: "" });
      })
      .catch((err) => {
        if (!ignore) {
          setResult({
            key: requestKey,
            report: null,
            error: getApiError(err, `Failed to load ${noun} report.`).message,
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [fetchReport, getApiError, noun, requestKey, scope, fiscalYear, departmentId, employeeId]);

  const isTeam = scope === "team";
  const statuses = report?.Statuses || [];
  const employees = report?.Employees || [];
  const departmentEmployees = departmentId
    ? employees.filter((employee) => String(employee.DepartmentID) === departmentId)
    : employees;
  const selectedEmployee = employees.find((employee) => String(employee.UserID) === employeeId);

  // Department lists differ per tab, so a department filter does not carry over.
  const changeScope = (next) => {
    if (next === scope) return;
    setScope(next);
    setDepartmentId("");
    setEmployeeId("");
  };

  // Clears the employee when they are not in the new department.
  const selectDepartment = (id) => {
    setDepartmentId(id);
    if (id && selectedEmployee && String(selectedEmployee.DepartmentID) !== id) setEmployeeId("");
  };

  const selectEmployee = (id) => setEmployeeId(id == null ? "" : String(id));

  const memberRows = (report?.Members || []).map((member) => ({
    key: member.UserID,
    name: member.employeeName,
    department: member.DepartmentName,
    total: member.total,
    counts: member.counts,
    completionPercent: member.completionPercent,
  }));
  const departmentRows = (report?.DepartmentBreakdown || []).map((row) => ({
    key: row.department,
    name: row.department,
    total: row.total,
    counts: row.counts,
    completionPercent: row.completionPercent,
  }));
  const chartMembers = memberRows.filter((row) => row.total > 0);
  const hasItems = (report?.Summary?.total || 0) > 0;

  const description = isTeam
    ? `${Plural} of the active employees under you, by team member.`
    : `${Plural} across the organisation, by department.`;

  const filters = (
    <>
      <label>
        <span className={taskFilterLabelClass}>Department</span>
        <select value={departmentId} onChange={(e) => selectDepartment(e.target.value)} className={taskFilterControlClass}>
          <option value="">All departments</option>
          {(report?.Departments || []).map((department) => (
            <option key={department.DepartmentID} value={String(department.DepartmentID)}>
              {department.DepartmentName}
            </option>
          ))}
        </select>
      </label>
      {isTeam && (
        <label>
          <span className={taskFilterLabelClass}>Employee</span>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={taskFilterControlClass}>
            <option value="">All team members</option>
            {departmentEmployees.map((employee) => (
              <option key={employee.UserID} value={String(employee.UserID)}>
                {employee.employeeName}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span className={taskFilterLabelClass}>Fiscal year</span>
        <select
          value={fiscalYear ?? report?.CurrentFiscalYear ?? ""}
          onChange={(e) => setFiscalYear(Number(e.target.value))}
          disabled={!report?.FiscalYearOptions?.length}
          className={taskFilterControlClass}
        >
          {(report?.FiscalYearOptions || []).map((year) => (
            <option key={year} value={year}>
              {fiscalYearLabel(year)}
              {year === report.CurrentFiscalYear ? " · current" : ""}
            </option>
          ))}
        </select>
      </label>
    </>
  );

  return (
    <TaskWorkbookFrame
      barSubtitle="Reports & Analytics"
      badge="CFO VIEW"
      title="Reports & Analytics"
      description={description}
      filters={filters}
      footer={footer}
    >
      <div className="mb-5 flex gap-2 border-b border-[#cbd4e2]" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === scope}
            onClick={() => changeScope(tab.key)}
            className={`-mb-px cursor-pointer border-b-2 px-4 py-2 text-sm font-semibold ${
              tab.key === scope
                ? "border-[#2c3e82] text-[#2c3e82]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DashboardError message={error} />

      {loading ? (
        <p className="border border-[#aeb9cc] px-4 py-8 text-center text-sm text-slate-500">Loading report...</p>
      ) : (
        report && (
          <div className="space-y-6">
            {isTeam && selectedEmployee && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-[#30415f]">{selectedEmployee.employeeName}</h2>
                <button type="button" onClick={() => setEmployeeId("")} className={taskSecondaryButtonClass}>
                  &larr; All team members
                </button>
              </div>
            )}

            <SummaryCards
              gridClassName="grid-cols-2 md:grid-cols-4 xl:grid-cols-7"
              cards={summaryCards(report.Summary)}
            />

            {hasItems ? (
              <DashboardBreakdowns
                status={{
                  title: "Status Breakdown",
                  rows: report.StatusBreakdown,
                  colors: statusColors,
                }}
                bar={{
                  title: category.title,
                  rows: report.CategoryBreakdown,
                  colors: category.colors,
                  barName: Plural,
                  yAxisWidth: category.yAxisWidth,
                }}
                snapshot={{
                  title: "Completion Snapshot",
                  rows: report.CompletionSnapshot,
                  colors: SNAPSHOT_COLORS,
                }}
              />
            ) : (
              <DashboardEmptyState
                title={`No ${nounPlural} in FY${report.FiscalYear}`}
                description="Try another fiscal year or department."
              />
            )}

            {isTeam && !selectedEmployee && (
              <>
                {chartMembers.length > 0 && (
                  <StackedStatusChart
                    title={`${Plural} by team member`}
                    rows={chartMembers}
                    statuses={statuses}
                    statusColors={statusColors}
                    onSelect={selectEmployee}
                  />
                )}
                {memberRows.length > 0 ? (
                  <CountsTable
                    title="Team members (select one to see their list)"
                    nameLabel="Employee"
                    rows={memberRows}
                    statuses={statuses}
                    statusColors={statusColors}
                    showDepartment
                    onSelect={selectEmployee}
                  />
                ) : (
                  <DashboardEmptyState
                    title="No team members"
                    description="No active employees are under you for this filter."
                  />
                )}
              </>
            )}

            {!isTeam && departmentRows.length > 0 && (
              <>
                <StackedStatusChart
                  title={`${Plural} by department`}
                  rows={departmentRows}
                  statuses={statuses}
                  statusColors={statusColors}
                />
                <CountsTable
                  title="Departments"
                  nameLabel="Department"
                  rows={departmentRows}
                  statuses={statuses}
                  statusColors={statusColors}
                />
              </>
            )}

            {isTeam && selectedEmployee && hasItems && (
              <DashboardListTable title={`${selectedEmployee.employeeName}'s ${nounPlural}`}>
                <thead>
                  <tr>
                    <th className={`${headClass} w-14 text-center`}>Sr.No.</th>
                    {itemColumns.map((column) => (
                      <th key={column.label} className={headClass}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(report.Items || []).map((item, index) => (
                    <tr key={item[itemKey]} className="hover:bg-[#f7f9fc]">
                      <td className={`${cellClass} text-center bg-[#f4f6fa]`}>{index + 1}</td>
                      {itemColumns.map((column) => (
                        <td key={column.label} className={`${cellClass} ${column.className || ""}`}>
                          {column.render(item)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </DashboardListTable>
            )}
          </div>
        )
      )}
    </TaskWorkbookFrame>
  );
};

export default ModuleReports;
