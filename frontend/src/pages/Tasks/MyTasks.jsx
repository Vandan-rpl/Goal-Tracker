import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import TaskSheet from "../../components/TaskSheet/TaskSheet";
import TaskWorkbookFrame, {
  taskFilterControlClass as selectClass,
  taskFilterLabelClass as filterLabelClass,
} from "../../components/TaskWorkbookFrame/TaskWorkbookFrame";
import { getMyProjects, getMyTasks, getTaskApiError, markTasksSeen } from "../../services/taskService";
import { taskUnseenCountReceived } from "../../redux/slices/taskSlice";
import {
  TASK_PRIORITIES,
  TASK_SOURCES,
  TASK_STATUSES,
  formatMonthRangeLabel,
  getMonthKey,
  getTodayKey,
} from "../../utils/taskStatus";
import DateInput from "../../components/DateInput/DateInput";

const EMPTY_FILTERS = { status: "", priority: "", dueFrom: "", dueTo: "", source: "", project: "" };

// The sheet groups rows by employee; My Tasks has one group, the user.
const ME = { UserID: "me", FullName: "Me" };

/**
 * My Tasks as a month sheet, like the CFO's Assign Task page: From / To
 * Month filters (default this month) list the tasks created or assigned in
 * those months, in the order they were added, so yesterday's and older
 * tasks stay visible. Blank rows to add new tasks follow when the range ends
 * in the current month; on the 1st of a month the default view starts
 * empty. Submit per row (see TaskSheet, mode "own"). Tasks not yet seen
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

  const currentMonth = getMonthKey(getTodayKey());
  const [fromMonth, setFromMonth] = useState(currentMonth);
  const [toMonth, setToMonth] = useState(currentMonth);
  // New tasks are always created today, so blank rows show only when the
  // range ends in the current month.
  const isCurrentMonth = toMonth === currentMonth;
  const rangeLabel = formatMonthRangeLabel(fromMonth, toMonth);

  // Rows that were unseen when loaded; they stay highlighted as New on this
  // visit even after being marked seen.
  const [newTaskIds, setNewTaskIds] = useState(() => new Set());
  // Projects I am a member of, for the Project column (null while loading).
  const [myProjects, setMyProjects] = useState(null);

  useEffect(() => {
    let ignore = false;
    getMyProjects()
      .then((list) => {
        if (!ignore) setMyProjects(list || []);
      })
      .catch(() => {
        // The column then just offers no projects; tasks still work.
        if (!ignore) setMyProjects([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let ignore = false;
    const params = {
      ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== "")),
      fromMonth,
      toMonth,
    };

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
  }, [filters, fromMonth, toMonth, reloadKey, dispatch]);

  const hasFilters = Object.values(filters).some((value) => value !== "");
  const changeFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value }));

  const openCount = tasks.filter((t) => t.Status !== "Completed").length;
  const overdueCount = tasks.filter((t) => t.IsOverdue).length;

  return (
    <TaskWorkbookFrame
      barSubtitle="My tasks"
      badge="MY TASKS"
      title="My Tasks"
      description="Type a new task in a blank row and press Submit on that row."
      actions={
        !loading && (
          <div className="flex items-center gap-4 text-sm">
            {/* <span className="text-slate-600"><strong className="text-[#2c3e82]">{openCount}</strong> open</span> */}
            {overdueCount > 0 && (
              <span className="text-[#b3403f]"><strong>{overdueCount}</strong> overdue</span>
            )}
          </div>
        )
      }
      filters={
        <>
          <div>
            <label htmlFor="my-task-from-month" className={filterLabelClass}>From Month</label>
            <input
              id="my-task-from-month"
              type="month"
              value={fromMonth}
              max={toMonth}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                setFromMonth(value);
                // Keep the range valid: a later From moves To with it.
                if (value > toMonth) setToMonth(value > currentMonth ? currentMonth : value);
              }}
              className={selectClass}
            />
          </div>
          <div>
            <label htmlFor="my-task-to-month" className={filterLabelClass}>To Month</label>
            <input
              id="my-task-to-month"
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
              }}
              className={selectClass}
            />
          </div>
          <div>
            <label htmlFor="my-task-status" className={filterLabelClass}>Status</label>
            <select id="my-task-status" value={filters.status} onChange={(e) => changeFilter("status", e.target.value)} className={selectClass}>
              <option value="">All Statuses</option>
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
            <DateInput
              id="my-task-due-from"
              value={filters.dueFrom}
              max={filters.dueTo || undefined}
              onChange={(e) => changeFilter("dueFrom", e.target.value)}
              className={selectClass}
            />
          </div>
          <div>
            <label htmlFor="my-task-due-to" className={filterLabelClass}>Due Date To</label>
            <DateInput
              id="my-task-due-to"
              value={filters.dueTo}
              min={filters.dueFrom || undefined}
              onChange={(e) => changeFilter("dueTo", e.target.value)}
              className={selectClass}
            />
          </div>
          <div>
            <label htmlFor="my-task-project" className={filterLabelClass}>Project</label>
            <select
              id="my-task-project"
              value={filters.project}
              onChange={(e) => changeFilter("project", e.target.value)}
              disabled={!myProjects?.length}
              className={`${selectClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="">
                {myProjects === null ? "Loading projects..." : myProjects.length ? "All Projects" : "No projects"}
              </option>
              {(myProjects || []).map((p) => (
                <option key={p.ProjectID} value={String(p.ProjectID)}>{p.ProjectName}</option>
              ))}
            </select>
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
      footer="Tasks added or assigned in the selected months are listed in the order they were added. New tasks can be added only when the range ends in the current month; each month starts with a fresh sheet. Project tasks are listed here too, with their project name. On tasks assigned to you (by the CFO or a project Manager) you can change only Status and User's Remarks. CFO's Remarks are added by the CFO."
    >
      {error && (
        <div className="mb-4 border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div>
      )}
      {loading ? (
        <p className="border border-[#aeb9cc] px-4 py-8 text-center text-sm text-slate-500">Loading your tasks...</p>
      ) : !isCurrentMonth && tasks.length === 0 ? (
        <p className="border border-[#aeb9cc] px-4 py-8 text-center text-sm text-slate-500">
          No tasks were added in {rangeLabel}.
        </p>
      ) : (
        <TaskSheet
          mode="own"
          groups={[{ employee: ME, tasks, canAdd: isCurrentMonth }]}
          blankRows={3}
          showGroupHeaders={false}
          newTaskIds={newTaskIds}
          onSaved={reload}
          ownProjects={myProjects}
        />
      )}
    </TaskWorkbookFrame>
  );
};

export default MyTasks;
