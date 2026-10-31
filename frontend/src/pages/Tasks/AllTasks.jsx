import React from "react";
import TaskListView from "../../components/TaskListView/TaskListView";
import { getAllTaskFilterOptions, getAllTasks } from "../../services/taskService";

// Every user's tasks (Business Head; Admin read-only). The Business Head
// can add or change CFO's Remarks on any row with Submit.
const AllTasks = () => (
  <TaskListView
    title="All Tasks"
    description="Tasks of every employee. Add CFO's Remarks on any task and press Submit."
    loadTasks={getAllTasks}
    loadFilterOptions={getAllTaskFilterOptions}
    filterKeys={["department", "employee", "status", "priority", "dueRange", "source"]}
    showEmployee
    cfoEditable
    emptyTitle="No tasks yet."
  />
);

export default AllTasks;
