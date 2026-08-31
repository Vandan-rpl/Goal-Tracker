const { getPool, sql } = require("../config/db");
const employeeConstants = require("../constants/employeeConstants");

/**
 * ============================================================
 * Employee Model
 * Enterprise Goal Tracker Management System
 * Microsoft SQL Server
 * ============================================================
 *
 * Part 1A
 * - Imports
 * - Constants
 * - Search Builder
 * - Filter Builder
 * - Sorting
 * - Pagination
 * - SQL Parameter Builder
 * ============================================================
 */

const { EMPLOYEE_SEARCH_FIELDS, EMPLOYEE_SORT_FIELDS, PAGINATION } =
  employeeConstants;

/**
 * ------------------------------------------------------------
 * Build WHERE Clause
 * ------------------------------------------------------------
 */
const buildWhereClause = (filters = {}) => {
  const where = [];
  const inputs = [];

  if (filters.search && filters.search.trim() !== "") {
    const keyword = `%${filters.search.trim()}%`;

    where.push(`(
                E.EmployeeCode LIKE @Search
             OR E.EmployeeName LIKE @Search
             OR E.Email LIKE @Search
             OR D.DepartmentName LIKE @Search
             OR E.Designation LIKE @Search
             OR E.Location LIKE @Search
        )`);

    inputs.push({
      name: "Search",
      type: sql.NVarChar(250),
      value: keyword,
    });
  }

  if (filters.departmentId) {
    where.push("E.DepartmentID = @DepartmentID");

    inputs.push({
      name: "DepartmentID",
      type: sql.Int,
      value: filters.departmentId,
    });
  }

  if (filters.role) {
    where.push("E.UserRole = @Role");

    inputs.push({
      name: "Role",
      type: sql.VarChar(50),
      value: filters.role,
    });
  }

  if (filters.status) {
    where.push("E.EmploymentStatus = @Status");

    inputs.push({
      name: "Status",
      type: sql.VarChar(20),
      value: filters.status,
    });
  }

  if (filters.location) {
    where.push("E.Location = @Location");

    inputs.push({
      name: "Location",
      type: sql.NVarChar(150),
      value: filters.location,
    });
  }

  if (filters.joiningDateFrom) {
    where.push("E.JoiningDate >= @JoiningDateFrom");

    inputs.push({
      name: "JoiningDateFrom",
      type: sql.Date,
      value: filters.joiningDateFrom,
    });
  }

  if (filters.joiningDateTo) {
    where.push("E.JoiningDate <= @JoiningDateTo");

    inputs.push({
      name: "JoiningDateTo",
      type: sql.Date,
      value: filters.joiningDateTo,
    });
  }

  where.push("E.IsDeleted = 0");

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    inputs,
  };
};

/**
 * ------------------------------------------------------------
 * Validate Sort Column
 * ------------------------------------------------------------
 */
const getSortColumn = (column) => {
  if (!column) return "E.EmployeeCode";

  const allowed = {
    EmployeeCode: "E.EmployeeCode",

    EmployeeName: "E.EmployeeName",

    Email: "E.Email",

    DepartmentName: "D.DepartmentName",

    Designation: "E.Designation",

    Location: "E.Location",

    JoiningDate: "E.JoiningDate",

    EmploymentStatus: "E.EmploymentStatus",
  };

  return allowed[column] || "E.EmployeeCode";
};

/**
 * ------------------------------------------------------------
 * Validate Sort Direction
 * ------------------------------------------------------------
 */
const getSortDirection = (direction) => {
  if (!direction) return "ASC";

  return direction.toUpperCase() === "DESC" ? "DESC" : "ASC";
};

/**
 * ------------------------------------------------------------
 * Pagination Helper
 * ------------------------------------------------------------
 */
const getPagination = ({
  page = PAGINATION.DEFAULT_PAGE,
  pageSize = PAGINATION.DEFAULT_PAGE_SIZE,
}) => {
  page = Number(page);

  pageSize = Number(pageSize);

  if (page < 1) page = PAGINATION.DEFAULT_PAGE;

  if (pageSize < 1) pageSize = PAGINATION.DEFAULT_PAGE_SIZE;

  if (pageSize > PAGINATION.MAX_PAGE_SIZE) pageSize = PAGINATION.MAX_PAGE_SIZE;

  const offset = (page - 1) * pageSize;

  return {
    page,

    pageSize,

    offset,
  };
};

/**
 * ------------------------------------------------------------
 * Apply SQL Parameters
 * ------------------------------------------------------------
 */
const applyInputs = (request, inputs = []) => {
  inputs.forEach((input) => {
    request.input(
      input.name,

      input.type,

      input.value,
    );
  });
};

/**
 * ------------------------------------------------------------
 * Create SQL Request
 * ------------------------------------------------------------
 */
const createRequest = async (filters = {}) => {
  const pool = getPool();

  const request = pool.request();

  const where = buildWhereClause(filters);

  applyInputs(request, where.inputs);

  return {
    request,

    whereClause: where.clause,
  };
};

/**
 * ------------------------------------------------------------
 * Build ORDER BY Clause
 * ------------------------------------------------------------
 */
const buildOrderBy = (sortBy, sortDirection) => {
  const column = getSortColumn(sortBy);

  const direction = getSortDirection(sortDirection);

  return `ORDER BY ${column} ${direction}`;
};

module.exports = {
  buildWhereClause,

  getSortColumn,

  getSortDirection,

  getPagination,

  applyInputs,

  createRequest,

  buildOrderBy,
};
