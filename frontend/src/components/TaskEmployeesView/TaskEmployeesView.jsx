import { useCallback, useEffect, useMemo, useState } from "react";
import TaskSheet from "../TaskSheet/TaskSheet";
import TaskWorkbookFrame, {
  taskFilterControlClass as selectClass,
  taskFilterLabelClass as filterLabelClass,
} from "../TaskWorkbookFrame/TaskWorkbookFrame";
import {
  getAllTasks,
  getAssignableEmployees,
  getEmployeeTaskSummary,
  getTaskApiError,
} from "../../services/taskService";

const WORKLOAD_FILTERS = [
  { value: "", label: "All Employees" },
  { value: "none", label: "No open tasks" },
  { value: "open", label: "Has open tasks" },
  { value: "overdue", label: "Has overdue tasks" },
];

const matchesWorkload = (tasks, workload) => {
  const open = tasks.filter((t) => t.Status !== "Done").length;
  if (workload === "none") return open === 0;
  if (workload === "open") return open > 0;
  if (workload === "overdue") return tasks.some((t) => t.IsOverdue);
  return true;
};

// Group task rows by employee id.
const byEmployee = (tasks) =>
  tasks.reduce((groups, task) => {
    (groups[task.UserID] = groups[task.UserID] || []).push(task);
    return groups;
  }, {});

/**
 * All Tasks > Employees: every active user, with or without tasks, in one
 * sheet. Each employee's tasks are listed with a blank row below, so the
 * Business Head can type a task and press Submit straight away (assigns it
 * and emails the employee), or add / change CFO's Remarks on any task.
 * Admin sees the same sheet read-only.
 *
 * Props:
 *   canAssign        Business Head
 *   headerActions    controls on the right of the page header
 */
export default function TaskEmployeesView({ canAssign = false, headerActions = null }) {
  const [employees, setEmployees] = useState([]);
  const [tasksByEmployee, setTasksByEmployee] = useState({});
  const [assignableIds, setAssignableIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [workload, setWorkload] = useState("");

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const [employeeList, taskList, assignable] = await Promise.all([
          getEmployeeTaskSummary(),
          getAllTasks({}),
          // Everyone except the Business Head themselves.
          canAssign ? getAssignableEmployees() : Promise.resolve([]),
        ]);
        if (ignore) return;
        setEmployees(employeeList || []);
        setTasksByEmployee(byEmployee(taskList || []));
        setAssignableIds(new Set((assignable || []).map((emp) => emp.UserID)));
      } catch (err) {
        if (!ignore) setError(getTaskApiError(err, "Failed to load employees and tasks.").message);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [canAssign]);

  // After a Submit, reload just that employee's tasks.
  const reloadEmployee = useCallback(async (employeeId) => {
    try {
      const list = await getAllTasks({ employeeId });
      setTasksByEmployee((current) => ({ ...current, [employeeId]: list || [] }));
    } catch {
      // The row already showed the result; the next visit reloads.
    }
  }, []);

  const departments = useMemo(
    () => [...new Set(employees.map((emp) => emp.DepartmentName).filter(Boolean))].sort(),
    [employees],
  );

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees
      .filter((emp) => {
        const tasks = tasksByEmployee[emp.UserID] || [];
        if (department && emp.DepartmentName !== department) return false;
        if (!matchesWorkload(tasks, workload)) return false;
        if (!term) return true;
        return (
          (emp.FullName || "").toLowerCase().includes(term) ||
          (emp.EmployeeCode || "").toLowerCase().includes(term)
        );
      })
      .map((emp) => ({
        employee: emp,
        tasks: tasksByEmployee[emp.UserID] || [],
        canAdd: canAssign && assignableIds.has(emp.UserID),
      }));
  }, [employees, tasksByEmployee, assignableIds, canAssign, search, department, workload]);

  const hasFilters = Boolean(search || department || workload);

  return (
    <TaskWorkbookFrame
      barSubtitle="All employees"
      badge="ALL TASKS"
      title="All Tasks"
      description={
        canAssign
          ? "Every employee and their tasks. Type a task in an employee's blank row and press Submit to assign it."
          : "Every employee and their tasks."
      }
      actions={headerActions}
      filters={
        <>
          <div>
            <label htmlFor="emp-search" className={filterLabelClass}>Search</label>
            <input
              id="emp-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or employee code"
              className={selectClass}
            />
          </div>
          <div>
            <label htmlFor="emp-department" className={filterLabelClass}>Department</label>
            <select id="emp-department" value={department} onChange={(e) => setDepartment(e.target.value)} className={selectClass}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="emp-workload" className={filterLabelClass}>Tasks</label>
            <select id="emp-workload" value={workload} onChange={(e) => setWorkload(e.target.value)} className={selectClass}>
              {WORKLOAD_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          {hasFilters && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch("");
                  setDepartment("");
                  setWorkload("");
                }}
                className="text-sm font-semibold text-slate-600 hover:text-[#2c3e82] px-3 py-2 cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      }
      footer="Status and User's Remarks are updated by the employee. Task Name, Priority and Due Date can be changed only on tasks you assigned. Done tasks older than 30 days are not listed."
    >
      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      )}
      {loading ? (
        <p className="border border-[#aeb9cc] px-4 py-8 text-center text-sm text-slate-500">Loading employees and tasks...</p>
      ) : groups.length === 0 ? (
        <p className="border border-[#aeb9cc] px-4 py-8 text-center text-sm text-slate-500">
          {hasFilters ? "No employees match the selected filters." : "No active employees."}
        </p>
      ) : (
        <TaskSheet groups={groups} onSaved={reloadEmployee} />
      )}
    </TaskWorkbookFrame>
  );
}
