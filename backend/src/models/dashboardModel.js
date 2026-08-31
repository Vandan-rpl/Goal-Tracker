const { sql, pool, poolConnect } = require("../config/db");

/**
 * ============================================================
 * Dashboard Model
 * Enterprise Goal Tracker Management System
 * Microsoft SQL Server
 * ============================================================
 */

/**
 * Get Dashboard Summary
 */
const getDashboardSummary = async () => {
    await poolConnect;

    const request = pool.request();

    const query = `
        SELECT
            (SELECT COUNT(*) FROM Departments WHERE IsDeleted = 0) AS TotalDepartments,

            (SELECT COUNT(*) FROM Departments
                WHERE IsDeleted = 0
                AND IsActive = 1) AS ActiveDepartments,

            (SELECT COUNT(*) FROM Employees
                WHERE IsDeleted = 0) AS TotalEmployees,

            (SELECT COUNT(*) FROM Employees
                WHERE IsDeleted = 0
                AND IsActive = 1) AS ActiveEmployees,

            (SELECT COUNT(*) FROM Goals
                WHERE IsDeleted = 0) AS TotalGoals,

            (SELECT COUNT(*) FROM Goals
                WHERE IsDeleted = 0
                AND GoalStatus = 'Completed') AS CompletedGoals,

            (SELECT COUNT(*) FROM Goals
                WHERE IsDeleted = 0
                AND GoalStatus <> 'Completed') AS PendingGoals,

            (SELECT COUNT(*) FROM QuarterlyUpdates
                WHERE IsDeleted = 0) AS QuarterlyUpdates;
    `;

    const result = await request.query(query);

    return result.recordset[0];
};

/**
 * Department Summary
 */
const getDepartmentSummary = async () => {

    await poolConnect;

    const result = await pool.request().query(`
        SELECT
            DepartmentId,
            DepartmentName,
            IsActive,
            CreatedAt
        FROM Departments
        WHERE IsDeleted = 0
        ORDER BY DepartmentName;
    `);

    return result.recordset;
};

/**
 * Employee Summary
 */
const getEmployeeSummary = async () => {

    await poolConnect;

    const result = await pool.request().query(`
        SELECT
            EmployeeId,
            EmployeeCode,
            FullName,
            Email,
            DepartmentId,
            Designation,
            IsActive
        FROM Employees
        WHERE IsDeleted = 0
        ORDER BY FullName;
    `);

    return result.recordset;
};

/**
 * Goal Summary
 */
const getGoalSummary = async () => {

    await poolConnect;

    const result = await pool.request().query(`
        SELECT
            GoalStatus,
            COUNT(*) AS TotalGoals
        FROM Goals
        WHERE IsDeleted = 0
        GROUP BY GoalStatus
        ORDER BY GoalStatus;
    `);

    return result.recordset;
};

/**
 * Quarterly Update Summary
 */
const getQuarterlySummary = async () => {

    await poolConnect;

    const result = await pool.request().query(`
        SELECT
            QuarterNo,
            COUNT(*) AS TotalUpdates
        FROM QuarterlyUpdates
        WHERE IsDeleted = 0
        GROUP BY QuarterNo
        ORDER BY QuarterNo;
    `);

    return result.recordset;
};

/**
 * Latest Goals
 */
const getLatestGoals = async (top = 10) => {

    await poolConnect;

    const request = pool.request();

    request.input("Top", sql.Int, top);

    const result = await request.query(`
        SELECT TOP (@Top)
            GoalId,
            GoalTitle,
            GoalStatus,
            StartDate,
            EndDate,
            CreatedAt
        FROM Goals
        WHERE IsDeleted = 0
        ORDER BY CreatedAt DESC;
    `);

    return result.recordset;
};

/**
 * Latest Quarterly Updates
 */
const getLatestQuarterlyUpdates = async (top = 10) => {

    await poolConnect;

    const request = pool.request();

    request.input("Top", sql.Int, top);

    const result = await request.query(`
        SELECT TOP (@Top)
            QuarterlyUpdateId,
            GoalId,
            QuarterNo,
            ProgressPercentage,
            UpdateDate
        FROM QuarterlyUpdates
        WHERE IsDeleted = 0
        ORDER BY UpdateDate DESC;
    `);

    return result.recordset;
};

module.exports = {

    getDashboardSummary,

    getDepartmentSummary,

    getEmployeeSummary,

    getGoalSummary,

    getQuarterlySummary,

    getLatestGoals,

    getLatestQuarterlyUpdates

};