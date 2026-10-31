import React, { useState } from "react";
import TaskListView from "../../components/TaskListView/TaskListView";
import TaskEmployeesView from "../../components/TaskEmployeesView/TaskEmployeesView";
import useTasksAccess from "../../hooks/useTasksAccess";
import { getAllTaskFilterOptions, getAllTasks } from "../../services/taskService";

const tabClass = (active) =>
  `px-4 py-2 text-sm font-semibold transition cursor-pointer ${
    active ? "bg-[#2c3e82] text-white shadow-sm" : "text-[#2c3e82] hover:bg-blue-50"
  }`;

// Every user's tasks (Business Head; Admin read-only), in two views:
//   Tasks     - the task grid with filters; the Business Head can add or
//               change CFO's Remarks on any row with Submit
//   Employees - every active user, with or without tasks, in one sheet with
//               a blank row each, so the Business Head assigns by typing and
//               pressing Submit
const AllTasks = () => {
  const { isBusinessHead } = useTasksAccess();
  const [view, setView] = useState("tasks");

  const headerActions = (
    <div className="inline-flex border border-blue-200 bg-white" role="tablist" aria-label="All Tasks view">
      <button type="button" role="tab" aria-selected={view === "tasks"} onClick={() => setView("tasks")} className={tabClass(view === "tasks")}>
        Tasks
      </button>
      <button type="button" role="tab" aria-selected={view === "employees"} onClick={() => setView("employees")} className={tabClass(view === "employees")}>
        Employees
      </button>
    </div>
  );

  if (view === "employees") {
    return <TaskEmployeesView canAssign={isBusinessHead} headerActions={headerActions} />;
  }

  return (
    <TaskListView
      title="All Tasks"
      badge="ALL TASKS"
      barSubtitle="Organization overview"
      description={
        isBusinessHead
          ? "Every employee's tasks. Type a CFO's Remark on any task and press Submit to email it to the employee."
          : "Every employee's tasks (view only)."
      }
      footer="Use the Employees view to assign new tasks. The Overdue box shows only overdue tasks; click it again to show all."
      loadTasks={getAllTasks}
      loadFilterOptions={getAllTaskFilterOptions}
      filterKeys={["department", "employee", "status", "priority", "dueRange", "source"]}
      showEmployee
      cfoEditable
      emptyTitle="No tasks yet."
      headerActions={headerActions}
    />
  );
};

export default AllTasks;
