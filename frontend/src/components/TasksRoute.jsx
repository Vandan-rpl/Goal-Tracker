import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import useTasksAccess from "../hooks/useTasksAccess";
import {
  TASKS_HOME_PATH,
  canAccessTasksItem,
  getTasksMenuItem,
} from "../utils/tasksMenu";

/**
 * Guards a Tasks page that only some users have in their menu. Anyone else
 * who opens the URL directly is sent to My Tasks (the backend returns 403
 * for their data anyway).
 *
 * Usage:
 *   <Route element={<TasksRoute menuKey="team" />}>
 *     <Route path="/tasks/team" element={<TeamTasks />} />
 *   </Route>
 */
const TasksRoute = ({ menuKey }) => {
  const access = useTasksAccess();
  const item = getTasksMenuItem(menuKey);

  if (access.loading) {
    return <div className="flex justify-center items-center h-64 text-sm text-gray-500">Loading...</div>;
  }

  if (!item || !canAccessTasksItem(item, access)) {
    return <Navigate to={TASKS_HOME_PATH} replace />;
  }

  return <Outlet />;
};

export default TasksRoute;
