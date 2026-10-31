import React from "react";
import TaskListView from "../../components/TaskListView/TaskListView";
import { getTeamTaskFilterOptions, getTeamTasks } from "../../services/taskService";

// Direct reports' tasks, read-only.
const TeamTasks = () => (
  <TaskListView
    title="Team Tasks"
    badge="TEAM TASKS"
    barSubtitle="My team"
    description="Tasks of the employees who report to you (view only)."
    loadTasks={getTeamTasks}
    loadFilterOptions={getTeamTaskFilterOptions}
    filterKeys={["employee", "status", "dueRange"]}
    showEmployee
    emptyTitle="Your team has no tasks yet."
  />
);

export default TeamTasks;
