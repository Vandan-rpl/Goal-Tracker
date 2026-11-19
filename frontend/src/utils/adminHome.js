// The Admin only manages the app: no module switch, only the Administration
// links in the sidebar, and the employee list instead of the Goal Tracker
// dashboard as their home page.

export const ADMIN_HOME_PATH = "/admin/employees-list";

export const isAdminUser = (user) =>
  String(user?.Role || user?.role || "").toUpperCase() === "ADMIN";
