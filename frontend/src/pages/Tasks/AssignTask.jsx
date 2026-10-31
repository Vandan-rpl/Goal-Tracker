import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import SearchableSelect from "../../components/SearchableSelect/SearchableSelect";
import TaskSheet from "../../components/TaskSheet/TaskSheet";
import TaskWorkbookFrame, { taskFilterLabelClass } from "../../components/TaskWorkbookFrame/TaskWorkbookFrame";
import { getAllTasks, getAssignableEmployees, getTaskApiError } from "../../services/taskService";

// Business Head: one employee's task sheet. Pick the employee; their tasks
// are listed with blank rows below, and Submit on a row assigns the task or
// saves CFO's Remarks (see TaskSheet). All employees at once: All Tasks >
// Employees.
const AssignTask = () => {
  // ?employeeId= picks the employee.
  const [searchParams, setSearchParams] = useSearchParams();
  const employeeId = Number(searchParams.get("employeeId")) || null;

  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  // Tasks of the employee they were loaded for; loading while that differs
  // from the selected employee.
  const [loaded, setLoaded] = useState({ employeeId: null, tasks: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    getAssignableEmployees()
      .then((list) => {
        if (!ignore) setEmployees(list || []);
      })
      .catch((err) => {
        if (!ignore) setError(getTaskApiError(err, "Failed to load employees.").message);
      })
      .finally(() => {
        if (!ignore) setEmployeesLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Bumped after a Submit to reload the selected employee's tasks.
  const [reloadKey, setReloadKey] = useState(0);
  const reloadTasks = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!employeeId) return undefined;
    let ignore = false;
    getAllTasks({ employeeId })
      .then((list) => {
        if (ignore) return;
        setLoaded({ employeeId, tasks: list || [] });
        setError("");
      })
      .catch((err) => {
        if (ignore) return;
        setLoaded({ employeeId, tasks: [] });
        setError(getTaskApiError(err, "Failed to load this employee's tasks.").message);
      });
    return () => {
      ignore = true;
    };
  }, [employeeId, reloadKey]);

  const tasksLoading = Boolean(employeeId) && loaded.employeeId !== employeeId;
  const tasks = tasksLoading ? [] : loaded.tasks;

  const employeeOptions = useMemo(
    () =>
      employees.map((emp) => ({
        value: emp.UserID,
        label: [emp.FullName, emp.EmployeeCode, emp.DepartmentName].filter(Boolean).join(" – "),
      })),
    [employees],
  );

  const selectedEmployee = employees.find((emp) => emp.UserID === employeeId) || null;

  return (
    <TaskWorkbookFrame
      barSubtitle="Assign tasks"
      badge="BUSINESS HEAD"
      title="Assign Task"
      description="Pick an employee, type tasks into the blank rows and press Submit on each row. The employee is emailed."
      actions={
        <div className="w-full sm:w-96">
          <label htmlFor="assign-employee" className={taskFilterLabelClass}>Employee</label>
          <SearchableSelect
            id="assign-employee"
            options={employeeOptions}
            value={employeeId}
            onChange={(value) => setSearchParams(value ? { employeeId: String(value) } : {})}
            placeholder="Search by name, code or department"
            loading={employeesLoading}
          />
        </div>
      }
      footer={employeeId ? "Status and User's Remarks are updated by the employee. Task Name, Priority and Due Date can be changed only on tasks you assigned. Done tasks older than 30 days are not listed." : null}
    >
      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      )}
      {!employeeId ? (
        <div className="border border-dashed border-[#aeb9cc] bg-[#f4f6fa] p-10 text-center text-sm text-slate-500">
          Select an employee to see their tasks and assign new ones.
        </div>
      ) : tasksLoading && tasks.length === 0 ? (
        <p className="border border-[#aeb9cc] px-4 py-8 text-center text-sm text-slate-500">Loading tasks...</p>
      ) : selectedEmployee ? (
        <TaskSheet
          // A different employee starts with a clean sheet.
          key={employeeId}
          groups={[{ employee: selectedEmployee, tasks, canAdd: true }]}
          blankRows={3}
          onSaved={reloadTasks}
        />
      ) : null}
    </TaskWorkbookFrame>
  );
};

export default AssignTask;
