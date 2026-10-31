import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import TaskSheet from "../../components/TaskSheet/TaskSheet";
import TaskWorkbookFrame, {
  taskFilterControlClass as selectClass,
  taskFilterLabelClass as filterLabelClass,
} from "../../components/TaskWorkbookFrame/TaskWorkbookFrame";
import { getMyTasks, getTaskApiError, markTasksSeen } from "../../services/taskService";
import { taskUnseenCountReceived } from "../../redux/slices/taskSlice";
import { TASK_PRIORITIES, TASK_SOURCES, TASK_STATUSES } from "../../utils/taskStatus";

const EMPTY_FILTERS = { status: "", priority: "", dueFrom: "", dueTo: "", source: "" };

// The sheet groups rows by employee; My Tasks has one group, the user.
const ME = { UserID: "me", FullName: "Me" };

/**
 * My Tasks as a sheet: every task of the user with blank rows below to add
 * new ones, Submit per row (see TaskSheet, mode "own"). Tasks not yet seen
 * (new assignments and CFO remarks) are highlighted as New on this visit and
 * marked seen, which clears the Tasks badge.
 */
const MyTasks = () => {
  const dispatch = useDispatch();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [reloadKey, setReloadKey] = useState(0);

  // Rows that were unseen when loaded; they stay highlighted as New on this
  // visit even after being marked seen.
  const [newTaskIds, setNewTaskIds] = useState(() => new Set());

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let ignore = false;
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ""));

    getMyTasks(params)
      .then((list) => {
        if (ignore) return;
        const rows = list || [];
        setTasks(rows);
        setError("");

        const unseenIds = rows.filter((task) => !task.IsSeenByUser).map((task) => task.TaskID);
        if (unseenIds.length > 0) {
          setNewTaskIds((current) => new Set([...current, ...unseenIds]));
          markTasksSeen(unseenIds)
            .then((result) => dispatch(taskUnseenCountReceived(result?.unseenCount)))
            .catch(() => {
              // Stays unseen; it is marked on the next visit.
            });
        }
      })
      .catch((err) => {
        if (!ignore) setError(getTaskApiError(err, "Failed to load your tasks.").message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [filters, reloadKey, dispatch]);

  const hasFilters = Object.values(filters).some((value) => value !== "");
  const changeFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

  const openCount = tasks.filter((t) => t.Status !== "Done").length;
  const overdueCount = tasks.filter((t) => t.IsOverdue).length;

  return (
    <TaskWorkbookFrame
      barSubtitle="My tasks"
      badge="MY TASKS"
      title="My Tasks"
      description="Type a new task in a blank row, or change a task, and press Submit on that row."
      actions={
        !loading && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600"><strong className="text-[#2c3e82]">{openCount}</strong> open</span>
            {overdueCount > 0 && (
              <span className="text-[#b3403f]"><strong>{overdueCount}</strong> overdue</span>
            )}
          </div>
        )
      }
      filters={
        <>
          <div>
            <label htmlFor="my-task-status" className={filterLabelClass}>Status</label>
            <select id="my-task-status" value={filters.status} onChange={(e) => changeFilter("status", e.target.value)} className={selectClass}>
              <option value="">Open + Done (last 30 days)</option>
              {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="my-task-priority" className={filterLabelClass}>Priority</label>
            <select id="my-task-priority" value={filters.priority} onChange={(e) => changeFilter("priority", e.target.value)} className={selectClass}>
              <option value="">All Priorities</option>
              {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="my-task-due-from" className={filterLabelClass}>Due Date From</label>
            <input
              id="my-task-due-from"
              type="date"
              value={filters.dueFrom}
              max={filters.dueTo || undefined}
              onChange={(e) => changeFilter("dueFrom", e.target.value)}
              className={selectClass}
            />
          </div>
          <div>
            <label htmlFor="my-task-due-to" className={filterLabelClass}>Due Date To</label>
            <input
              id="my-task-due-to"
              type="date"
              value={filters.dueTo}
              min={filters.dueFrom || undefined}
              onChange={(e) => changeFilter("dueTo", e.target.value)}
              className={selectClass}
            />
          </div>
          <div>
            <label htmlFor="my-task-source" className={filterLabelClass}>Source</label>
            <select id="my-task-source" value={filters.source} onChange={(e) => changeFilter("source", e.target.value)} className={selectClass}>
              <option value="">Self-added and Assigned</option>
              {TASK_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          {hasFilters && (
            <div className="flex items-end">
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="text-sm font-semibold text-slate-600 hover:text-[#2c3e82] px-3 py-2 cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          )}
        </>
      }
      footer="On tasks assigned by the Business Head you can change only Status and User's Remarks. CFO's Remarks are added by the Business Head. Done tasks older than 30 days are hidden unless you pick Status = Done."
    >
      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      )}
      {loading ? (
        <p className="border border-[#aeb9cc] px-4 py-8 text-center text-sm text-slate-500">Loading your tasks...</p>
      ) : (
        <TaskSheet
          mode="own"
          groups={[{ employee: ME, tasks, canAdd: true }]}
          blankRows={3}
          showGroupHeaders={false}
          newTaskIds={newTaskIds}
          onSaved={reload}
        />
      )}
    </TaskWorkbookFrame>
  );
};

export default MyTasks;
