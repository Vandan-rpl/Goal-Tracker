import { lazy } from "react";

import PERMISSIONS from "../utils/permissions";
import { ROUTES } from "../constants/dashboardConstants";

/*
|--------------------------------------------------------------------------
| Lazy Loaded Pages
|--------------------------------------------------------------------------
*/

const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));

const Profile = lazy(() => import("../pages/Profile/Profile"));

const Settings = lazy(() => import("../pages/Settings/Settings"));

const Departments = lazy(() =>
  import("../pages/Departments/Departments")
);

const Employees = lazy(() =>
  import("../pages/Employees/Employees")
);

const GoalMaster = lazy(() =>
  import("../pages/Goals/GoalMaster")
);

const GoalSubmission = lazy(() =>
  import("../pages/Goals/GoalSubmission")
);

const QuarterlyUpdate = lazy(() =>
  import("../pages/Goals/QuarterlyUpdate")
);

const HODApproval = lazy(() =>
  import("../pages/Approvals/HODApproval")
);

const CFOReview = lazy(() =>
  import("../pages/Approvals/CFOReview")
);

const Reports = lazy(() =>
  import("../pages/Reports/Reports")
);

const Notifications = lazy(() =>
  import("../pages/Notifications/Notifications")
);

const Error401 = lazy(() =>
  import("../pages/Error/Error401")
);

const Error403 = lazy(() =>
  import("../pages/Error/Error403")
);

const Error404 = lazy(() =>
  import("../pages/Error/Error404")
);

const Error500 = lazy(() =>
  import("../pages/Error/Error500")
);

/*
|--------------------------------------------------------------------------
| Route Configuration
|--------------------------------------------------------------------------
*/

const routeConfig = [
  {
    id: 1,
    title: "Dashboard",
    path: ROUTES.DASHBOARD,
    component: Dashboard,
    icon: "Dashboard",
    permission: PERMISSIONS.VIEW_DASHBOARD,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },

  {
    id: 2,
    title: "Departments",
    path: ROUTES.DEPARTMENTS,
    component: Departments,
    icon: "Business",
    permission: PERMISSIONS.VIEW_DEPARTMENT,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },

  {
    id: 3,
    title: "Employees",
    path: ROUTES.EMPLOYEES,
    component: Employees,
    icon: "People",
    permission: PERMISSIONS.VIEW_EMPLOYEE,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },

  {
    id: 4,
    title: "Goal Master",
    path: ROUTES.GOAL_MASTER,
    component: GoalMaster,
    icon: "Flag",
    permission: PERMISSIONS.VIEW_GOAL,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },

  {
    id: 5,
    title: "Goal Submission",
    path: ROUTES.GOAL_SUBMISSION,
    component: GoalSubmission,
    icon: "AssignmentTurnedIn",
    permission: PERMISSIONS.VIEW_GOAL_SUBMISSION,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },

  {
    id: 6,
    title: "Quarterly Update",
    path: ROUTES.QUARTERLY_UPDATE,
    component: QuarterlyUpdate,
    icon: "Update",
    permission: PERMISSIONS.VIEW_QUARTERLY_UPDATE,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },

  {
    id: 7,
    title: "HOD Approval",
    path: ROUTES.HOD_APPROVAL,
    component: HODApproval,
    icon: "HowToReg",
    permission: PERMISSIONS.VIEW_HOD_APPROVAL,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },

  {
    id: 8,
    title: "CFO Review",
    path: ROUTES.CFO_REVIEW,
    component: CFOReview,
    icon: "FactCheck",
    permission: PERMISSIONS.VIEW_CFO_REVIEW,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },

  {
    id: 9,
    title: "Reports",
    path: ROUTES.REPORTS,
    component: Reports,
    icon: "Assessment",
    permission: PERMISSIONS.VIEW_REPORT,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },

  {
    id: 10,
    title: "Notifications",
    path: ROUTES.NOTIFICATIONS,
    component: Notifications,
    icon: "Notifications",
    permission: PERMISSIONS.VIEW_NOTIFICATION,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },

  {
    id: 11,
    title: "Profile",
    path: ROUTES.PROFILE,
    component: Profile,
    icon: "Person",
    permission: PERMISSIONS.VIEW_PROFILE,
    layout: "dashboard",
    showInMenu: false,
    breadcrumb: true,
  },

  {
    id: 12,
    title: "Settings",
    path: ROUTES.SETTINGS,
    component: Settings,
    icon: "Settings",
    permission: PERMISSIONS.VIEW_SETTINGS,
    layout: "dashboard",
    showInMenu: true,
    breadcrumb: true,
  },
];

/*
|--------------------------------------------------------------------------
| Error Routes
|--------------------------------------------------------------------------
*/

export const errorRoutes = [
  {
    path: "/401",
    component: Error401,
  },
  {
    path: "/403",
    component: Error403,
  },
  {
    path: "/404",
    component: Error404,
  },
  {
    path: "/500",
    component: Error500,
  },
];

/*
|--------------------------------------------------------------------------
| Route Helpers
|--------------------------------------------------------------------------
*/

export const getMenuRoutes = () =>
  routeConfig.filter((route) => route.showInMenu);

export const getProtectedRoutes = () => routeConfig;

export const getRouteByPath = (path) =>
  routeConfig.find((route) => route.path === path);

export default routeConfig;