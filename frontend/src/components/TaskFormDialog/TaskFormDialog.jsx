import { useEffect, useState } from "react";
import { createTask, getTaskApiError, updateTask } from "../../services/taskService";
import {
  TASK_NAME_MAX,
  TASK_PRIORITIES,
  TASK_REMARKS_MAX,
  TASK_STATUSES,
  formatTaskDateTime,
} from "../../utils/taskStatus";

const inputClass = (hasError) =>
  `w-full px-3 py-2 bg-white border rounded-lg text-slate-900 focus:outline-none focus:border-slate-800 transition disabled:bg-slate-100 disabled:text-slate-500 text-sm ${
    hasError ? "border-red-500" : "border-slate-300"
  }`;

const labelClass = "block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1";

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
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <h2 id="task-form-title" className="text-base font-bold text-slate-900">
            {isNew ? "Add Task" : "Edit Task"}
          </h2>
          {!isNew && task.IsAssignedByBusinessHead && canEditStatus && (
            <p className="text-xs text-slate-500 mt-1">
              This task was assigned by the Business Head. You can change only its Status and your remarks.
            </p>
          )}
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium">{error}</div>}

        <div>
          <label htmlFor="task-name" className={labelClass}>Task Name *</label>
          <textarea
            id="task-name"
            rows={2}
            maxLength={TASK_NAME_MAX}
            value={form.taskName}
            onChange={(e) => updateField("taskName", e.target.value)}
            disabled={!canEditDetails || saving}
            className={inputClass(fieldErrors.taskName)}
          />
          {fieldErrors.taskName && <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.taskName}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="task-priority" className={labelClass}>Priority *</label>
            <select
              id="task-priority"
              value={form.priority}
              onChange={(e) => updateField("priority", e.target.value)}
              disabled={!canEditDetails || saving}
              className={inputClass(fieldErrors.priority)}
            >
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="task-due" className={labelClass}>Due Date *</label>
            <input
              id="task-due"
              type="date"
              value={form.dueDate}
              onChange={(e) => updateField("dueDate", e.target.value)}
              disabled={!canEditDetails || saving}
              className={inputClass(fieldErrors.dueDate)}
            />
          </div>
          <div>
            <label htmlFor="task-status" className={labelClass}>Status</label>
            <select
              id="task-status"
              value={form.status}
              onChange={(e) => updateField("status", e.target.value)}
              disabled={!canEditStatus || saving}
              className={inputClass(fieldErrors.status)}
            >
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {(fieldErrors.priority || fieldErrors.dueDate || fieldErrors.status) && (
          <p className="text-red-600 text-xs font-medium">
            {[fieldErrors.priority, fieldErrors.dueDate, fieldErrors.status].filter(Boolean).join(" ")}
          </p>
        )}

        {!isNew && task.CFORemarks && (
          <div>
            <p className={labelClass}>CFO's Remarks</p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              {task.CFORemarks}
            </p>
            {task.CFORemarksDate && (
              <p className="text-[11px] text-slate-500 mt-1">
                {task.CFORemarksByName ? `${task.CFORemarksByName}, ` : ""}{formatTaskDateTime(task.CFORemarksDate)}
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="task-user-remarks" className={labelClass}>User's Remarks</label>
          <textarea
            id="task-user-remarks"
            rows={3}
            maxLength={TASK_REMARKS_MAX}
            value={form.userRemarks}
            onChange={(e) => updateField("userRemarks", e.target.value)}
            disabled={!canEditUserRemarks || saving}
            className={inputClass(fieldErrors.userRemarks)}
          />
          {fieldErrors.userRemarks && <p className="text-red-600 text-xs mt-1 font-medium">{fieldErrors.userRemarks}</p>}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl text-white text-sm font-bold disabled:opacity-50 cursor-pointer bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? "Saving..." : isNew ? "Add Task" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
