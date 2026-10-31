import { useEffect, useState } from "react";
import { createTask, getTaskApiError, updateTask } from "../../services/taskService";
import {
  TASK_NAME_MAX,
  TASK_PRIORITIES,
  TASK_REMARKS_MAX,
  TASK_STATUSES,
  formatTaskDateTime,
} from "../../utils/taskStatus";

const worksheetInputClass =
  "block min-h-32 w-full resize-none border-0 bg-transparent px-2.5 py-2 text-xs text-[#202522] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#2c3e82] disabled:bg-slate-50 disabled:text-slate-500";

const formFromTask = (task) => ({
  taskName: task?.TaskName || "",
  priority: task?.Priority || "Medium",
  dueDate: task?.DueDate || "",
  status: task?.Status || "Pending",
  userRemarks: task?.UserRemarks || "",
});

// Put backend validation messages under the field they refer to.
const fieldErrorsFromApi = (details) =>
  details.reduce((errors, message) => {
    const text = String(message);
    if (/^task name/i.test(text)) errors.taskName = text;
    else if (/^priority/i.test(text)) errors.priority = text;
    else if (/^due date/i.test(text)) errors.dueDate = text;
    else if (/^status/i.test(text)) errors.status = text;
    else if (/^user's remarks/i.test(text)) errors.userRemarks = text;
    return errors;
  }, {});

/**
 * Add Task (task = null) or edit a task. Each field is editable only when
 * the row's permission flag allows it (CanEditDetails for Task Name /
 * Priority / Due Date, CanEditStatus, CanEditUserRemarks); the backend
 * checks the same rules. Only changed fields are sent.
 */
export default function TaskFormDialog({ task = null, onClose, onSaved }) {
  const isNew = !task;
  const canEditDetails = isNew || Boolean(task.CanEditDetails);
  const canEditStatus = isNew || Boolean(task.CanEditStatus);
  const canEditUserRemarks = isNew || Boolean(task.CanEditUserRemarks);

  const [form, setForm] = useState(() => formFromTask(task));
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validate = () => {
    const errors = {};
    const name = form.taskName.trim();
    if (!name) errors.taskName = "Task Name is required.";
    else if (name.length > TASK_NAME_MAX) errors.taskName = `Task Name cannot exceed ${TASK_NAME_MAX} characters.`;
    if (!form.dueDate) errors.dueDate = "Due Date is required.";
    if (form.userRemarks.trim().length > TASK_REMARKS_MAX) {
      errors.userRemarks = `User's Remarks cannot exceed ${TASK_REMARKS_MAX} characters.`;
    }
    return errors;
  };

  const buildChanges = () => {
    const original = formFromTask(task);
    const values = {
      taskName: form.taskName.trim(),
      priority: form.priority,
      dueDate: form.dueDate,
      status: form.status,
      userRemarks: form.userRemarks.trim(),
    };

    if (isNew) return values;

    const changes = {};
    const allowed = {
      taskName: canEditDetails,
      priority: canEditDetails,
      dueDate: canEditDetails,
      status: canEditStatus,
      userRemarks: canEditUserRemarks,
    };
    Object.keys(values).forEach((field) => {
      const before = field === "taskName" || field === "userRemarks" ? original[field].trim() : original[field];
      if (allowed[field] && values[field] !== before) changes[field] = values[field];
    });
    return changes;
  };

  const handleSave = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const changes = buildChanges();
    if (!isNew && Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    try {
      setSaving(true);
      setError("");
      if (isNew) await createTask(changes);
      else await updateTask(task.TaskID, changes);
      onSaved(isNew ? "Task added." : "Task updated.");
    } catch (err) {
      const apiError = getTaskApiError(err, "Failed to save the task.");
      setFieldErrors(fieldErrorsFromApi(apiError.details));
      setError(apiError.details.length > 0 ? `${apiError.message} ${apiError.details.join(" ")}` : apiError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/40 px-4"
      onClick={() => !saving && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-form-title"
        className="max-h-[90vh] w-full max-w-6xl overflow-y-auto border border-[#c6cedc] bg-white shadow-[0_4px_18px_rgba(37,55,80,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-h-12 items-center gap-3 bg-[#2c3e82] px-4 py-2 text-xs font-bold tracking-[0.08em] text-white sm:px-5">
          <div
            className="grid size-7 shrink-0 place-items-center border border-white/45"
            aria-hidden="true"
          >
            <svg className="size-4 stroke-current stroke-[1.5]" viewBox="0 0 24 24" fill="none">
              <path d="M4 3.5h16v17H4zM4 8.5h16M4 14h16M10 3.5v17M15 3.5v17" />
            </svg>
          </div>
          <h2 id="task-form-title" className="font-bold">
            TASK WORKBOOK
          </h2>
          <span className="h-5 w-px bg-white/40" aria-hidden="true" />
          <span className="text-[13px] font-normal tracking-normal">
            {isNew ? "New task" : "Edit task"}
          </span>
        </div>

        <div className="space-y-4 p-3 sm:p-5">
          {!isNew && task.IsAssignedByBusinessHead && canEditStatus && (
            <p className="border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-[#2c3e82]">
              This task was assigned by the Business Head. You can change only its Status and your remarks.
            </p>
          )}

          {error && (
            <div className="border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700" role="alert">
              {error}
            </div>
          )}

          <p className="text-xs text-slate-500">
            Enter task details in the worksheet row. Scroll horizontally to see every column.
          </p>

          <div
            className="max-w-full overflow-x-auto border border-[#aeb9cc] bg-white [scrollbar-color:#aeb9cc_#edf1f7] scrollbar-thin"
            role="region"
            aria-label="Task entry worksheet"
            tabIndex="0"
          >
            <table className="w-full min-w-[1120px] table-fixed border-separate border-spacing-0 text-xs text-[#202522] [&_td]:border-r [&_td]:border-b [&_td]:border-[#d5dce5] [&_td]:p-0 [&_td]:align-top [&_td:last-child]:border-r-0">
              <colgroup>
                <col className="w-10" />
                <col className="w-[300px]" />
                <col className="w-[140px]" />
                <col className="w-[165px]" />
                <col className="w-[150px]" />
                <col className="w-[320px]" />
              </colgroup>
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-3 h-7 border-r border-b border-[#d5dce5] bg-[#edf1f7]" aria-label="Row number" />
                  {["A", "B", "C", "D", "E"].map((letter) => (
                    <th
                      key={letter}
                      className="sticky top-0 z-2 h-7 border-r border-b border-[#d5dce5] bg-[#edf1f7] text-center text-[11px] font-medium text-slate-600"
                    >
                      {letter}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 top-7 z-4 border-r border-b border-[#d5dce5] bg-[#e5eaf3] px-2 py-2 text-center text-[11px] font-bold text-[#30415f]" aria-label="Row number">
                    #
                  </th>
                  {["Task Name", "Priority", "Due Date", "Status", "User's Remarks"].map((heading, index) => (
                    <th
                      key={heading}
                      className="sticky top-7 z-2 h-10 border-r border-b border-[#cbd4e2] bg-[#dce5f2] px-2.5 py-2 text-left text-[11px] font-bold leading-[1.35] text-[#30415f]"
                    >
                      {heading}
                      {[0, 1, 2].includes(index) && <span className="text-red-600"> *</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className="sticky left-0 z-1 border-r border-b border-[#d5dce5] bg-[#f3f5f9] px-2 py-3 text-center text-xs font-semibold text-slate-600">
                    1
                  </th>
                  <td className={fieldErrors.taskName ? "bg-red-50" : "bg-white"}>
                    <label className="sr-only" htmlFor="task-name">Task Name</label>
                    <textarea
                      id="task-name"
                      rows={5}
                      maxLength={TASK_NAME_MAX}
                      value={form.taskName}
                      onChange={(e) => updateField("taskName", e.target.value)}
                      disabled={!canEditDetails || saving}
                      aria-invalid={Boolean(fieldErrors.taskName)}
                      className={worksheetInputClass}
                    />
                    {fieldErrors.taskName && <p className="px-2.5 pb-2 text-[11px] font-medium text-red-700">{fieldErrors.taskName}</p>}
                  </td>
                  <td className={fieldErrors.priority ? "bg-red-50" : "bg-white"}>
                    <label className="sr-only" htmlFor="task-priority">Priority</label>
                    <select
                      id="task-priority"
                      value={form.priority}
                      onChange={(e) => updateField("priority", e.target.value)}
                      disabled={!canEditDetails || saving}
                      aria-invalid={Boolean(fieldErrors.priority)}
                      className={worksheetInputClass}
                    >
                      {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                    {fieldErrors.priority && <p className="px-2.5 pb-2 text-[11px] font-medium text-red-700">{fieldErrors.priority}</p>}
                  </td>
                  <td className={fieldErrors.dueDate ? "bg-red-50" : "bg-white"}>
                    <label className="sr-only" htmlFor="task-due">Due Date</label>
                    <input
                      id="task-due"
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => updateField("dueDate", e.target.value)}
                      disabled={!canEditDetails || saving}
                      aria-invalid={Boolean(fieldErrors.dueDate)}
                      className={worksheetInputClass}
                    />
                    {fieldErrors.dueDate && <p className="px-2.5 pb-2 text-[11px] font-medium text-red-700">{fieldErrors.dueDate}</p>}
                  </td>
                  <td className={fieldErrors.status ? "bg-red-50" : "bg-white"}>
                    <label className="sr-only" htmlFor="task-status">Status</label>
                    <select
                      id="task-status"
                      value={form.status}
                      onChange={(e) => updateField("status", e.target.value)}
                      disabled={!canEditStatus || saving}
                      aria-invalid={Boolean(fieldErrors.status)}
                      className={worksheetInputClass}
                    >
                      {TASK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    {fieldErrors.status && <p className="px-2.5 pb-2 text-[11px] font-medium text-red-700">{fieldErrors.status}</p>}
                  </td>
                  <td className={fieldErrors.userRemarks ? "bg-red-50" : "bg-white"}>
                    <label className="sr-only" htmlFor="task-user-remarks">User's Remarks</label>
                    <textarea
                      id="task-user-remarks"
                      rows={5}
                      maxLength={TASK_REMARKS_MAX}
                      value={form.userRemarks}
                      onChange={(e) => updateField("userRemarks", e.target.value)}
                      disabled={!canEditUserRemarks || saving}
                      aria-invalid={Boolean(fieldErrors.userRemarks)}
                      className={worksheetInputClass}
                    />
                    {fieldErrors.userRemarks && <p className="px-2.5 pb-2 text-[11px] font-medium text-red-700">{fieldErrors.userRemarks}</p>}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {!isNew && task.CFORemarks && (
            <div className="border border-[#cbd4e2] bg-[#f8faff] p-3">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[#30415f]">CFO's Remarks</p>
              <p className="whitespace-pre-wrap text-sm text-slate-800">{task.CFORemarks}</p>
              {task.CFORemarksDate && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {task.CFORemarksByName ? `${task.CFORemarksByName}, ` : ""}{formatTaskDateTime(task.CFORemarksDate)}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-200 pt-4 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="cursor-pointer border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer bg-[#2c3e82] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1f2c61] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : isNew ? "Add Task" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
