const { sql } = require("../config/db");
const AppError = require("./AppError");
const StatusCodes = require("../constants/statusCodes");
const { getFiscalQuarter } = require("./fiscalQuarter");

/**
 * ============================================================
 * CFO Reports & Analytics for the Innovation Ideas and Task Tracker
 * modules (the same two views as the Goal Tracker's Business Head report):
 *   team          active employees under the CFO (Users.BusinessHeadID),
 *                 filterable by department and employee
 *   organisation  every employee, filterable by department
 * Both are for one fiscal year (Apr - Mar, named by its end year).
 *
 * Each module's model returns one row per idea / task with UserID,
 * EmployeeName, DepartmentID, DepartmentName, FiscalYear, ReportStatus and
 * its category column; buildReport counts everything from those rows, so
 * cards, charts and tables always agree.
 * ============================================================
 */

const REPORT_SCOPES = Object.freeze(["team", "organisation"]);

// Fiscal year (end year) in SQL, for a DATE / DATETIME expression:
// April 2026 + 9 months = January 2027, so FY2027.
const sqlFiscalYear = (dateExpression) => `YEAR(DATEADD(MONTH, 9, ${dateExpression}))`;

const getCurrentFiscalYear = () => {
    const { label } = getFiscalQuarter();
    return Number(label.slice(label.indexOf("-") + 1));
};

const parseOptionalId = (value, label) => {
    if (value == null || value === "") return null;
    if (!/^\d+$/.test(String(value)) || Number(value) <= 0) {
        throw new AppError(`${label} must be a number.`, StatusCodes.BAD_REQUEST);
    }
    return Number(value);
};

/**
 * ?scope=team|organisation&fiscalYear=YYYY&departmentId=N&employeeId=N
 * (all optional; employeeId only applies to the team view)
 */
const parseReportQuery = (query = {}) => {
    const scope = query.scope ? String(query.scope).toLowerCase() : "team";
    if (!REPORT_SCOPES.includes(scope)) {
        throw new AppError(`Scope must be one of: ${REPORT_SCOPES.join(", ")}.`, StatusCodes.BAD_REQUEST);
    }

    let fiscalYear = getCurrentFiscalYear();
    if (query.fiscalYear != null && query.fiscalYear !== "") {
        if (!/^\d{4}$/.test(String(query.fiscalYear))) {
            throw new AppError("Fiscal year must be a valid four-digit year.", StatusCodes.BAD_REQUEST);
        }
        fiscalYear = Number(query.fiscalYear);
    }

    return {
        scope,
        fiscalYear,
        departmentId: parseOptionalId(query.departmentId, "Department ID"),
        employeeId: scope === "team" ? parseOptionalId(query.employeeId, "Employee ID") : null,
    };
};

/**
 * Active employees under this Business Head (the CFO's team in the Goal
 * Tracker report too), excluding the Business Head.
 */
const getBusinessHeadTeam = async (db, businessHeadId) => {
    const result = await db.request()
        .input("BusinessHeadID", sql.Int, businessHeadId)
        .query(`
            SELECT
                u.UserID,
                LTRIM(RTRIM(CONCAT(u.FirstName, ' ', u.LastName))) AS EmployeeName,
                u.DepartmentID,
                d.DepartmentName
            FROM dbo.Users u
            LEFT JOIN dbo.Departments d
                ON d.DepartmentID = u.DepartmentID
            WHERE u.BusinessHeadID = @BusinessHeadID
              AND u.UserID <> @BusinessHeadID
              AND u.IsActive = 1
            ORDER BY u.FirstName, u.LastName;
        `);

    return result.recordset;
};

const NO_DEPARTMENT = "No department";

const countStatuses = (rows, statuses) =>
    statuses.map((label) => ({ label, count: rows.filter((row) => row.ReportStatus === label).length }));

const toCountMap = (breakdown) => Object.fromEntries(breakdown.map((row) => [row.label, row.count]));

const uniqueDepartments = (people) =>
    [...new Map(
        people
            .filter((person) => person.DepartmentID != null)
            .map((person) => [person.DepartmentID, {
                DepartmentID: person.DepartmentID,
                DepartmentName: person.DepartmentName || NO_DEPARTMENT,
            }])
    ).values()].sort((a, b) => String(a.DepartmentName).localeCompare(String(b.DepartmentName)));

/**
 * Count the rows for one report.
 *   rows               every idea / task (any fiscal year, any owner)
 *   team               getBusinessHeadTeam rows (team scope only)
 *   statuses           ReportStatus values, in display order
 *   categoryField      row column for the second breakdown (Purpose, Priority)
 *   categories         its values, in display order
 *   completedStatus    the ReportStatus that counts as done
 *   completionBase     (counts by status, total) => the "out of" number for
 *                      completion % (e.g. only approved ideas)
 * Returns the filter options, breakdowns, per-department and (team) per-member
 * rows, the filtered rows (`rows`, for the module's summary cards) and, with
 * an employee selected, that employee's rows (`Items`).
 */
const buildReport = ({
    query,
    rows,
    team = [],
    statuses,
    categoryField,
    categories,
    completedStatus,
    completionBase,
}) => {
    const { scope, fiscalYear, departmentId, employeeId } = query;
    const currentFiscalYear = getCurrentFiscalYear();
    const isTeam = scope === "team";

    if (isTeam && employeeId != null && !team.some((e) => Number(e.UserID) === employeeId)) {
        throw new AppError("You can only view reports for employees under you.", StatusCodes.FORBIDDEN);
    }

    const teamIds = new Set(team.map((e) => Number(e.UserID)));
    const scopedRows = isTeam ? rows.filter((row) => teamIds.has(Number(row.UserID))) : rows;

    const fiscalYearOptions = [...new Set([
        currentFiscalYear,
        ...scopedRows.map((row) => Number(row.FiscalYear)).filter(Boolean),
    ])].sort((a, b) => b - a);

    const departments = uniqueDepartments(isTeam ? team : scopedRows);

    const inDepartment = (row) => departmentId == null || Number(row.DepartmentID) === departmentId;
    const filteredRows = scopedRows.filter((row) =>
        Number(row.FiscalYear) === fiscalYear
        && inDepartment(row)
        && (employeeId == null || Number(row.UserID) === employeeId));

    const percentOf = (counts, total) => {
        const base = completionBase(counts, total);
        return base === 0 ? 0 : Math.round(((counts[completedStatus] || 0) / base) * 100);
    };

    const statusBreakdown = countStatuses(filteredRows, statuses);
    const statusCounts = toCountMap(statusBreakdown);
    const completed = statusCounts[completedStatus] || 0;
    const completionTotal = completionBase(statusCounts, filteredRows.length);

    // One row per department with any ideas / tasks in the filter.
    const departmentGroups = new Map();
    filteredRows.forEach((row) => {
        const name = row.DepartmentName || NO_DEPARTMENT;
        if (!departmentGroups.has(name)) departmentGroups.set(name, []);
        departmentGroups.get(name).push(row);
    });
    const departmentBreakdown = [...departmentGroups.entries()]
        .map(([department, departmentRows]) => {
            const counts = toCountMap(countStatuses(departmentRows, statuses));
            return {
                department,
                total: departmentRows.length,
                counts,
                completionPercent: percentOf(counts, departmentRows.length),
            };
        })
        .sort((a, b) => a.department.localeCompare(b.department));

    // Team: every employee in the filter, including those with nothing.
    const members = isTeam
        ? team
            .filter((employee) => inDepartment(employee)
                && (employeeId == null || Number(employee.UserID) === employeeId))
            .map((employee) => {
                const memberRows = filteredRows.filter((row) => Number(row.UserID) === Number(employee.UserID));
                const counts = toCountMap(countStatuses(memberRows, statuses));
                return {
                    UserID: employee.UserID,
                    employeeName: employee.EmployeeName,
                    DepartmentName: employee.DepartmentName || NO_DEPARTMENT,
                    total: memberRows.length,
                    counts,
                    completionPercent: percentOf(counts, memberRows.length),
                };
            })
        : [];

    return {
        Scope: scope,
        FiscalYear: fiscalYear,
        CurrentFiscalYear: currentFiscalYear,
        FiscalYearOptions: fiscalYearOptions,
        Departments: departments,
        Employees: team.map((employee) => ({
            UserID: employee.UserID,
            employeeName: employee.EmployeeName,
            DepartmentID: employee.DepartmentID,
        })),
        SelectedDepartmentID: departmentId,
        SelectedEmployeeID: employeeId,
        Statuses: statuses,
        StatusBreakdown: statusBreakdown,
        CategoryBreakdown: categories.map((label) => ({
            label,
            count: filteredRows.filter((row) => row[categoryField] === label).length,
        })),
        CompletionSnapshot: [
            { label: "Completed", count: completed },
            { label: "Remaining", count: Math.max(0, completionTotal - completed) },
        ],
        CompletionPercent: completionTotal === 0 ? 0 : Math.round((completed / completionTotal) * 100),
        DepartmentBreakdown: departmentBreakdown,
        Members: members,
        Items: employeeId != null ? filteredRows : null,
        rows: filteredRows,
    };
};

module.exports = {
    REPORT_SCOPES,
    sqlFiscalYear,
    parseReportQuery,
    getBusinessHeadTeam,
    buildReport,
};
