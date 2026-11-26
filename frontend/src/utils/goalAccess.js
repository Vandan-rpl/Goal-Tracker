import { TASKS_DASHBOARD_PATH } from "./tasksMenu";

// Goal Tracker is only for grade 303 and above (Admin always). The backend
// decides at login (hasGoalAccess) and checks again on every goal API.
// A session saved before this flag existed has no value: it is treated as
// allowed until the next login (the backend still refuses goal data).
export const hasGoalAccess = (user) => user?.hasGoalAccess !== false;

// Where users without the Goal Tracker land instead of /dashboard.
export const NO_GOAL_ACCESS_HOME = TASKS_DASHBOARD_PATH;
