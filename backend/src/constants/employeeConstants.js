/**
 * ==========================================================
 * Employee Module Constants
 * Goal Tracker Management System
 * ==========================================================
 * Author  : Senior Full Stack Developer
 * Database: Microsoft SQL Server
 * Backend : Node.js + Express.js
 * ==========================================================
 */

const EMPLOYEE_STATUS = Object.freeze({
    ACTIVE: "Active",
    INACTIVE: "Inactive",
});

const EMPLOYMENT_STATUS = Object.freeze({
    ACTIVE: "Active",
    INACTIVE: "Inactive",
    RESIGNED: "Resigned",
    TERMINATED: "Terminated",
    RETIRED: "Retired",
});

const DEFAULT_USER = Object.freeze({
    PASSWORD: "Rubi@rubix",
    DEFAULT_PASSWORD_FLAG: true,
    FAILED_LOGIN_COUNT: 0,
    IS_LOCKED: false,
    PASSWORD_CHANGED_DATE: null,
});

const IMPORT_STATUS = Object.freeze({
    SUCCESS: "SUCCESS",
    FAILED: "FAILED",
    SKIPPED: "SKIPPED",
    VALIDATION_ERROR: "VALIDATION_ERROR",
});

const EXCEL = Object.freeze({
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB

    ALLOWED_EXTENSIONS: [
        ".xlsx",
        ".xls",
    ],

    SHEET_NAME: "Employees",

    SAMPLE_FILE_NAME: "Employee_Master_Template.xlsx",
});

const EMPLOYEE_SEARCH_FIELDS = Object.freeze([
    "EmployeeCode",
    "EmployeeName",
    "Email",
    "DepartmentName",
    "Designation",
    "Location",
]);

const EMPLOYEE_SORT_FIELDS = Object.freeze([
    "EmployeeCode",
    "EmployeeName",
    "DepartmentName",
    "Designation",
    "Location",
    "JoiningDate",
    "EmploymentStatus",
]);

const EMPLOYEE_FILTERS = Object.freeze({
    DEPARTMENT: "Department",
    ROLE: "Role",
    STATUS: "Status",
    LOCATION: "Location",
    JOINING_DATE: "JoiningDate",
});

const EXCEL_COLUMNS = Object.freeze([
    "EmployeeCode",
    "EmployeeName",
    "Email",
    "Mobile",
    "DepartmentCode",
    "DepartmentName",
    "Designation",
    "Location",
    "JoiningDate",
    "ReportingManagerCode",
    "HODCode",
    "BusinessHeadCode",
    "CFOCode",
    "Role",
    "Status",
    "Remarks",
]);

const IMPORT_SUMMARY = Object.freeze({
    TOTAL_RECORDS: "TotalRecords",
    IMPORTED: "Imported",
    FAILED: "Failed",
    SKIPPED: "Skipped",
    DUPLICATE_EMPLOYEE_CODES: "DuplicateEmployeeCodes",
    DUPLICATE_EMAILS: "DuplicateEmails",
    DUPLICATE_MOBILES: "DuplicateMobiles",
    VALIDATION_ERRORS: "ValidationErrors",
});

const AUDIT_ACTIONS = Object.freeze({
    CREATE: "Employee Create",
    UPDATE: "Employee Update",
    DELETE: "Employee Delete",
    ACTIVATE: "Employee Activate",
    DEACTIVATE: "Employee Deactivate",
    IMPORT: "Employee Import",
    EXPORT: "Employee Export",
    UPLOAD: "Employee Upload",
    STATUS_CHANGE: "Employee Status Change",
});

const PAGINATION = Object.freeze({
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100,
});

module.exports = {
    EMPLOYEE_STATUS,
    EMPLOYMENT_STATUS,
    DEFAULT_USER,
    IMPORT_STATUS,
    EXCEL,
    EMPLOYEE_SEARCH_FIELDS,
    EMPLOYEE_SORT_FIELDS,
    EMPLOYEE_FILTERS,
    EXCEL_COLUMNS,
    IMPORT_SUMMARY,
    AUDIT_ACTIONS,
    PAGINATION,
};