import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Button } from "@mui/material";
import { toast } from "react-toastify";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import TableLoader from "../loaders/TableLoader";
import EmptyState from "../EmptyState/EmptyState";
import TablePagination from "../TablePagination/TablePagination";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import TaskFormDialog from "../TaskFormDialog/TaskFormDialog";
import { deleteTask, getTaskApiError, markTasksSeen, submitCFORemarks } from "../../services/taskService";
import { taskUnseenCountReceived } from "../../redux/slices/taskSlice";
import {
  TASK_PRIORITIES,
  TASK_REMARKS_MAX,
  TASK_SOURCES,
  TASK_STATUSES,
  formatTaskDate,
  formatTaskDateTime,
  getTaskPriorityClasses,
  getTaskStatusClasses,
} from "../../utils/taskStatus";

const PAGE_SIZE = 10;

const selectClass =
  "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500";

const filterLabelClass = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

const EMPTY_FILTERS = {
  department: "",
  employeeId: "",
  status: "",
  priority: "",
  dueFrom: "",
  dueTo: "",
  source: "",
};

/**
 * My Tasks / Team Tasks / All Tasks: filters, the task grid and the row
 * actions. Columns: Sr.No. | [Employee Name | Department] | Task Name |
 * Priority | Due Date | Status | CFO's Remarks | User's Remarks [| Actions].
 * Which controls show comes from each row's Can* flags (the backend checks
 * the same rules).
 *
 * Props:
 *   title, description
 *   loadTasks(params)      list API (getMyTasks / getTeamTasks / getAllTasks)
 *   loadFilterOptions()    optional: { employees, departments }
 *   filterKeys             any of department, employee, status, priority,
 *                          dueRange, source
 *   showEmployee           Employee Name and Department columns
 *   allowAdd               Add Task button
 *   cfoEditable            CFO's Remarks editable with Submit (rows with
 *                          CanEditCFORemarks)
 *   markSeenOnLoad         My Tasks: highlight unseen rows as New and mark
 *                          them seen
 */
export default function TaskListView({
  title,
  description,
  loadTasks,
  loadFilterOptions,
  filterKeys = [],
  showEmployee = false,
  allowAdd = false,
  cfoEditable = false,
  markSeenOnLoad = false,
  emptyTitle = "No tasks yet.",
}) {
  const dispatch = useDispatch();

  const [tasks, setTasks] = useState([]);
  const [options, setOptions] = useState({ employees: [], departments: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

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

  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageTasks = tasks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const hasFilters = Object.values(filters).some((value) => value !== "");
  const hasActions = useMemo(
    () => tasks.some((t) => t.CanEditDetails || t.CanEditStatus || t.CanEditUserRemarks || t.CanDelete),
    [tasks],
  );

  const columnCount = 8 + (showEmployee ? 2 : 0) + (hasActions ? 1 : 0);

  const changeFilter = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
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
      if (result?.mailWarning) toast.warning(result.mailWarning);
      else toast.success("CFO's Remarks saved and emailed to the employee.");
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
        <div className="space-y-1.5 min-w-[220px]">
          <textarea
            rows={2}
            maxLength={TASK_REMARKS_MAX}
            value={draft}
            onChange={(e) => setCfoDrafts((current) => ({ ...current, [task.TaskID]: e.target.value }))}
            disabled={saving}
            placeholder="Add a remark"
            aria-label={`CFO's Remarks for ${task.TaskName}`}
            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() => handleCfoSubmit(task)}
            disabled={saving || !changed || !draft.trim()}
            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
          >
            {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      );
    }

    if (!task.CFORemarks) return <span className="text-gray-400">—</span>;
    return (
      <div className="max-w-xs">
        <p className="whitespace-pre-wrap break-words">{task.CFORemarks}</p>
        {task.CFORemarksDate && (
          <p className="text-[11px] text-gray-400 mt-0.5">{formatTaskDateTime(task.CFORemarksDate)}</p>
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

  return (
    <div className="flex-1 bg-gray-50 min-h-screen overflow-y-auto p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
          {allowAdd && (
            <button
              type="button"
              onClick={() => setEditing("new")}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition flex items-center cursor-pointer"
            >
              + Add Task
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
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
                onClick={clearFilters}
                className="text-sm font-semibold text-gray-500 hover:text-gray-700 px-3 py-2 cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">{error}</div>
        )}

        {/* Task Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50/75">
                <tr>
                  {headings.map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={columnCount} className="p-0">
                      <TableLoader rows={5} columns={columnCount} showToolbar={false} paper={false} />
                    </td>
                  </tr>
                ) : pageTasks.length > 0 ? (
                  pageTasks.map((task, index) => {
                    const isNew = markSeenOnLoad && newTaskIds.has(task.TaskID);
                    const canEdit = task.CanEditDetails || task.CanEditStatus || task.CanEditUserRemarks;
                    return (
                      <tr
                        key={task.TaskID}
                        className={`align-top transition ${isNew ? "bg-indigo-50/60" : "hover:bg-gray-50/50"}`}
                      >
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                          {(currentPage - 1) * PAGE_SIZE + index + 1}
                        </td>
                        {showEmployee && (
                          <>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                              {task.EmployeeName}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                              {task.DepartmentName || "—"}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-4 text-sm text-gray-900 min-w-[200px] max-w-sm">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            {isNew && (
                              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-indigo-600 text-white">
                                New
                              </span>
                            )}
                            {task.IsAssignedByBusinessHead && (
                              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                Assigned by Business Head
                              </span>
                            )}
                          </div>
                          <p className="font-semibold whitespace-pre-wrap break-words">{task.TaskName}</p>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTaskPriorityClasses(task.Priority)}`}>
                            {task.Priority}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatTaskDate(task.DueDate)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTaskStatusClasses(task.Status)}`}>
                              {task.Status}
                            </span>
                            {task.IsOverdue && (
                              <span className="px-2 py-0.5 inline-flex text-[11px] leading-5 font-semibold rounded-full bg-red-50 text-red-700 border border-red-200">
                                Overdue
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">{renderCfoRemarks(task)}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {task.UserRemarks ? (
                            <p className="max-w-xs whitespace-pre-wrap break-words">{task.UserRemarks}</p>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        {hasActions && (
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            <div className="flex items-center gap-2">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => setEditing(task)}
                                  className="px-3 py-1 rounded-lg border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                                >
                                  Edit
                                </button>
                              )}
                              {task.CanDelete && (
                                <button
                                  type="button"
                                  onClick={() => setDeleting(task)}
                                  className="px-3 py-1 rounded-lg border border-red-200 font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
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
                    <td colSpan={columnCount} className="p-0">
                      {!hasFilters && !error ? (
                        <EmptyState
                          icon={<AssignmentTurnedInOutlinedIcon sx={{ fontSize: 40 }} />}
                          title={emptyTitle}
                          action={
                            allowAdd ? (
                              <Button size="small" onClick={() => setEditing("new")}>
                                Add Task
                              </Button>
                            ) : null
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={<SearchOffOutlinedIcon sx={{ fontSize: 40 }} />}
                          title="No tasks match the selected filters."
                          action={
                            hasFilters ? (
                              <Button size="small" onClick={clearFilters}>
                                Clear filters
                              </Button>
                            ) : null
                          }
                        />
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {!loading && (
            <TablePagination
              page={currentPage}
              pageSize={PAGE_SIZE}
              total={tasks.length}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

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
    </div>
  );
}
