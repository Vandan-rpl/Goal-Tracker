import { TASKS_DASHBOARD_PATH } from "./tasksMenu";
import { IDEAS_DASHBOARD_PATH } from "./ideasMenu";

// Goal Tracker and Task Tracker are only for grade 303 and above (Admin
// always). The backend decides at login (hasGoalAccess / hasTaskAccess) and
// checks again on every goal and task API.
// A session saved before a flag existed has no value: it is treated as
// allowed until the next login (the backend still refuses the data).
export const hasGoalAccess = (user) => user?.hasGoalAccess !== false;
export const hasTaskAccess = (user) => user?.hasTaskAccess !== false;

// Where users without the Goal Tracker land instead of /dashboard: the Task
// Tracker if they have it, otherwise Innovation Ideas (open to everyone).
export const getNoGoalAccessHome = (user) =>
  hasTaskAccess(user) ? TASKS_DASHBOARD_PATH : IDEAS_DASHBOARD_PATH;

// Where users without the Task Tracker land instead of /tasks.
export const getNoTaskAccessHome = (user) =>
  hasGoalAccess(user) ? "/dashboard" : IDEAS_DASHBOARD_PATH;
