import React, { useState } from "react";
import { toast } from "react-toastify";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import {
  assignTask,
  createTask,
  deleteTask,
  getTaskApiError,
  submitCFORemarks,
  updateTask,
} from "../../services/taskService";
import {
  TASK_NAME_MAX,
  TASK_PRIORITIES,
  TASK_REMARKS_MAX,
  TASK_STATUSES,
  getTodayKey,
} from "../../utils/taskStatus";
import { worksheetControlClass, worksheetLineAddClass } from "../../utils/goalWorksheet";

const EMPTY_DRAFT = {
  taskName: "",
  priority: "Medium",
  dueDate: "",
  status: "Pending",
  cfoRemarks: "",
  userRemarks: "",
};

const draftFromTask = (task) => ({
  taskName: task.TaskName || "",
  priority: task.Priority || "Medium",
  dueDate: task.DueDate || "",
  status: task.Status || "Pending",
  cfoRemarks: task.CFORemarks || "",
  userRemarks: task.UserRemarks || "",
});

const COLUMNS = ["Sr.No.", "Task Name", "Priority", "Due Date", "Status", "CFO's Remarks", "User's Remarks", ""];

// Same look as the Add Goal worksheet (components/GoalWorksheet): pale blue
// headings, grey-blue grid lines, navy focus border on the cell being edited.
const headClass =
  "sticky top-0 z-2 h-10.5 border-r border-b border-[#cbd4e2] bg-[#dce5f2] px-2.5 py-2 text-left text-[11px] font-bold leading-[1.35] text-[#30415f] align-middle whitespace-nowrap last:border-r-0";
const cellClass = "p-0 border-r border-b border-[#d5dce5] last:border-r-0 align-top";
const cellInputClass = `${worksheetControlClass} disabled:text-slate-500`;
const readOnlyClass = "px-2.5 py-3 text-xs text-[#202522]";

const taskKey = (task) => `task-${task.TaskID}`;

let newRowCounter = 0;
const nextNewRowKey = (employeeId) => `new-${employeeId}-${(newRowCounter += 1)}`;

// Backend validation messages as one line.
const apiErrorText = (err, fallback) => {
  const apiError = getTaskApiError(err, fallback);
  return [apiError.message, ...apiError.details].join(" ");
};

const trimmed = (value) => String(value ?? "").trim();

/**
 * Task sheet: tasks as spreadsheet rows with blank row(s) below for new
 * tasks, and a Submit button per row. Cells are editable only where the
 * row's Can* flags allow it (the backend checks the same rules).
 *
 * mode "assign" (Business Head, one or more employees):
 *   blank row    - assigns the task (email: "New task assigned to you");
 *                  CFO's Remarks editable, Status starts as Pending
 *   existing row - CFO's Remarks (email: "Business Head added a remark")
 *                  and, on tasks they assigned, Task Name / Priority / Due Date
 * mode "own" (My Tasks):
 *   blank row    - adds a self-added task; Status and User's Remarks editable
 *   existing row - own task: everything except CFO's Remarks; task assigned
 *                  by the Business Head: Status and User's Remarks only
 * Delete shows on rows with CanDelete. If an email fails the change stays
 * and a warning is shown.
 *
 * Props:
 *   groups          [{ employee: { UserID, FullName, EmployeeCode,
 *                   DepartmentName }, tasks, canAdd }]
 *   mode            "assign" | "own"
 *   blankRows       blank rows per group that can add (default 1)
 *   showGroupHeaders  a name row above each employee's tasks
 *   newTaskIds      Set of TaskIDs to highlight as New
 *   onSaved(employeeId)  reload that employee's tasks after a change
 */
export default function TaskSheet({
  groups,
  mode = "assign",
  blankRows = 1,
  showGroupHeaders = true,
  newTaskIds = null,
  onSaved,
}) {
  const isAssignMode = mode === "assign";

  const [drafts, setDrafts] = useState({}); // rowKey -> draft (edited rows only)
  const [extraRows, setExtraRows] = useState({}); // employeeId -> [rowKey] added with "+ Add row"
  const [baseRowSeed, setBaseRowSeed] = useState({}); // employeeId -> n, to renew used blank rows
  const [rowErrors, setRowErrors] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const today = getTodayKey();

  const draftOf = (key, task) => drafts[key] || (task ? draftFromTask(task) : EMPTY_DRAFT);

  const isDirty = (key, task) => {
    const draft = drafts[key];
    if (!draft) return false;
    const base = task ? draftFromTask(task) : EMPTY_DRAFT;
    return Object.keys(base).some((field) => trimmed(draft[field]) !== trimmed(base[field]));
  };

  const updateCell = (key, task, field, value) => {
    setDrafts((current) => ({ ...current, [key]: { ...draftOf(key, task), [field]: value } }));
    setRowErrors((current) => ({ ...current, [key]: undefined }));
  };

  const clearRow = (key) => {
    setDrafts((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setRowErrors((current) => ({ ...current, [key]: undefined }));
  };

  const setRowError = (key, message) => setRowErrors((current) => ({ ...current, [key]: message }));

  // The fixed blank rows of an employee (keys renew after each add so the
  // submitted row clears), plus rows added with "+ Add row".
  const newRowKeysFor = (employeeId) => {
    const seed = baseRowSeed[employeeId] || 0;
    const base = Array.from({ length: blankRows }, (_, i) => `new-${employeeId}-base-${seed}-${i}`);
    return [...base, ...(extraRows[employeeId] || [])];
  };

  // Which cells of a row can be edited.
  const editableCells = (task) => {
    if (!task) {
      return { details: true, status: !isAssignMode, cfoRemarks: isAssignMode, userRemarks: !isAssignMode };
    }
    return {
      details: Boolean(task.CanEditDetails),
      status: Boolean(task.CanEditStatus),
      cfoRemarks: Boolean(task.CanEditCFORemarks),
      userRemarks: Boolean(task.CanEditUserRemarks),
    };
  };

  const validate = (draft, { checkDetails, dueMustBeFuture }) => {
    if (checkDetails) {
      const name = draft.taskName.trim();
      if (!name) return "Task Name is required.";
      if (name.length > TASK_NAME_MAX) return `Task Name cannot exceed ${TASK_NAME_MAX} characters.`;
      if (!draft.dueDate) return "Due Date is required.";
      if (dueMustBeFuture && draft.dueDate < today) return "Due Date must be today or later.";
    }
    if (draft.cfoRemarks.trim().length > TASK_REMARKS_MAX) return `CFO's Remarks cannot exceed ${TASK_REMARKS_MAX} characters.`;
    if (draft.userRemarks.trim().length > TASK_REMARKS_MAX) return `User's Remarks cannot exceed ${TASK_REMARKS_MAX} characters.`;
    return "";
  };

  const submitNewRow = async (key, employee) => {
    const draft = draftOf(key, null);
    const message = validate(draft, { checkDetails: true, dueMustBeFuture: isAssignMode });
    if (message) {
      setRowError(key, message);
      return;
    }

    try {
      setSavingKey(key);
      if (isAssignMode) {
        const result = await assignTask({
          employeeId: employee.UserID,
          taskName: draft.taskName.trim(),
          priority: draft.priority,
          dueDate: draft.dueDate,
          cfoRemarks: draft.cfoRemarks.trim(),
        });
        if (result?.mailWarning) toast.warning(`Task assigned. ${result.mailWarning}`);
        else toast.success(`Task assigned and emailed to ${employee.FullName || "the employee"}.`);
      } else {
        await createTask({
          taskName: draft.taskName.trim(),
          priority: draft.priority,
          dueDate: draft.dueDate,
          status: draft.status,
          userRemarks: draft.userRemarks.trim(),
        });
        toast.success("Task added.");
      }

      clearRow(key);
      if ((extraRows[employee.UserID] || []).includes(key)) {
        setExtraRows((current) => ({
          ...current,
          [employee.UserID]: current[employee.UserID].filter((rowKey) => rowKey !== key),
        }));
      } else {
        setBaseRowSeed((current) => ({ ...current, [employee.UserID]: (current[employee.UserID] || 0) + 1 }));
      }
      await onSaved?.(employee.UserID);
    } catch (err) {
      setRowError(key, apiErrorText(err, isAssignMode ? "Failed to assign the task." : "Failed to add the task."));
    } finally {
      setSavingKey(null);
    }
  };

  const submitTaskRow = async (task) => {
    const key = taskKey(task);
    const draft = draftOf(key, task);
    const base = draftFromTask(task);
    const editable = editableCells(task);

    const changes = {};
    if (editable.details) {
      if (trimmed(draft.taskName) !== trimmed(base.taskName)) changes.taskName = draft.taskName.trim();
      if (draft.priority !== base.priority) changes.priority = draft.priority;
      if (draft.dueDate !== base.dueDate) changes.dueDate = draft.dueDate;
    }
    if (editable.status && draft.status !== base.status) changes.status = draft.status;
    if (editable.userRemarks && trimmed(draft.userRemarks) !== trimmed(base.userRemarks)) {
      changes.userRemarks = draft.userRemarks.trim();
    }
    const remarks = draft.cfoRemarks.trim();
    const remarksChanged = editable.cfoRemarks && remarks !== trimmed(base.cfoRemarks);

    const detailsChanged = ["taskName", "priority", "dueDate"].some((field) => field in changes);
    const message =
      validate(draft, {
        checkDetails: detailsChanged,
        // Assigned tasks: a new Due Date must be today or later.
        dueMustBeFuture: Boolean(changes.dueDate) && task.IsAssignedByBusinessHead,
      }) || (remarksChanged && !remarks ? "CFO's Remarks cannot be cleared; enter a remark." : "");
    if (message) {
      setRowError(key, message);
      return;
    }

    try {
      setSavingKey(key);
      if (Object.keys(changes).length > 0) {
        await updateTask(task.TaskID, changes);
      }
      if (remarksChanged) {
        const result = await submitCFORemarks(task.TaskID, remarks);
        if (result?.mailWarning) toast.warning(`Remark saved. ${result.mailWarning}`);
        else toast.success(`Remark saved and emailed to ${task.EmployeeName || "the employee"}.`);
      } else {
        toast.success("Task updated.");
      }
      clearRow(key);
    } catch (err) {
      setRowError(key, apiErrorText(err, "Failed to save the task."));
    } finally {
      setSavingKey(null);
      await onSaved?.(task.UserID);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleteBusy(true);
      await deleteTask(deleting.TaskID);
      toast.success("Task deleted.");
      clearRow(taskKey(deleting));
      const ownerId = deleting.UserID;
      setDeleting(null);
      await onSaved?.(ownerId);
    } catch (err) {
      toast.error(getTaskApiError(err, "Failed to delete the task.").message);
    } finally {
      setDeleteBusy(false);
    }
  };

  // Enter in a single-line cell submits the row.
  const submitOnEnter = (submit) => (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  };

  const renderRow = ({ key, task, employee, serial }) => {
    const draft = draftOf(key, task);
    const isNewRow = !task;
    const editable = editableCells(task);
    const canSubmit = editable.details || editable.status || editable.cfoRemarks || editable.userRemarks;
    const dirty = isDirty(key, task);
    const saving = savingKey === key;
    const submit = () => (isNewRow ? submitNewRow(key, employee) : submitTaskRow(task));
    const rowError = rowErrors[key];
    const isNew = Boolean(task && newTaskIds?.has(task.TaskID));
    const dueMin =
      (isNewRow && isAssignMode) || (task?.IsAssignedByBusinessHead && draft.dueDate !== task.DueDate) ? today : undefined;

    const rowBackground = isNew ? "bg-blue-50" : "bg-white";

    return (
      <React.Fragment key={key}>
        <tr className={rowBackground}>
          <td className={`${cellClass} w-14 bg-[#edf1f7] pt-3 text-center text-xs font-medium text-slate-600`}>
            {isNewRow ? <span className="text-slate-300">+</span> : serial}
          </td>

          <td className={`${cellClass} min-w-[240px]`}>
            {task && (isNew || task.IsAssignedByBusinessHead) && (
              <div className="flex flex-wrap gap-1 px-2 pt-1.5">
                {isNew && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#2c3e82] text-white">New</span>
                )}
                {task.IsAssignedByBusinessHead && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold border border-blue-200 bg-blue-50 text-[#2c3e82]">
                    Assigned by Business Head
                  </span>
                )}
              </div>
            )}
            {editable.details ? (
              <input
                type="text"
                value={draft.taskName}
                maxLength={TASK_NAME_MAX}
                onChange={(e) => updateCell(key, task, "taskName", e.target.value)}
                onKeyDown={submitOnEnter(submit)}
                disabled={saving}
                placeholder={isNewRow ? (isAssignMode ? `New task for ${employee.FullName}...` : "Type a new task...") : ""}
                aria-label={isNewRow ? "New task name" : `Task name, row ${serial}`}
                className={cellInputClass}
              />
            ) : (
              <div className={readOnlyClass}>{task.TaskName}</div>
            )}
          </td>

          <td className={`${cellClass} w-32`}>
            {editable.details ? (
              <select
                value={draft.priority}
                onChange={(e) => updateCell(key, task, "priority", e.target.value)}
                disabled={saving}
                aria-label="Priority"
                className={`${cellInputClass} text-center cursor-pointer`}
              >
                {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <div className={`${readOnlyClass} text-center`}>{task.Priority}</div>
            )}
          </td>

          <td className={`${cellClass} w-40`}>
            {editable.details ? (
              <input
                type="date"
                value={draft.dueDate}
                min={dueMin}
                onChange={(e) => updateCell(key, task, "dueDate", e.target.value)}
                onKeyDown={submitOnEnter(submit)}
                disabled={saving}
                aria-label="Due date"
                className={`${cellInputClass} text-center`}
              />
            ) : (
              <div className={`${readOnlyClass} text-center`}>
                {task.DueDate ? task.DueDate.split("-").reverse().join("-") : ""}
              </div>
            )}
          </td>

          <td className={`${cellClass} w-40`}>
            <div className="flex items-center gap-1.5">
              {editable.status ? (
                <select
                  value={draft.status}
                  onChange={(e) => updateCell(key, task, "status", e.target.value)}
                  disabled={saving}
                  aria-label="Status"
                  className={`${cellInputClass} cursor-pointer`}
                >
                  {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <span className={`${readOnlyClass} ${isNewRow ? "text-slate-400" : ""}`}>
                  {isNewRow ? "Pending" : task.Status}
                </span>
              )}
              {task?.IsOverdue && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-50 text-[#b3403f] border border-red-200 mr-1 shrink-0">
                  Overdue
                </span>
              )}
            </div>
          </td>

          <td className={`${cellClass} min-w-[220px]`}>
            {editable.cfoRemarks ? (
              <textarea
                rows={1}
                value={draft.cfoRemarks}
                maxLength={TASK_REMARKS_MAX}
                onChange={(e) => updateCell(key, task, "cfoRemarks", e.target.value)}
                disabled={saving}
                aria-label="CFO's Remarks"
                className={`${cellInputClass} resize-y`}
              />
            ) : (
              <div className={`${readOnlyClass} whitespace-pre-wrap break-words`}>{task?.CFORemarks || ""}</div>
            )}
          </td>

          <td className={`${cellClass} min-w-[220px]`}>
            {editable.userRemarks ? (
              <textarea
                rows={1}
                value={draft.userRemarks}
                maxLength={TASK_REMARKS_MAX}
                onChange={(e) => updateCell(key, task, "userRemarks", e.target.value)}
                disabled={saving}
                aria-label="User's Remarks"
                className={`${cellInputClass} resize-y`}
              />
            ) : (
              <div className={`${readOnlyClass} whitespace-pre-wrap break-words`}>{task?.UserRemarks || ""}</div>
            )}
          </td>

          <td className={`${cellClass} w-28 text-center`}>
            <div className="flex flex-col items-center gap-1.5 px-2 py-2">
              {canSubmit && (
                <button
                  type="button"
                  onClick={submit}
                  disabled={saving || !dirty}
                  className="w-full cursor-pointer bg-[#2c3e82] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1f2c61] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {saving ? "Saving..." : "Submit"}
                </button>
              )}
              {task?.CanDelete && (
                <button
                  type="button"
                  onClick={() => setDeleting(task)}
                  disabled={saving}
                  className="text-[11px] font-semibold text-[#b3403f] hover:underline disabled:opacity-40 cursor-pointer"
                >
                  Delete
                </button>
              )}
            </div>
          </td>
        </tr>
        {rowError && (
          <tr className="bg-red-50">
            <td colSpan={COLUMNS.length} className="border-b border-[#d5dce5] px-4 py-1.5 text-[11px] font-medium text-[#b3403f]">{rowError}</td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
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
          {groups.map(({ employee, tasks, canAdd }) => {
            const newKeys = canAdd ? newRowKeysFor(employee.UserID) : [];
            const openCount = tasks.filter((t) => t.Status !== "Done").length;
            const overdueCount = tasks.filter((t) => t.IsOverdue).length;
            const addRow = () =>
              setExtraRows((current) => ({
                ...current,
                [employee.UserID]: [...(current[employee.UserID] || []), nextNewRowKey(employee.UserID)],
              }));

            return (
              <React.Fragment key={employee.UserID}>
                {showGroupHeaders && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="border-b border-[#cbd4e2] bg-[#e5eaf3] px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[#30415f]">
                          {employee.FullName}
                          <span className="font-normal text-slate-600">
                            {[employee.EmployeeCode, employee.DepartmentName].filter(Boolean).map((v) => ` · ${v}`).join("")}
                          </span>
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span>{openCount} open</span>
                          {overdueCount > 0 && <span className="font-semibold text-[#b3403f]">{overdueCount} overdue</span>}
                          {canAdd && (
                            <button type="button" onClick={addRow} className={worksheetLineAddClass}>
                              + Add row
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {tasks.map((task, index) =>
                  renderRow({ key: taskKey(task), task, employee, serial: index + 1 }),
                )}
                {newKeys.map((key) =>
                  renderRow({ key, task: null, employee, serial: null }),
                )}
                {!showGroupHeaders && canAdd && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="px-3 py-2 border-b border-[#d5dce5] bg-white">
                      <button type="button" onClick={addRow} className={worksheetLineAddClass}>
                        + Add row
                      </button>
                    </td>
                  </tr>
                )}
                {tasks.length === 0 && newKeys.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="border-b border-[#d5dce5] px-4 py-2 text-xs text-slate-400">No tasks.</td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {deleting && (
        <ConfirmDialog
          title="Delete task?"
          message={`"${deleting.TaskName}" will be removed from every task list.`}
          confirmLabel="Delete"
          busyLabel="Deleting..."
          tone="danger"
          busy={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
