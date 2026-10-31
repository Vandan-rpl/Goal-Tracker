// Task Tracker module: routes, sidebar menu and who can see each item.
// The sidebar and the route guard both read TASKS_MENU, so a page is
// reachable by URL only if it is in the user's menu. The backend enforces
// the same rules (403).

export const TASKS_BASE_PATH = "/tasks";
export const TASKS_HOME_PATH = "/tasks/my-tasks";

export const isTasksPath = (pathname = "") =>
  pathname === TASKS_BASE_PATH || pathname.startsWith(`${TASKS_BASE_PATH}/`);

export const TASKS_ACCESS = {
  EVERYONE: "everyone",
  HAS_REPORTEES: "hasReportees",
  // Business Head or Admin (Admin is read-only, like All Ideas).
  VIEW_ALL: "viewAll",
  BUSINESS_HEAD: "businessHead",
};

export const TASKS_MENU = [
  {
    key: "my-tasks",
    label: "My Tasks",
    path: "/tasks/my-tasks",
    access: TASKS_ACCESS.EVERYONE,
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-6 9l2 2 4-4",
  },
  {
    key: "team",
    label: "Team Tasks",
    path: "/tasks/team",
    access: TASKS_ACCESS.HAS_REPORTEES,
    section: "Team",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  },
  {
    key: "all",
    label: "All Tasks",
    path: "/tasks/all",
    access: TASKS_ACCESS.VIEW_ALL,
    section: "Organization",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  },
  {
    key: "assign",
    label: "Assign Task",
    path: "/tasks/assign",
    access: TASKS_ACCESS.BUSINESS_HEAD,
    section: "Organization",
    icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
  },
];

export const canAccessTasksItem = (item, { isBusinessHead, canViewAll, hasDirectReports }) => {
  if (item.access === TASKS_ACCESS.VIEW_ALL) return Boolean(canViewAll);
  if (item.access === TASKS_ACCESS.BUSINESS_HEAD) return Boolean(isBusinessHead);
  if (item.access === TASKS_ACCESS.HAS_REPORTEES) return Boolean(hasDirectReports);
  return true;
};

export const getTasksMenuItem = (key) =>
  TASKS_MENU.find((item) => item.key === key);

export const isTasksItemActive = (item, pathname = "") =>
  pathname === item.path || pathname.startsWith(`${item.path}/`);
