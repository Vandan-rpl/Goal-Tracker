/**
 * ============================================================
 * Goal Tracker Management System
 * Permission Constants
 * ============================================================
 */

const PERMISSIONS = Object.freeze({
  // ==========================================================
  // Dashboard
  // ==========================================================
  VIEW_DASHBOARD: "VIEW_DASHBOARD",

  // ==========================================================
  // Department
  // ==========================================================
  VIEW_DEPARTMENT: "VIEW_DEPARTMENT",
  CREATE_DEPARTMENT: "CREATE_DEPARTMENT",
  UPDATE_DEPARTMENT: "UPDATE_DEPARTMENT",
  DELETE_DEPARTMENT: "DELETE_DEPARTMENT",

  // ==========================================================
  // Employee
  // ==========================================================
  VIEW_EMPLOYEE: "VIEW_EMPLOYEE",
  CREATE_EMPLOYEE: "CREATE_EMPLOYEE",
  UPDATE_EMPLOYEE: "UPDATE_EMPLOYEE",
  DELETE_EMPLOYEE: "DELETE_EMPLOYEE",

  // ==========================================================
  // Role Management
  // ==========================================================
  VIEW_ROLE: "VIEW_ROLE",
  CREATE_ROLE: "CREATE_ROLE",
  UPDATE_ROLE: "UPDATE_ROLE",
  DELETE_ROLE: "DELETE_ROLE",

  // ==========================================================
  // Permission Management
  // ==========================================================
  VIEW_PERMISSION: "VIEW_PERMISSION",
  CREATE_PERMISSION: "CREATE_PERMISSION",
  UPDATE_PERMISSION: "UPDATE_PERMISSION",
  DELETE_PERMISSION: "DELETE_PERMISSION",

  // ==========================================================
  // Goal Management
  // ==========================================================
  VIEW_GOAL: "VIEW_GOAL",
  CREATE_GOAL: "CREATE_GOAL",
  UPDATE_GOAL: "UPDATE_GOAL",
  DELETE_GOAL: "DELETE_GOAL",

  // ==========================================================
  // Goal Submission
  // ==========================================================
  VIEW_GOAL_SUBMISSION: "VIEW_GOAL_SUBMISSION",
  CREATE_GOAL_SUBMISSION: "CREATE_GOAL_SUBMISSION",
  UPDATE_GOAL_SUBMISSION: "UPDATE_GOAL_SUBMISSION",
  DELETE_GOAL_SUBMISSION: "DELETE_GOAL_SUBMISSION",

  // ==========================================================
  // Quarterly Updates
  // ==========================================================
  VIEW_QUARTERLY_UPDATE: "VIEW_QUARTERLY_UPDATE",
  CREATE_QUARTERLY_UPDATE: "CREATE_QUARTERLY_UPDATE",
  UPDATE_QUARTERLY_UPDATE: "UPDATE_QUARTERLY_UPDATE",
  DELETE_QUARTERLY_UPDATE: "DELETE_QUARTERLY_UPDATE",

  // ==========================================================
  // Approvals
  // ==========================================================
  VIEW_HOD_APPROVAL: "VIEW_HOD_APPROVAL",
  APPROVE_HOD_GOAL: "APPROVE_HOD_GOAL",

  VIEW_CFO_REVIEW: "VIEW_CFO_REVIEW",
  APPROVE_CFO_GOAL: "APPROVE_CFO_GOAL",

  // ==========================================================
  // Reports
  // ==========================================================
  VIEW_REPORT: "VIEW_REPORT",
  EXPORT_REPORT: "EXPORT_REPORT",

  // ==========================================================
  // Notifications
  // ==========================================================
  VIEW_NOTIFICATION: "VIEW_NOTIFICATION",
  CREATE_NOTIFICATION: "CREATE_NOTIFICATION",

  // ==========================================================
  // Settings
  // ==========================================================
  VIEW_SETTINGS: "VIEW_SETTINGS",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",

  // ==========================================================
  // Profile
  // ==========================================================
  VIEW_PROFILE: "VIEW_PROFILE",
  UPDATE_PROFILE: "UPDATE_PROFILE",
  CHANGE_PASSWORD: "CHANGE_PASSWORD",

  // ==========================================================
  // User Management
  // ==========================================================
  VIEW_USER: "VIEW_USER",
  CREATE_USER: "CREATE_USER",
  UPDATE_USER: "UPDATE_USER",
  DELETE_USER: "DELETE_USER",
  RESET_PASSWORD: "RESET_PASSWORD",

  // ==========================================================
  // Audit Logs
  // ==========================================================
  VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG",

  // ==========================================================
  // Administration
  // ==========================================================
  ACCESS_ADMINISTRATION: "ACCESS_ADMINISTRATION",

  // ==========================================================
  // Super Admin
  // ==========================================================
  SUPER_ADMIN: "SUPER_ADMIN",
});

export default PERMISSIONS;

export const {
  VIEW_DASHBOARD,

  VIEW_DEPARTMENT,
  CREATE_DEPARTMENT,
  UPDATE_DEPARTMENT,
  DELETE_DEPARTMENT,

  VIEW_EMPLOYEE,
  CREATE_EMPLOYEE,
  UPDATE_EMPLOYEE,
  DELETE_EMPLOYEE,

  VIEW_ROLE,
  CREATE_ROLE,
  UPDATE_ROLE,
  DELETE_ROLE,

  VIEW_PERMISSION,
  CREATE_PERMISSION,
  UPDATE_PERMISSION,
  DELETE_PERMISSION,

  VIEW_GOAL,
  CREATE_GOAL,
  UPDATE_GOAL,
  DELETE_GOAL,

  VIEW_GOAL_SUBMISSION,
  CREATE_GOAL_SUBMISSION,
  UPDATE_GOAL_SUBMISSION,
  DELETE_GOAL_SUBMISSION,

  VIEW_QUARTERLY_UPDATE,
  CREATE_QUARTERLY_UPDATE,
  UPDATE_QUARTERLY_UPDATE,
  DELETE_QUARTERLY_UPDATE,

  VIEW_HOD_APPROVAL,
  APPROVE_HOD_GOAL,

  VIEW_CFO_REVIEW,
  APPROVE_CFO_GOAL,

  VIEW_REPORT,
  EXPORT_REPORT,

  VIEW_NOTIFICATION,
  CREATE_NOTIFICATION,

  VIEW_SETTINGS,
  UPDATE_SETTINGS,

  VIEW_PROFILE,
  UPDATE_PROFILE,
  CHANGE_PASSWORD,

  VIEW_USER,
  CREATE_USER,
  UPDATE_USER,
  DELETE_USER,
  RESET_PASSWORD,

  VIEW_AUDIT_LOG,

  ACCESS_ADMINISTRATION,

  SUPER_ADMIN,
} = PERMISSIONS;