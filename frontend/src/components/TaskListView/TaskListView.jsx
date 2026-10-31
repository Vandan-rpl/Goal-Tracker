import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import TaskFormDialog from "../TaskFormDialog/TaskFormDialog";
import TaskWorkbookFrame, {
  taskFilterControlClass as selectClass,
  taskFilterLabelClass as filterLabelClass,
  taskSecondaryButtonClass,
} from "../TaskWorkbookFrame/TaskWorkbookFrame";
import { deleteTask, getTaskApiError, markTasksSeen, submitCFORemarks } from "../../services/taskService";
import { taskUnseenCountReceived } from "../../redux/slices/taskSlice";
import { worksheetControlClass } from "../../utils/goalWorksheet";
import {
  TASK_PRIORITIES,
  TASK_REMARKS_MAX,
  TASK_SOURCES,
  TASK_STATUSES,
  formatTaskDate,
  formatTaskDateTime,
} from "../../utils/taskStatus";

const PAGE_SIZE = 20;

const EMPTY_FILTERS = {
  department: "",
  employeeId: "",
  status: "",
  priority: "",
  dueFrom: "",
  dueTo: "",
  source: "",
};

// Same look as the Add Goal worksheet and TaskSheet.
const headClass =
  "sticky top-0 z-2 border-r border-b border-[#cbd4e2] bg-[#dce5f2] px-2.5 py-2.5 text-left text-[11px] font-bold leading-[1.35] text-[#30415f] align-middle whitespace-nowrap last:border-r-0";
const cellClass = "border-r border-b border-[#d5dce5] px-2.5 py-2.5 align-top text-xs text-[#202522] last:border-r-0";

// Square labels in the workbook palette.
const STATUS_LABEL_CLASSES = {
  Pending: "border-slate-300 bg-slate-50 text-slate-700",
  "In Progress": "border-blue-200 bg-blue-50 text-[#2c3e82]",
  Done: "border-green-200 bg-green-50 text-green-800",
};

const PRIORITY_LABEL_CLASSES = {
  High: "border-red-200 bg-red-50 text-[#b3403f]",
  Medium: "border-amber-200 bg-amber-50 text-amber-900",
  Low: "border-slate-200 bg-white text-slate-600",
};

const labelClass = "inline-flex border px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap";

/**
 * Team Tasks / All Tasks: workbook frame with summary counts, filters, the
 * task grid and row actions. Columns: Sr.No. | [Employee Name | Department]
 * | Task Name | Priority | Due Date | Status | CFO's Remarks | User's Remarks
 * [| Actions]. Which controls show comes from each row's Can* flags (the
 * backend checks the same rules).
 *
 * Props:
 *   title, description, badge, barSubtitle
 *   loadTasks(params)      list API (getTeamTasks / getAllTasks / getMyTasks)
 *   loadFilterOptions()    optional: { employees, departments }
 *   filterKeys             any of department, employee, status, priority,
 *                          dueRange, source
 *   showEmployee           Employee Name and Department columns
 *   allowAdd               Add Task button
 *   cfoEditable            CFO's Remarks editable with Submit (rows with
 *                          CanEditCFORemarks)
 *   markSeenOnLoad         highlight unseen rows as New and mark them seen
 *   initialFilters         filter values to start with (e.g. { employeeId })
 *   headerActions          extra controls on the right of the title
 *   footer                 note under the grid
 */
export default function TaskListView({
  title,
  description,
  badge,
  barSubtitle,
  loadTasks,
  loadFilterOptions,
  filterKeys = [],
  showEmployee = false,
  allowAdd = false,
  cfoEditable = false,
  markSeenOnLoad = false,
  emptyTitle = "No tasks yet.",
  initialFilters = null,
  headerActions = null,
  footer = null,
}) {
  const dispatch = useDispatch();

  const [tasks, setTasks] = useState([]);
  const [options, setOptions] = useState({ employees: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, ...initialFilters }));
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // Client-side only: text search and the Overdue box.
  const [search, setSearch] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Rows that were unseen when the list loaded; they stay highlighted as
  // New on this visit even after being marked seen.
  const [newTaskIds, setNewTaskIds] = useState(() => new Set());

  const [editing, setEditing] = useState(null); // task, or "new"
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [cfoDrafts, setCfoDrafts] = useState({});
  const [cfoSavingId, setCfoSavingId] = useState(null);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    if (!loadFilterOptions) return undefined;
    let ignore = false;
    loadFilterOptions()
      .then((result) => {
        if (!ignore) setOptions({ employees: result?.employees || [], departments: result?.departments || [] });
      })
      .catch(() => {
        // The grid still works without the dropdown options.
      });
    return () => {
      ignore = true;
    };
  }, [loadFilterOptions]);

  useEffect(() => {
    let ignore = false;

    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));

    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const list = (await loadTasks(params)) || [];
        if (ignore) return;
        setTasks(list);
        setCfoDrafts({});

        if (markSeenOnLoad) {
          const unseenIds = list.filter((task) => !task.IsSeenByUser).map((task) => task.TaskID);
          if (unseenIds.length > 0) {
            setNewTaskIds((current) => new Set([...current, ...unseenIds]));
            markTasksSeen(unseenIds)
              .then((result) => dispatch(taskUnseenCountReceived(result?.unseenCount)))
              .catch(() => {
                // Stays unseen; it is marked on the next visit.
              });
          }
        }
      } catch (err) {
        if (!ignore) setError(getTaskApiError(err, "Failed to load tasks.").message);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, [loadTasks, filters, reloadKey, markSeenOnLoad, dispatch]);

  // Counts for the summary strip, over what the server returned.
  const summary = useMemo(
    () => ({
      total: tasks.length,
      pending: tasks.filter((t) => t.Status === "Pending").length,
      inProgress: tasks.filter((t) => t.Status === "In Progress").length,
      done: tasks.filter((t) => t.Status === "Done").length,
      overdue: tasks.filter((t) => t.IsOverdue).length,
      assigned: tasks.filter((t) => t.IsAssignedByBusinessHead).length,
      employees: new Set(tasks.map((t) => t.UserID)).size,
    }),
    [tasks],
  );

  const visibleTasks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (overdueOnly && !task.IsOverdue) return false;
      if (!term) return true;
      return (
        (task.TaskName || "").toLowerCase().includes(term) ||
        (task.EmployeeName || "").toLowerCase().includes(term) ||
        (task.EmployeeCode || "").toLowerCase().includes(term)
      );
    });
  }, [tasks, search, overdueOnly]);

  const totalPages = Math.max(1, Math.ceil(visibleTasks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageTasks = visibleTasks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasFilters = Object.values(filters).some((value) => value !== "") || Boolean(search) || overdueOnly;
  const hasActions = useMemo(
    () => tasks.some((t) => t.CanEditDetails || t.CanEditStatus || t.CanEditUserRemarks || t.CanDelete),
    [tasks],
  );

  const changeFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearch("");
    setOverdueOnly(false);
    setPage(1);
  };

  const handleSaved = (message) => {
    setEditing(null);
    toast.success(message);
    reload();
  };

  const handleDelete = async () => {
    try {
      setDeleteBusy(true);
      await deleteTask(deleting.TaskID);
      toast.success("Task deleted.");
      setDeleting(null);
      reload();
    } catch (err) {
      toast.error(getTaskApiError(err, "Failed to delete the task.").message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const cfoDraftOf = (task) => cfoDrafts[task.TaskID] ?? task.CFORemarks ?? "";

  const handleCfoSubmit = async (task) => {
    const remarks = cfoDraftOf(task).trim();
    try {
      setCfoSavingId(task.TaskID);
      const result = await submitCFORemarks(task.TaskID, remarks);
      if (result?.mailWarning) toast.warning(`Remark saved. ${result.mailWarning}`);
      else toast.success(`Remark saved and emailed to ${task.EmployeeName || "the employee"}.`);
      reload();
    } catch (err) {
      const apiError = getTaskApiError(err, "Failed to save CFO's Remarks.");
      toast.error([apiError.message, ...apiError.details].join(" "));
    } finally {
      setCfoSavingId(null);
    }
  };

  const renderCfoRemarks = (task) => {
    if (cfoEditable && task.CanEditCFORemarks) {
      const draft = cfoDraftOf(task);
      const changed = draft.trim() !== (task.CFORemarks || "").trim();
      const saving = cfoSavingId === task.TaskID;
      return (
        <div className="min-w-[230px]">
          <textarea
            rows={2}
            maxLength={TASK_REMARKS_MAX}
            value={draft}
            onChange={(e) => setCfoDrafts((current) => ({ ...current, [task.TaskID]: e.target.value }))}
            disabled={saving}
            placeholder="Add a remark..."
            aria-label={`CFO's Remarks for ${task.TaskName}`}
            className={`${worksheetControlClass} min-h-[52px] resize-y border-[#d5dce5] bg-white`}
          />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-[10px] text-slate-500">
              {task.CFORemarksDate ? `Last: ${formatTaskDateTime(task.CFORemarksDate)}` : ""}
            </span>
            <button
              type="button"
              onClick={() => handleCfoSubmit(task)}
              disabled={saving || !changed || !draft.trim()}
              className="cursor-pointer bg-[#2c3e82] px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#1f2c61] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {saving ? "Sending..." : "Submit"}
            </button>
          </div>
        </div>
      );
    }

    if (!task.CFORemarks) return <span className="text-slate-400">—</span>;
    return (
      <div className="max-w-xs">
        <p className="whitespace-pre-wrap break-words">{task.CFORemarks}</p>
        {task.CFORemarksDate && (
          <p className="mt-0.5 text-[10px] text-slate-500">{formatTaskDateTime(task.CFORemarksDate)}</p>
        )}
      </div>
    );
  };

  const headings = [
    "Sr.No.",
    ...(showEmployee ? ["Employee Name", "Department"] : []),
    "Task Name",
    "Priority",
    "Due Date",
    "Status",
    "CFO's Remarks",
    "User's Remarks",
    ...(hasActions ? ["Actions"] : []),
  ];

  const employeeOptions = options.employees || [];

  const summaryBoxes = [
    showEmployee && { label: "Employees", value: summary.employees },
    { label: "Tasks", value: summary.total },
    { label: "Pending", value: summary.pending },
    { label: "In Progress", value: summary.inProgress },
    { label: "Done", value: summary.done },
    { label: "Assigned by BH", value: summary.assigned },
  ].filter(Boolean);

  const filterControls = (
    <>
      <div>
        <label htmlFor="task-filter-search" className={filterLabelClass}>Search</label>
        <input
          id="task-filter-search"
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={showEmployee ? "Task, employee or code" : "Task name"}
          className={selectClass}
        />
      </div>

      {filterKeys.includes("department") && (
        <div>
          <label htmlFor="task-filter-department" className={filterLabelClass}>Department</label>
          <select
            id="task-filter-department"
            value={filters.department}
            onChange={(e) => changeFilter("department", e.target.value)}
            className={selectClass}
          >
            <option value="">All Departments</option>
            {(options.departments || []).map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {filterKeys.includes("employee") && (
        <div>
          <label htmlFor="task-filter-employee" className={filterLabelClass}>Employee</label>
          <select
            id="task-filter-employee"
            value={filters.employeeId}
            onChange={(e) => changeFilter("employeeId", e.target.value)}
            className={selectClass}
          >
            <option value="">All Employees</option>
            {employeeOptions
              .filter((emp) => !filters.department || emp.DepartmentName === filters.department)
              .map((emp) => (
                <option key={emp.UserID} value={emp.UserID}>
                  {emp.FullName}{emp.DepartmentName ? ` – ${emp.DepartmentName}` : ""}
                </option>
              ))}
          </select>
        </div>
      )}

      {filterKeys.includes("status") && (
        <div>
          <label htmlFor="task-filter-status" className={filterLabelClass}>Status</label>
          <select
            id="task-filter-status"
            value={filters.status}
            onChange={(e) => changeFilter("status", e.target.value)}
            className={selectClass}
          >
            <option value="">Open + Done (last 30 days)</option>
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {filterKeys.includes("priority") && (
        <div>
          <label htmlFor="task-filter-priority" className={filterLabelClass}>Priority</label>
          <select
            id="task-filter-priority"
            value={filters.priority}
            onChange={(e) => changeFilter("priority", e.target.value)}
            className={selectClass}
          >
            <option value="">All Priorities</option>
            {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      )}

      {filterKeys.includes("dueRange") && (
        <>
          <div>
            <label htmlFor="task-filter-due-from" className={filterLabelClass}>Due Date From</label>
            <input
              id="task-filter-due-from"
              type="date"
              value={filters.dueFrom}
              max={filters.dueTo || undefined}
              onChange={(e) => changeFilter("dueFrom", e.target.value)}
              className={selectClass}
            />
          </div>
          <div>
            <label htmlFor="task-filter-due-to" className={filterLabelClass}>Due Date To</label>
            <input
              id="task-filter-due-to"
              type="date"
              value={filters.dueTo}
              min={filters.dueFrom || undefined}
              onChange={(e) => changeFilter("dueTo", e.target.value)}
              className={selectClass}
            />
          </div>
        </>
      )}

      {filterKeys.includes("source") && (
        <div>
          <label htmlFor="task-filter-source" className={filterLabelClass}>Source</label>
          <select
            id="task-filter-source"
            value={filters.source}
            onChange={(e) => changeFilter("source", e.target.value)}
            className={selectClass}
          >
            <option value="">Self-added and Assigned</option>
            {TASK_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      )}

      {hasFilters && (
        <div className="flex items-end">
          <button
            type="button"
            onClick={clearFilters}
            className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-600 hover:text-[#2c3e82]"
          >
            Clear filters
          </button>
        </div>
      )}
    </>
  );

  const pagerButtonClass =
    "cursor-pointer border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#2c3e82] transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <TaskWorkbookFrame
      barSubtitle={barSubtitle}
      badge={badge}
      title={title}
      description={description}
      actions={
        (headerActions || allowAdd) && (
          <>
            {headerActions}
            {allowAdd && (
              <button type="button" onClick={() => setEditing("new")} className={taskSecondaryButtonClass}>
                + Add Task
              </button>
            )}
          </>
        )
      }
      filters={filterControls}
      footer={footer}
    >
      {/* Summary strip */}
      <div className="mb-5 flex flex-wrap items-stretch border border-[#cbd4e2] bg-white">
        {summaryBoxes.map((box) => (
          <div key={box.label} className="min-w-[110px] flex-1 border-r border-[#d5dce5] px-4 py-3 last:border-r-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#30415f]">{box.label}</p>
            <p className="mt-1 text-2xl font-bold text-[#2c3e82]">{loading ? "–" : box.value}</p>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            setOverdueOnly((value) => !value);
            setPage(1);
          }}
          aria-pressed={overdueOnly}
          title={overdueOnly ? "Show all tasks" : "Show only overdue tasks"}
          className={`min-w-[110px] flex-1 cursor-pointer px-4 py-3 text-left transition ${
            overdueOnly ? "bg-[#b3403f] text-white" : "bg-red-50 hover:bg-red-100"
          }`}
        >
          <p className={`text-[11px] font-bold uppercase tracking-wider ${overdueOnly ? "text-white" : "text-[#b3403f]"}`}>
            Overdue {overdueOnly ? "· showing" : ""}
          </p>
          <p className={`mt-1 text-2xl font-bold ${overdueOnly ? "text-white" : "text-[#b3403f]"}`}>
            {loading ? "–" : summary.overdue}
          </p>
        </button>
      </div>

      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      )}

      {/* Task Grid */}
      <div className="max-w-full overflow-x-auto border border-[#aeb9cc] bg-white [scrollbar-color:#aeb9cc_#edf1f7] scrollbar-thin">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {headings.map((heading, i) => (
                <th key={heading} className={`${headClass} ${i === 0 ? "bg-[#e5eaf3] text-center" : ""}`}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={headings.length} className="px-4 py-10 text-center text-sm text-slate-500">
                  Loading tasks...
                </td>
              </tr>
            ) : pageTasks.length > 0 ? (
              pageTasks.map((task, index) => {
                const isNew = markSeenOnLoad && newTaskIds.has(task.TaskID);
                const canEdit = task.CanEditDetails || task.CanEditStatus || task.CanEditUserRemarks;
                return (
                  <tr key={task.TaskID} className={`${isNew ? "bg-blue-50" : "bg-white"} hover:bg-[#f4f6fa]`}>
                    <td className={`${cellClass} w-14 bg-[#edf1f7] text-center font-medium text-slate-600`}>
                      {(currentPage - 1) * PAGE_SIZE + index + 1}
                    </td>
                    {showEmployee && (
                      <>
                        <td className={`${cellClass} whitespace-nowrap`}>
                          <p className="font-semibold text-slate-900">{task.EmployeeName}</p>
                          {task.EmployeeCode && <p className="text-[10px] text-slate-500">{task.EmployeeCode}</p>}
                        </td>
                        <td className={`${cellClass} whitespace-nowrap text-slate-600`}>{task.DepartmentName || "—"}</td>
                      </>
                    )}
                    <td className={`${cellClass} min-w-[220px] max-w-sm`}>
                      {(isNew || task.IsAssignedByBusinessHead) && (
                        <div className="mb-1 flex flex-wrap gap-1">
                          {isNew && <span className="bg-[#2c3e82] px-1.5 py-0.5 text-[10px] font-bold text-white">New</span>}
                          {task.IsAssignedByBusinessHead && (
                            <span className={`${labelClass} border-blue-200 bg-blue-50 text-[#2c3e82]`}>
                              Assigned by Business Head
                            </span>
                          )}
                        </div>
                      )}
                      <p className="font-semibold whitespace-pre-wrap break-words">{task.TaskName}</p>
                    </td>
                    <td className={cellClass}>
                      <span className={`${labelClass} ${PRIORITY_LABEL_CLASSES[task.Priority] || PRIORITY_LABEL_CLASSES.Low}`}>
                        {task.Priority}
                      </span>
                    </td>
                    <td className={`${cellClass} whitespace-nowrap ${task.IsOverdue ? "font-semibold text-[#b3403f]" : ""}`}>
                      {formatTaskDate(task.DueDate)}
                    </td>
                    <td className={`${cellClass} whitespace-nowrap`}>
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`${labelClass} ${STATUS_LABEL_CLASSES[task.Status] || STATUS_LABEL_CLASSES.Pending}`}>
                          {task.Status}
                        </span>
                        {task.IsOverdue && (
                          <span className={`${labelClass} border-red-200 bg-red-50 text-[#b3403f]`}>Overdue</span>
                        )}
                      </div>
                    </td>
                    <td className={cellClass}>{renderCfoRemarks(task)}</td>
                    <td className={`${cellClass} min-w-[180px]`}>
                      {task.UserRemarks ? (
                        <p className="max-w-xs whitespace-pre-wrap break-words">{task.UserRemarks}</p>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {hasActions && (
                      <td className={`${cellClass} whitespace-nowrap`}>
                        <div className="flex flex-col items-start gap-1.5">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setEditing(task)}
                              className="cursor-pointer text-[11px] font-semibold text-[#2c3e82] hover:underline"
                            >
                              Edit
                            </button>
                          )}
                          {task.CanDelete && (
                            <button
                              type="button"
                              onClick={() => setDeleting(task)}
                              className="cursor-pointer text-[11px] font-semibold text-[#b3403f] hover:underline"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={headings.length} className="px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    {hasFilters ? "No tasks match the selected filters." : emptyTitle}
                  </p>
                  {hasFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-2 cursor-pointer text-xs font-semibold text-[#2c3e82] hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && visibleTasks.length > PAGE_SIZE && (
        <div className="mt-3 flex flex-col items-center justify-between gap-3 text-xs text-slate-600 sm:flex-row">
          <span>
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, visibleTasks.length)} of{" "}
            {visibleTasks.length}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} className={pagerButtonClass}>
              Previous
            </button>
            <span className="px-2">Page {currentPage} of {totalPages}</span>
            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={pagerButtonClass}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {editing && (
        <TaskFormDialog
          task={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}

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
    </TaskWorkbookFrame>
  );
}
