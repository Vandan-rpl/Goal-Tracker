import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import SearchableSelect from "../../components/SearchableSelect/SearchableSelect";
import { assignTask, getAssignableEmployees, getTaskApiError } from "../../services/taskService";
import {
  TASK_NAME_MAX,
  TASK_PRIORITIES,
  TASK_REMARKS_MAX,
  getTodayKey,
} from "../../utils/taskStatus";

const EMPTY_FORM = {
  employeeId: null,
  taskName: "",
  priority: "Medium",
  dueDate: "",
  cfoRemarks: "",
};

const inputClass = (hasError) =>
  `w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
    hasError ? "border-red-500" : "border-slate-300"
  }`;

const labelClass = "block text-sm font-semibold text-slate-700 mb-1";

// Put backend validation messages under the field they refer to.
const fieldErrorsFromApi = (details) =>
  details.reduce((errors, message) => {
    const text = String(message);
    if (/employee/i.test(text)) errors.employeeId = text;
    else if (/^task name/i.test(text)) errors.taskName = text;
    else if (/^priority/i.test(text)) errors.priority = text;
    else if (/^due date/i.test(text)) errors.dueDate = text;
    else if (/^cfo's remarks/i.test(text)) errors.cfoRemarks = text;
    return errors;
  }, {});

// Business Head: assign a task to an active employee. The employee is
// emailed after the task is saved; if the email fails the task stays and a
// warning is shown.
const AssignTask = () => {
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const today = getTodayKey();

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

  const employeeOptions = useMemo(
    () =>
      employees.map((emp) => ({
        value: emp.UserID,
        label: [emp.FullName, emp.EmployeeCode, emp.DepartmentName].filter(Boolean).join(" – "),
      })),
    [employees],
  );

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const errors = {};
    const name = form.taskName.trim();
    if (!form.employeeId) errors.employeeId = "Employee is required.";
    if (!name) errors.taskName = "Task Name is required.";
    else if (name.length > TASK_NAME_MAX) errors.taskName = `Task Name cannot exceed ${TASK_NAME_MAX} characters.`;
    if (!form.dueDate) errors.dueDate = "Due Date is required.";
    else if (form.dueDate < today) errors.dueDate = "Due Date must be today or later.";
    if (form.cfoRemarks.trim().length > TASK_REMARKS_MAX) {
      errors.cfoRemarks = `CFO's Remarks cannot exceed ${TASK_REMARKS_MAX} characters.`;
    }
    return errors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      setSaving(true);
      setError("");
      const result = await assignTask({
        employeeId: form.employeeId,
        taskName: form.taskName.trim(),
        priority: form.priority,
        dueDate: form.dueDate,
        cfoRemarks: form.cfoRemarks.trim(),
      });
      if (result?.mailWarning) toast.warning(`Task assigned. ${result.mailWarning}`);
      else toast.success("Task assigned and emailed to the employee.");
      setForm(EMPTY_FORM);
      setFieldErrors({});
    } catch (err) {
      const apiError = getTaskApiError(err, "Failed to assign the task.");
      setFieldErrors(fieldErrorsFromApi(apiError.details));
      setError(apiError.details.length > 0 ? `${apiError.message} ${apiError.details.join(" ")}` : apiError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900">Assign Task</h1>
          <p className="text-sm text-gray-500 mt-1">
            Assign a task to an employee. They are emailed and see it as New in My Tasks.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">{error}</div>}

          <div>
            <label htmlFor="assign-employee" className={labelClass}>Employee *</label>
            <SearchableSelect
              id="assign-employee"
              options={employeeOptions}
              value={form.employeeId}
              onChange={(value) => updateField("employeeId", value)}
              placeholder="Search by name, code or department"
              disabled={saving}
              loading={employeesLoading}
              hasError={Boolean(fieldErrors.employeeId)}
              aria-invalid={Boolean(fieldErrors.employeeId)}
            />
            {fieldErrors.employeeId && <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.employeeId}</p>}
          </div>

          <div>
            <label htmlFor="assign-task-name" className={labelClass}>Task Name *</label>
            <textarea
              id="assign-task-name"
              rows={2}
              maxLength={TASK_NAME_MAX}
              value={form.taskName}
              onChange={(e) => updateField("taskName", e.target.value)}
              disabled={saving}
              className={inputClass(fieldErrors.taskName)}
            />
            {fieldErrors.taskName && <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.taskName}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="assign-priority" className={labelClass}>Priority *</label>
              <select
                id="assign-priority"
                value={form.priority}
                onChange={(e) => updateField("priority", e.target.value)}
                disabled={saving}
                className={inputClass(fieldErrors.priority)}
              >
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {fieldErrors.priority && <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.priority}</p>}
            </div>
            <div>
              <label htmlFor="assign-due-date" className={labelClass}>Due Date *</label>
              <input
                id="assign-due-date"
                type="date"
                min={today}
                value={form.dueDate}
                onChange={(e) => updateField("dueDate", e.target.value)}
                disabled={saving}
                className={inputClass(fieldErrors.dueDate)}
              />
              {fieldErrors.dueDate && <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.dueDate}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="assign-cfo-remarks" className={labelClass}>CFO's Remarks (instructions)</label>
            <textarea
              id="assign-cfo-remarks"
              rows={4}
              maxLength={TASK_REMARKS_MAX}
              value={form.cfoRemarks}
              onChange={(e) => updateField("cfoRemarks", e.target.value)}
              disabled={saving}
              className={inputClass(fieldErrors.cfoRemarks)}
            />
            <p className="text-[11px] text-slate-400 mt-1 text-right">{form.cfoRemarks.length}/{TASK_REMARKS_MAX}</p>
            {fieldErrors.cfoRemarks && <p className="text-red-600 text-xs font-medium">{fieldErrors.cfoRemarks}</p>}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Assigning..." : "Assign Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssignTask;
