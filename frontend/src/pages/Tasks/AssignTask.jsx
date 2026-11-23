import React, { useCallback, useEffect, useMemo, useState } from "react";
import TaskWorkbookFrame, {
  taskFilterControlClass,
  taskFilterLabelClass,
} from "../../components/TaskWorkbookFrame/TaskWorkbookFrame";
import DateInput from "../../components/DateInput/DateInput";
import {
  assignTasks,
  getAssignableEmployees,
  getAssignedByMonth,
  getEmployeeProjects,
  getTaskApiError,
} from "../../services/taskService";
import { TASK_NAME_MAX, TASK_PRIORITIES, getTaskStatusClasses, getTodayKey } from "../../utils/taskStatus";
import { worksheetControlClass, worksheetLineAddClass, worksheetLineRemoveClass } from "../../utils/goalWorksheet";
import { formatDisplayDate } from "../../utils/dateTime";

// Same grid look as the task sheet (components/TaskSheet).
const COLUMNS = ["Sr.No.", "Employee", "Project", "Task Name", "Priority", "Created Date", "Due Date", "Status", ""];
const headClass =
  "sticky top-0 z-2 h-10.5 border-r border-b border-[#cbd4e2] bg-[#dce5f2] px-2.5 py-2 text-left text-[11px] font-bold leading-[1.35] text-[#30415f] align-middle whitespace-nowrap last:border-r-0";
const cellClass = "p-0 border-r border-b border-[#d5dce5] last:border-r-0 align-top";
const cellInputClass = `${worksheetControlClass} disabled:text-slate-500`;
const readOnlyClass = "px-2.5 py-3 text-xs text-[#202522]";

const INITIAL_ROWS = 3;

let rowCounter = 0;
const newRow = () => ({ key: `row-${(rowCounter += 1)}`, employeeId: "", projectId: "", taskName: "", priority: "Medium", dueDate: "" });
const freshRows = () => Array.from({ length: INITIAL_ROWS }, newRow);

const monthKey = (dateKey) => dateKey.slice(0, 7); // "YYYY-MM-DD" -> "YYYY-MM"

const monthLabel = (month) => {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
};

const isBlank = (row) => !row.employeeId && !row.taskName.trim() && !row.dueDate;

const rowError = (row, today) => {
  const missing = [
    !row.employeeId && "Employee",
    !row.taskName.trim() && "Task Name",
    !row.dueDate && "Due Date",
  ].filter(Boolean);
  if (missing.length > 0) return `${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} required.`;
  if (row.dueDate < today) return "Due Date cannot be in the past.";
  return null;
};

/**
 * Business Head: assign tasks to several employees at once. The sheet is
 * a range of months (From / To month filters, default this month): tasks
 * already assigned in it are listed read-only first, numbered in the order
 * they were assigned; when the range reaches the current month blank rows
 * follow them. One
 * employee per row; Project (optional) lists the projects that employee
 * is a member of, making it a task in that project. "+ Add row" adds a row and the single Submit at the
 * bottom assigns every filled row (all or none) and emails each employee.
 * After Submit the new tasks join the list and numbering continues. Rows
 * left completely blank are skipped. To change tasks: All Tasks.
 */
const AssignTask = () => {
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [rows, setRows] = useState(freshRows);
  const [rowErrors, setRowErrors] = useState({});
  const [error, setError] = useState(null); // { message, details }
  const [success, setSuccess] = useState(null); // { message, warning }
  const [saving, setSaving] = useState(false);

  const today = getTodayKey();
  const currentMonth = monthKey(today);
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [toMonth, setToMonth] = useState(currentMonth);
  // New tasks are always assigned today, so blank rows show only when the
  // range ends in the current month.
  const isCurrentMonth = toMonth === currentMonth;
  const range = `${fromMonth}..${toMonth}`;
  const rangeLabel =
    fromMonth === toMonth ? monthLabel(fromMonth) : `${monthLabel(fromMonth)} – ${monthLabel(toMonth)}`;

  // Tasks already assigned in the selected months; loading while that differs.
  const [saved, setSaved] = useState({ range: null, tasks: [] });
  const [reloadKey, setReloadKey] = useState(0);
  const reloadSaved = useCallback(() => setReloadKey((key) => key + 1), []);
  const savedLoading = saved.range !== range;
  const savedTasks = savedLoading ? [] : saved.tasks;

  useEffect(() => {
    let ignore = false;
    getAssignedByMonth(fromMonth, toMonth)
      .then((list) => {
        if (!ignore) setSaved({ range, tasks: list || [] });
      })
      .catch((err) => {
        if (ignore) return;
        setSaved({ range, tasks: [] });
        setError({ message: getTaskApiError(err, "Failed to load assigned tasks.").message, details: [] });
      });
    return () => {
      ignore = true;
    };
  }, [fromMonth, toMonth, range, reloadKey]);

  useEffect(() => {
    let ignore = false;
    getAssignableEmployees()
      .then((list) => {
        if (!ignore) setEmployees(list || []);
      })
      .catch((err) => {
        if (!ignore) setError({ message: getTaskApiError(err, "Failed to load employees.").message, details: [] });
      })
      .finally(() => {
        if (!ignore) setEmployeesLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const employeeOptions = useMemo(
    () =>
      employees.map((emp) => ({
        value: String(emp.UserID),
        label: [emp.FullName, emp.EmployeeCode, emp.DepartmentName].filter(Boolean).join(" – "),
      })),
    [employees],
  );

  // Projects per employee (UserID -> list, or null while loading), fetched
  // the first time that employee is picked on any row.
  const [projectsByUser, setProjectsByUser] = useState({});

  const loadProjects = (userId) => {
    if (!userId || userId in projectsByUser) return;
    setProjectsByUser((current) => ({ ...current, [userId]: null }));
    getEmployeeProjects(userId)
      .then((list) => setProjectsByUser((current) => ({ ...current, [userId]: list || [] })))
      .catch((err) => {
        setProjectsByUser((current) => ({ ...current, [userId]: [] }));
        setError({ message: getTaskApiError(err, "Failed to load the employee's projects.").message, details: [] });
      });
  };

  const changeEmployee = (key, employeeId) => {
    updateRow(key, "employeeId", employeeId);
    // A project belongs to the previous employee; pick again.
    setRows((current) => current.map((row) => (row.key === key ? { ...row, projectId: "" } : row)));
    loadProjects(employeeId);
  };

  const updateRow = (key, field, value) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
    setRowErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setSuccess(null);
  };

  const addRow = () => setRows((current) => [...current, newRow()]);

  const removeRow = (key) => {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.key !== key) : current));
    setRowErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const filledRows = rows.filter((row) => !isBlank(row));

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (filledRows.length === 0) {
      setError({ message: "Fill in at least one row to assign.", details: [] });
      return;
    }

    const errors = {};
    filledRows.forEach((row) => {
      const message = rowError(row, today);
      if (message) errors[row.key] = message;
    });
    setRowErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError({ message: "Please fix the highlighted rows.", details: [] });
      return;
    }

    setSaving(true);
    try {
      const result = await assignTasks(
        filledRows.map((row) => ({
          employeeId: Number(row.employeeId),
          projectId: row.projectId ? Number(row.projectId) : null,
          taskName: row.taskName.trim(),
          priority: row.priority,
          dueDate: row.dueDate,
        })),
      );
      const people = new Set(filledRows.map((row) => row.employeeId)).size;
      setSuccess({
        message: `${result.assignedCount} task(s) assigned to ${people} employee(s). ${result.mailSent ? "The employees have been emailed." : ""}`.trim(),
        warning: result.mailWarning,
      });
      setRows(freshRows());
      setRowErrors({});
      reloadSaved();
    } catch (err) {
      const apiError = getTaskApiError(err, "Failed to assign tasks.");
      // Backend row numbers count only the filled rows; map them back to the sheet's Sr.No.
      const serialOf = filledRows.map((row) => savedTasks.length + rows.indexOf(row) + 1);
      const details = apiError.details.map((detail) =>
        detail.replace(/^Row (\d+):/, (match, n) => `Row ${serialOf[Number(n) - 1] ?? n}:`),
      );
      setError({ message: apiError.message, details });
    } finally {
      setSaving(false);
    }
  };

  return (
    <TaskWorkbookFrame
      barSubtitle="Assign tasks"
      // badge="CFO"
      title="Assign Task"
      description="Pick an employee on each row and type the task. Use + Add row for more, then press Submit once to assign them all. Each employee is emailed."
      actions={
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <div className="w-full sm:w-48">
            <label htmlFor="assign-from-month" className={taskFilterLabelClass}>From Month</label>
            <input
              id="assign-from-month"
              type="month"
              value={fromMonth}
              max={toMonth}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                setFromMonth(value);
                // Keep the range valid: a later From moves To with it.
                if (value > toMonth) setToMonth(value > currentMonth ? currentMonth : value);
                setSuccess(null);
              }}
              className={taskFilterControlClass}
            />
          </div>
          <div className="w-full sm:w-48">
            <label htmlFor="assign-to-month" className={taskFilterLabelClass}>To Month</label>
            <input
              id="assign-to-month"
              type="month"
              value={toMonth}
              min={fromMonth}
              max={currentMonth}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                const next = value > currentMonth ? currentMonth : value;
                setToMonth(next);
                // An earlier To moves From with it.
                if (next < fromMonth) setFromMonth(next);
                setSuccess(null);
              }}
              className={taskFilterControlClass}
            />
          </div>
        </div>
      }
      footer="Tasks assigned in the selected months are listed first. New tasks can be added only when the range ends in the current month. Rows left completely blank are skipped. Status and User's Remarks are updated by the employee. To change assigned tasks, open All Tasks."
    >
      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
          {error.message}
          {error.details.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs font-normal">
              {error.details.map((detail) => <li key={detail}>{detail}</li>)}
            </ul>
          )}
        </div>
      )}
      {success && (
        <div className="mb-4 border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800" role="status">
          {success.message}
          {success.warning && <p className="mt-1 text-xs font-normal text-amber-800">{success.warning}</p>}
        </div>
      )}

      <div className="max-w-full overflow-x-auto border border-[#aeb9cc] bg-white [scrollbar-color:#aeb9cc_#edf1f7] scrollbar-thin">
        <table className="min-w-full border-separate border-spacing-0 text-xs text-[#202522]">
          <thead>
            <tr>
              {COLUMNS.map((heading, i) => (
                <th key={heading || `col-${i}`} className={`${headClass} ${i === 0 ? "bg-[#e5eaf3] text-center" : ""}`}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {savedLoading && (
              <tr>
                <td colSpan={COLUMNS.length} className="border-b border-[#d5dce5] px-4 py-3 text-center text-xs text-slate-500">
                  Loading tasks for {rangeLabel}...
                </td>
              </tr>
            )}
            {!savedLoading && savedTasks.length === 0 && !isCurrentMonth && (
              <tr>
                <td colSpan={COLUMNS.length} className="border-b border-[#d5dce5] px-4 py-6 text-center text-xs text-slate-500">
                  No tasks were assigned in {rangeLabel}.
                </td>
              </tr>
            )}
            {savedTasks.map((task, index) => (
              <tr key={task.TaskID} className="bg-[#fafbfd]">
                <td className={`${cellClass} w-14 bg-[#edf1f7] pt-3 text-center text-xs font-medium text-slate-600`}>{index + 1}</td>
                <td className={`${cellClass} min-w-[240px]`}>
                  <div className={readOnlyClass}>
                    {task.EmployeeName}
                    {task.EmployeeCode && <span className="text-slate-500"> – {task.EmployeeCode}</span>}
                  </div>
                </td>
                <td className={`${cellClass} min-w-[180px]`}>
                  <div className={`${readOnlyClass} ${task.ProjectName ? "" : "text-slate-400"}`}>
                    {task.ProjectName || "—"}
                  </div>
                </td>
                <td className={`${cellClass} min-w-[260px]`}>
                  <div className={`${readOnlyClass} whitespace-pre-wrap break-words`}>{task.TaskName}</div>
                </td>
                <td className={`${cellClass} w-32 min-w-[110px]`}>
                  <div className={`${readOnlyClass} text-center`}>{task.Priority}</div>
                </td>
                <td className={`${cellClass} w-32 min-w-[110px]`}>
                  <div className={`${readOnlyClass} text-center`}>{formatDisplayDate(task.AssignedDate || task.CreatedDate)}</div>
                </td>
                <td className={`${cellClass} w-40 min-w-[150px]`}>
                  <div className={`${readOnlyClass} text-center`}>{formatDisplayDate(task.DueDate)}</div>
                </td>
                <td className={`${cellClass} min-w-[150px]`}>
                  <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2.5">
                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold ${getTaskStatusClasses(task.Status)}`}>{task.Status}</span>
                    {task.IsOverdue && (
                      <span className="border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#b3403f]">Overdue</span>
                    )}
                  </div>
                </td>
                <td className={`${cellClass} w-10`} />
              </tr>
            ))}
            {isCurrentMonth && rows.map((row, index) => {
              const serial = savedTasks.length + index + 1;
              const message = rowErrors[row.key];
              return (
                <React.Fragment key={row.key}>
                  <tr className={message ? "bg-red-50/40" : "bg-white"}>
                    <td className={`${cellClass} w-14 bg-[#edf1f7] pt-3 text-center text-xs font-medium text-slate-600`}>{serial}</td>

                    <td className={`${cellClass} min-w-[240px]`}>
                      <select
                        value={row.employeeId}
                        onChange={(e) => changeEmployee(row.key, e.target.value)}
                        disabled={saving || employeesLoading}
                        aria-label={`Employee, row ${serial}`}
                        className={`${cellInputClass} cursor-pointer ${row.employeeId ? "" : "text-slate-400"}`}
                      >
                        <option value="">{employeesLoading ? "Loading employees..." : "Select employee..."}</option>
                        {employeeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value} className="text-[#202522]">{opt.label}</option>
                        ))}
                      </select>
                    </td>

                    <td className={`${cellClass} min-w-[180px]`}>
                      {(() => {
                        const projects = row.employeeId ? projectsByUser[row.employeeId] : undefined;
                        const loadingProjects = Boolean(row.employeeId) && projects === null;
                        const placeholder = !row.employeeId
                          ? "Select employee first"
                          : loadingProjects
                            ? "Loading projects..."
                            : projects?.length
                              ? "Select project (optional)"
                              : "Not in any project";
                        return (
                          <select
                            value={row.projectId}
                            onChange={(e) => updateRow(row.key, "projectId", e.target.value)}
                            disabled={saving || !row.employeeId || loadingProjects || !projects?.length}
                            aria-label={`Project, row ${serial}`}
                            className={`${cellInputClass} cursor-pointer disabled:cursor-not-allowed ${row.projectId ? "" : "text-slate-400"}`}
                          >
                            <option value="">{placeholder}</option>
                            {(projects || []).map((project) => (
                              <option key={project.ProjectID} value={String(project.ProjectID)} className="text-[#202522]">
                                {project.ProjectName}
                              </option>
                            ))}
                          </select>
                        );
                      })()}
                    </td>

                    <td className={`${cellClass} min-w-[260px]`}>
                      <input
                        type="text"
                        value={row.taskName}
                        maxLength={TASK_NAME_MAX}
                        onChange={(e) => updateRow(row.key, "taskName", e.target.value)}
                        disabled={saving}
                        placeholder="Type a task..."
                        aria-label={`Task name, row ${serial}`}
                        className={cellInputClass}
                      />
                    </td>

                    <td className={`${cellClass} w-32 min-w-[110px]`}>
                      <select
                        value={row.priority}
                        onChange={(e) => updateRow(row.key, "priority", e.target.value)}
                        disabled={saving}
                        aria-label={`Priority, row ${serial}`}
                        className={`${cellInputClass} text-center cursor-pointer`}
                      >
                        {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>

                    <td className={`${cellClass} w-32 min-w-[110px]`}>
                      <div className={`${readOnlyClass} text-center text-slate-500`}>{formatDisplayDate(today)}</div>
                    </td>

                    <td className={`${cellClass} w-40 min-w-[150px]`}>
                      <DateInput
                        value={row.dueDate}
                        min={today}
                        onChange={(e) => updateRow(row.key, "dueDate", e.target.value)}
                        disabled={saving}
                        aria-label={`Due date, row ${serial}`}
                        className={`${cellInputClass} text-center`}
                      />
                    </td>

                    <td className={`${cellClass} min-w-[150px]`}>
                      <div className={`${readOnlyClass} text-slate-400`}>Not Started</div>
                    </td>

                    <td className={`${cellClass} w-10`}>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.key)}
                          disabled={saving}
                          title="Remove row"
                          aria-label={`Remove row ${serial}`}
                          className={`${worksheetLineRemoveClass} h-[42px] w-full`}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                  {message && (
                    <tr className="bg-red-50">
                      <td colSpan={COLUMNS.length} className="border-b border-[#d5dce5] px-4 py-1.5 text-[11px] font-medium text-[#b3403f]">
                        Row {serial}: {message}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {isCurrentMonth && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-2 border-b border-[#d5dce5] bg-white">
                  <button type="button" onClick={addRow} disabled={saving} className={worksheetLineAddClass}>
                    + Add row
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <span className="text-xs text-slate-500">
          {savedLoading ? "" : `${savedTasks.length} task(s) assigned in ${rangeLabel}`}
          {isCurrentMonth && ` · ${filledRows.length} ready to assign`}
        </span>
        {isCurrentMonth && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || filledRows.length === 0}
          className="cursor-pointer bg-[#2c3e82] px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2c61] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Assigning..." : "Submit"}
        </button>
        )}
      </div>
    </TaskWorkbookFrame>
  );
};

export default AssignTask;
