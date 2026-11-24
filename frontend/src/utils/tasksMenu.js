// Task Tracker module: routes, sidebar menu and who can see each item.
// The sidebar and the route guard both read TASKS_MENU, so a page is
// reachable by URL only if it is in the user's menu. The backend enforces
// the same rules (403).

export const TASKS_BASE_PATH = "/tasks";
export const TASKS_HOME_PATH = "/tasks/my-tasks";
// Where the Task Tracker opens (header module switch, /tasks).
export const TASKS_DASHBOARD_PATH = "/tasks/dashboard";

export const isTasksPath = (pathname = "") =>
  pathname === TASKS_BASE_PATH || pathname.startsWith(`${TASKS_BASE_PATH}/`);

export const TASKS_ACCESS = {
  EVERYONE: "everyone",
  HAS_REPORTEES: "hasReportees",
  // Business Head or Admin (Admin is read-only, like All Ideas).
  VIEW_ALL: "viewAll",
  BUSINESS_HEAD: "businessHead",
  // Admin / Manager, or anyone in (or who created) an active project; never
  // the Business Head (CFO).
  PROJECTS: "projects",
};

export const TASKS_MENU = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/tasks/dashboard",
    access: TASKS_ACCESS.EVERYONE,
    icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z",
  },
  {
    key: "my-tasks",
    label: "My Tasks",
    path: "/tasks/my-tasks",
    access: TASKS_ACCESS.EVERYONE,
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-6 9l2 2 4-4",
  },
  {
    key: "projects",
    label: "Projects tasks",
    path: "/tasks/projects",
    access: TASKS_ACCESS.PROJECTS,
    icon: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
  },
  {
    key: "team",
    label: "Team Tasks",
    path: "/tasks/team",
    access: TASKS_ACCESS.HAS_REPORTEES,
    section: "Team",
    icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  },
  // First in Organization for the CFO.
  {
    key: "assign",
    label: "Assign Task",
    path: "/tasks/assign",
    access: TASKS_ACCESS.BUSINESS_HEAD,
    section: "Organization",
    icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
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
    key: "reports",
    label: "Reports & Analytics",
    path: "/tasks/reports",
    access: TASKS_ACCESS.BUSINESS_HEAD,
    section: "Organization",
    icon: "M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
];

export const canAccessTasksItem = (item, { isBusinessHead, canViewAll, hasDirectReports, hasProjects, canCreateProjects }) => {
  if (item.access === TASKS_ACCESS.VIEW_ALL) return Boolean(canViewAll);
  // Not for the CFO: All Tasks has a Project filter instead.
  if (item.access === TASKS_ACCESS.PROJECTS) {
    return !isBusinessHead && Boolean(canViewAll || hasProjects || canCreateProjects);
  }
  if (item.access === TASKS_ACCESS.BUSINESS_HEAD) return Boolean(isBusinessHead);
  if (item.access === TASKS_ACCESS.HAS_REPORTEES) return Boolean(hasDirectReports);
  return true;
};

export const getTasksMenuItem = (key) =>
  TASKS_MENU.find((item) => item.key === key);

export const isTasksItemActive = (item, pathname = "") =>
  pathname === item.path || pathname.startsWith(`${item.path}/`);
