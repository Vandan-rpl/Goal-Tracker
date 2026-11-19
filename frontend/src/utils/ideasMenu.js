// Innovation Ideas module: routes, sidebar menu and who can see each item.
// The sidebar and the route guard both read IDEAS_MENU, so a page is
// reachable by URL only if it is in the user's menu.

export const IDEAS_BASE_PATH = "/ideas";
export const IDEAS_HOME_PATH = "/ideas/my-ideas";
// Where the Ideas module opens (header module switch, /ideas).
export const IDEAS_DASHBOARD_PATH = "/ideas/dashboard";

export const isIdeasPath = (pathname = "") =>
  pathname === IDEAS_BASE_PATH || pathname.startsWith(`${IDEAS_BASE_PATH}/`);

// Same roles the backend lets view every idea. BusinessHead is the CFO role.
const VIEW_ALL_ROLES = ["BUSINESSHEAD", "ADMIN"];

export const IDEAS_ACCESS = {
  EVERYONE: "everyone",
  HAS_REPORTEES: "hasReportees",
  VIEW_ALL: "viewAll",
  // Either of the two above.
  HAS_REPORTEES_OR_VIEW_ALL: "hasReporteesOrViewAll",
  // The CFO (Business Head) only.
  BUSINESS_HEAD: "businessHead",
  // HOD / Reporting Manager section: manager roles (same as the Goal
  // Tracker's section), anyone with reportees, or an idea final approver.
  REVIEWER: "reviewer",
};

// Roles that see the Goal Tracker's "For HOD/Reporting Manager" section.
const REVIEWER_ROLES = ["HOD", "MANAGER", "BUSINESSHEAD", "ADMIN"];

// `activePaths`: extra path prefixes that highlight the item (e.g. editing
// a draft is the Share an Idea form).
export const IDEAS_MENU = [
  {
    key: "dashboard",
    label: "Dashboard",
    path: "/ideas/dashboard",
    access: IDEAS_ACCESS.EVERYONE,
    icon: "M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z",
  },
  {
    key: "share",
    label: "Share an Idea",
    path: "/ideas/share",
    activePaths: ["/ideas/edit"],
    access: IDEAS_ACCESS.EVERYONE,
    icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
  {
    key: "my-ideas",
    label: "Idea Management",
    path: "/ideas/my-ideas",
    access: IDEAS_ACCESS.EVERYONE,
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012-2m-6 9l2 2 4-4",
  },
  {
    key: "assigned",
    label: "Ideas Review & Approval",
    path: "/ideas/assigned",
    access: IDEAS_ACCESS.REVIEWER,
    section: "For HOD/Reporting Manager",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    key: "track",
    label: "Track Idea",
    path: "/ideas/track",
    access: IDEAS_ACCESS.HAS_REPORTEES_OR_VIEW_ALL,
    icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  },
  // {
  //   key: "team",
  //   label: "Team Ideas",
  //   path: "/ideas/team",
  //   access: IDEAS_ACCESS.HAS_REPORTEES,
  //   section: "Team",
  //   icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  // },
  {
    key: "all",
    label: "All Ideas",
    path: "/ideas/all",
    access: IDEAS_ACCESS.VIEW_ALL,
    section: "Organization",
    icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  },
  {
    key: "reports",
    label: "Reports & Analytics",
    path: "/ideas/reports",
    access: IDEAS_ACCESS.BUSINESS_HEAD,
    section: "Organization",
    icon: "M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
];

export const canViewAllIdeas = (role = "") =>
  VIEW_ALL_ROLES.includes(String(role).toUpperCase());

export const canAccessIdeasItem = (item, { role, hasReportees, isFinalApprover }) => {
  if (item.access === IDEAS_ACCESS.REVIEWER) {
    return (
      REVIEWER_ROLES.includes(String(role).toUpperCase()) ||
      Boolean(hasReportees) ||
      Boolean(isFinalApprover)
    );
  }
  if (item.access === IDEAS_ACCESS.BUSINESS_HEAD) return String(role).toUpperCase() === "BUSINESSHEAD";
  if (item.access === IDEAS_ACCESS.VIEW_ALL) return canViewAllIdeas(role);
  if (item.access === IDEAS_ACCESS.HAS_REPORTEES) return Boolean(hasReportees);
  if (item.access === IDEAS_ACCESS.HAS_REPORTEES_OR_VIEW_ALL) {
    return Boolean(hasReportees) || canViewAllIdeas(role);
  }
  return true;
};

export const getIdeasMenuItem = (key) =>
  IDEAS_MENU.find((item) => item.key === key);

export const isIdeasItemActive = (item, pathname = "") =>
  [item.path, ...(item.activePaths || [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
