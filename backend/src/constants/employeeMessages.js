/**
 * ==========================================================
 * Employee Module Messages
 * Goal Tracker Management System
 * ==========================================================
 * Common success, validation and error messages used
 * across controllers, services and models.
 * ==========================================================
 */

const EMPLOYEE_MESSAGES = Object.freeze({
    // --------------------------------------------------
    // CRUD Success
    // --------------------------------------------------
    LIST_SUCCESS: "Employees fetched successfully.",
    DETAILS_SUCCESS: "Employee details fetched successfully.",
    CREATE_SUCCESS: "Employee created successfully.",
    UPDATE_SUCCESS: "Employee updated successfully.",
    DELETE_SUCCESS: "Employee deleted successfully.",
    ACTIVATE_SUCCESS: "Employee activated successfully.",
    DEACTIVATE_SUCCESS: "Employee deactivated successfully.",

    // --------------------------------------------------
    // CRUD Errors
    // --------------------------------------------------
    NOT_FOUND: "Employee not found.",
    ALREADY_EXISTS: "Employee already exists.",
    CREATE_FAILED: "Failed to create employee.",
    UPDATE_FAILED: "Failed to update employee.",
    DELETE_FAILED: "Failed to delete employee.",
    STATUS_UPDATE_FAILED: "Failed to update employee status.",

    // --------------------------------------------------
    // Validation
    // --------------------------------------------------
    EMPLOYEE_CODE_REQUIRED: "Employee Code is required.",
    EMPLOYEE_NAME_REQUIRED: "Employee Name is required.",
    EMAIL_REQUIRED: "Email is required.",
    MOBILE_REQUIRED: "Mobile Number is required.",
    DEPARTMENT_REQUIRED: "Department is required.",
    DESIGNATION_REQUIRED: "Designation is required.",
    LOCATION_REQUIRED: "Location is required.",
    JOINING_DATE_REQUIRED: "Joining Date is required.",
    ROLE_REQUIRED: "Role is required.",

    INVALID_EMAIL: "Please enter a valid email address.",
    INVALID_MOBILE: "Mobile Number must contain exactly 10 digits.",
    INVALID_STATUS: "Invalid employee status.",
    INVALID_JOINING_DATE: "Joining Date cannot be a future date.",

    // --------------------------------------------------
    // Duplicate
    // --------------------------------------------------
    EMPLOYEE_CODE_EXISTS: "Employee Code already exists.",
    EMAIL_EXISTS: "Email already exists.",
    MOBILE_EXISTS: "Mobile Number already exists.",

    // --------------------------------------------------
    // Foreign Key
    // --------------------------------------------------
    DEPARTMENT_NOT_FOUND: "Department does not exist.",
    ROLE_NOT_FOUND: "Role does not exist.",
    REPORTING_MANAGER_NOT_FOUND: "Reporting Manager not found.",
    HOD_NOT_FOUND: "HOD not found.",
    BUSINESS_HEAD_NOT_FOUND: "Business Head not found.",
    CFO_NOT_FOUND: "CFO not found.",

    // --------------------------------------------------
    // Search
    // --------------------------------------------------
    INVALID_SEARCH_FIELD: "Invalid search field.",
    INVALID_FILTER: "Invalid filter value.",

    // --------------------------------------------------
    // Import
    // --------------------------------------------------
    IMPORT_STARTED: "Employee import started.",
    IMPORT_SUCCESS: "Employee import completed successfully.",
    IMPORT_FAILED: "Employee import failed.",
    IMPORT_ROLLBACK: "Import failed. Transaction rolled back.",
    IMPORT_NO_DATA: "No records found in uploaded file.",

    // --------------------------------------------------
    // Excel Upload
    // --------------------------------------------------
    FILE_REQUIRED: "Please upload an Excel file.",
    INVALID_FILE: "Only .xlsx and .xls files are allowed.",
    FILE_TOO_LARGE: "Maximum allowed file size is 10 MB.",
    INVALID_EXCEL: "Uploaded Excel file is invalid.",
    INVALID_SHEET: "Employee worksheet not found.",

    // --------------------------------------------------
    // Excel Validation
    // --------------------------------------------------
    DUPLICATE_EMPLOYEE_CODE_EXCEL:
        "Duplicate Employee Code found in Excel.",

    DUPLICATE_EMAIL_EXCEL:
        "Duplicate Email found in Excel.",

    DUPLICATE_MOBILE_EXCEL:
        "Duplicate Mobile Number found in Excel.",

    VALIDATION_FAILED:
        "Excel validation failed.",

    PREVIEW_SUCCESS:
        "Import preview generated successfully.",

    SUMMARY_SUCCESS:
        "Import summary generated successfully.",

    // --------------------------------------------------
    // Export
    // --------------------------------------------------
    EXPORT_SUCCESS: "Employees exported successfully.",
    SAMPLE_DOWNLOAD_SUCCESS: "Sample Excel downloaded successfully.",
    NO_DATA_EXPORT: "No employee records available for export.",

    // --------------------------------------------------
    // User Creation
    // --------------------------------------------------
    USER_CREATED: "User account created successfully.",
    USER_CREATION_FAILED: "Failed to create user account.",

    PASSWORD_HISTORY_CREATED:
        "Password history created successfully.",

    ROLE_ASSIGNED:
        "User role assigned successfully.",

    HIERARCHY_CREATED:
        "Employee hierarchy created successfully.",

    // --------------------------------------------------
    // Authorization
    // --------------------------------------------------
    ACCESS_DENIED:
        "You are not authorized to perform this action.",

    ADMIN_ONLY:
        "Only administrators can perform this operation.",

    // --------------------------------------------------
    // Generic
    // --------------------------------------------------
    BAD_REQUEST: "Invalid request.",
    INTERNAL_SERVER_ERROR: "Internal server error.",
    DATABASE_ERROR: "Database operation failed.",
    TRANSACTION_FAILED: "Transaction failed.",
    TRANSACTION_SUCCESS: "Transaction completed successfully.",
    RECORD_ALREADY_EXISTS: "Record already exists.",
    RECORD_NOT_FOUND: "Record not found.",
    INVALID_REQUEST: "Invalid request parameters.",
});

module.exports = EMPLOYEE_MESSAGES;