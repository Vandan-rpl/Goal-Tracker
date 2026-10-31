import React from "react";
import TaskListView from "../../components/TaskListView/TaskListView";
import { getMyTasks } from "../../services/taskService";

// The logged-in user's tasks. Unseen tasks (new assignments and CFO
// remarks) are highlighted as New and marked seen on load.
const MyTasks = () => (
  <TaskListView
    title="My Tasks"
    description="Your own tasks and the tasks assigned to you by the Business Head."
    loadTasks={getMyTasks}
    filterKeys={["status", "priority", "dueRange", "source"]}
    allowAdd
    markSeenOnLoad
    emptyTitle="You don't have any tasks yet."
  />
);

export default MyTasks;
